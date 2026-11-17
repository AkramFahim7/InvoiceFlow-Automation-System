const env = require('../config/env');

/**
 * Centralized Express error handler.
 * Prevents leaking internal SQL details or stack traces to clients.
 */
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const message = err.isOperational
    ? err.message
    : 'An unexpected internal server error occurred.';

  if (statusCode >= 500) {
    console.error('[Error]', err);
  }

  res.status(statusCode).json({
    status: 'error',
    message,
    ...(env.nodeEnv === 'development' && !err.isOperational
      ? { detail: err.message }
      : {}),
  });
}

module.exports = errorHandler;

