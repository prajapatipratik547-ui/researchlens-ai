import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const ISSUER = 'researchlens-api';
const ALGORITHM = 'HS256';

// The token carries only the user id (as `sub`). Everything else is loaded
// from the database per request, so a deleted user's token stops working.
export function signToken(userId) {
  return jwt.sign({}, env.JWT_SECRET, {
    subject: String(userId),
    expiresIn: env.JWT_EXPIRES_IN,
    issuer: ISSUER,
    algorithm: ALGORITHM,
  });
}

// Throws jwt.JsonWebTokenError / TokenExpiredError, which the error
// middleware maps to 401 responses.
export function verifyToken(token) {
  return jwt.verify(token, env.JWT_SECRET, { algorithms: [ALGORITHM], issuer: ISSUER });
}
