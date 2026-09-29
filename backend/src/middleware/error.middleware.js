import mongoose from 'mongoose';
import { ZodError } from 'zod';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/ApiError.js';

export function notFound(req, _res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

// Translate known library errors into ApiErrors so every response has the
// same shape: { error: { message, code, details? } }.
function normalize(err) {
  if (err instanceof ApiError) return err;

  if (err instanceof ZodError) {
    return ApiError.badRequest('Validation failed', {
      code: 'VALIDATION_ERROR',
      details: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }

  if (err instanceof jwt.TokenExpiredError) {
    return ApiError.unauthorized('Session expired, please log in again', { code: 'TOKEN_EXPIRED' });
  }
  if (err instanceof jwt.JsonWebTokenError) {
    return ApiError.unauthorized('Invalid authentication token', { code: 'INVALID_TOKEN' });
  }

  if (err instanceof mongoose.Error.CastError) {
    return ApiError.badRequest(`Invalid ${err.path}`, { code: 'INVALID_ID' });
  }
  if (err instanceof mongoose.Error.ValidationError) {
    return ApiError.badRequest('Validation failed', {
      code: 'VALIDATION_ERROR',
      details: Object.values(err.errors).map((e) => ({ field: e.path, message: e.message })),
    });
  }
  if (err?.code === 11000) {
    const field = Object.keys(err.keyValue ?? {})[0] ?? 'field';
    return ApiError.conflict(`That ${field} is already in use`, { code: 'DUPLICATE' });
  }

  // body-parser errors carry a status and a type
  if (err?.type === 'entity.parse.failed') {
    return ApiError.badRequest('Malformed JSON body', { code: 'INVALID_JSON' });
  }
  if (err?.type === 'entity.too.large') {
    return new ApiError(413, 'Request body too large', { code: 'PAYLOAD_TOO_LARGE' });
  }

  return null;
}

// Express recognises error handlers by their 4-argument signature.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  const known = normalize(err);
  const status = known?.statusCode ?? 500;

  if (status >= 500) {
    logger.error('Unhandled error', {
      method: req.method,
      path: req.originalUrl,
      error: err?.message,
      stack: env.isProduction ? undefined : err?.stack,
    });
  }

  const body = {
    error: {
      message: known?.message ?? (env.isProduction ? 'Internal server error' : err?.message),
      code: known?.code ?? 'INTERNAL_ERROR',
    },
  };
  if (known?.details) body.error.details = known.details;
  // Stack traces only ever leave the server in development.
  if (!known && env.NODE_ENV === 'development') body.error.stack = err?.stack;

  res.status(status).json(body);
}
