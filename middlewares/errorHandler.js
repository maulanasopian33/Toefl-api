// middlewares/errorHandler.js

const errorHandler = (err, req, res, next) => {
  console.error(err); // Log error ke console server

  // Status default adalah 500 (Internal Server Error)
  const statusCode = err.status || 500;
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