/**
 * Operational application error carrying an HTTP status code.
 * Services throw AppError so controllers and error middleware stay clean.
 */
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

module.exports = AppError;

