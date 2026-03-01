const { auditlog } = require('../models');
const { logger } = require('../utils/logger');

/**
 * Middleware to capture and log administrative actions.
 * Intercepts POST, PUT, PATCH, and DELETE requests.
 * Logs both successful and failed mutations.
 */
const auditMiddleware = async (req, res, next) => {
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);

  // Exclude specific routes (e.g., login to avoid logging passwords, or large file uploads)
  const isExcluded =
    req.path.includes('/auth/login') ||
    req.path.includes('/media') ||
    req.path.includes('/logs/audit'); // Hindari infinite loop saat POST log dari FE

  if (isMutation && !isExcluded) {
    const originalSend = res.send;

    // Tangkap userId dari req.user (Firebase UID), terisi oleh authMiddleware
    const userId = req.user ? (req.user.uid || req.user.id || null) : null;

    const logData = {
      userId: userId,
      action: `${req.method} ${req.originalUrl || req.url}`,
      module: (req.path.split('/').filter(Boolean)[0]) || 'root',
      details: {
        params: req.params,
        query: req.query,
        body: redactSensitiveData(req.body)
      },
      ipAddress: req.ip || (req.connection && req.connection.remoteAddress),
      userAgent: req.get('User-Agent'),
      source: 'backend'
    };

    // Override res.send untuk menangkap status code final
    res.send = function (content) {
      const statusCode = res.statusCode;

      // Log semua request, termasuk yang gagal (4xx & 5xx)
      auditlog.create({
        ...logData,
        details: {
          ...logData.details,
          statusCode
        }
      }).catch(err => logger.error('Audit Log Error:', err));

      return originalSend.apply(res, arguments);
    };
  }

  next();
};

/**
 * Filter out sensitive fields like passwords from being logged.
 */
function redactSensitiveData(data) {
  if (!data || typeof data !== 'object') return data;

  const redacted = { ...data };
  const sensitiveKeys = ['password', 'token', 'secret', 'apiKey'];

  Object.keys(redacted).forEach(key => {
    if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
      redacted[key] = '[REDACTED]';
    } else if (typeof redacted[key] === 'object') {
      redacted[key] = redactSensitiveData(redacted[key]);
    }
  });

  return redacted;
}

module.exports = auditMiddleware;
