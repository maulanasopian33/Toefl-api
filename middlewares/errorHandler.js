// middlewares/errorHandler.js
const { logger } = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  // Status default adalah 500 (Internal Server Error)
  const statusCode = err.status || 500;
  
  if (statusCode >= 500) {
    logger.error({
      message: err.message,
      stack: err.stack,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip
    });
  } else {
    // Log warning untuk client errors yang tidak biasa jika perlu
    logger.warn({
      message: err.message,
      status: statusCode,
      method: req.method,
      url: req.originalUrl
    });
  }

  const message = err.message || 'Terjadi kesalahan pada server. Silakan coba lagi.';

  // Kirimkan respons error
  res.status(statusCode).json({
    status: 'error',
    message: message,
    // Tambahkan stacktrace di lingkungan development untuk debugging
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;