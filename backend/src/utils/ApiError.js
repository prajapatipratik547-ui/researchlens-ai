// Operational error with an HTTP status. Anything thrown that is NOT an
// ApiError (or a recognised library error) is treated as a 500 and its
// message is hidden from clients in production.
export class ApiError extends Error {
  constructor(statusCode, message, { code, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static badRequest(message = 'Bad request', opts) {
    return new ApiError(400, message, { code: 'BAD_REQUEST', ...opts });
  }

  static unauthorized(message = 'Authentication required', opts) {
    return new ApiError(401, message, { code: 'UNAUTHORIZED', ...opts });
  }

  static forbidden(message = 'You do not have access to this resource', opts) {
    return new ApiError(403, message, { code: 'FORBIDDEN', ...opts });
  }

  static notFound(message = 'Resource not found', opts) {
    return new ApiError(404, message, { code: 'NOT_FOUND', ...opts });
  }

  static conflict(message = 'Resource already exists', opts) {
    return new ApiError(409, message, { code: 'CONFLICT', ...opts });
  }
}
