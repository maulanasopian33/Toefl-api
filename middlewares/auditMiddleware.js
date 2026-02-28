const { auditlog } = require('../models');
const { logger } = require('../utils/logger');

/**
 * Middleware to capture and log administrative actions.
 * Intercepts POST, PUT, PATCH, and DELETE requests.
 */
const auditMiddleware = async (req, res, next) => {
  // Only log if it's a mutation request
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  
  // We can exclude specific routes if needed (e.g., login, or large file uploads)
  const isExcluded = req.path.includes('/auth/login') || req.path.includes('/media');

  if (isMutation && !isExcluded) {
    // We'll log AFTER the response is sent to know if it was successful,
    // but we capture data NOW.
    const originalSend = res.send;
    
    // Attempt to get userId from request (usually attached by authMiddleware)
    const userId = req.user ? req.user.id : null;
    
    const logData = {
      userId: userId,
      action: `${req.method} ${req.originalUrl || req.url}`,
      module: req.path.split('/')[1] || 'root',
      details: {
        params: req.params,
        query: req.query,
        body: redactSensitiveData(req.body)
      },
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      source: 'backend'
    };

    // Override res.send to capture status and final logging
    res.send = function (content) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Only log successful modifications or those that weren't client errors?
        // Usually, we want to log all attempts or at least successful ones.
        auditlog.create({
          ...logData,
          details: {
            ...logData.details,
            statusCode: res.statusCode
          }
        }).catch(err => logger.error('Audit Log Error:', err));
      }
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
