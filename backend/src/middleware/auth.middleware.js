import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { verifyToken } from '../utils/jwt.js';
import { ApiError } from '../utils/ApiError.js';

// Resolves the caller from the Bearer token. Downstream handlers must use
// req.user / req.userId, never a user id supplied in the request.
export async function requireAuth(req, _res, next) {
  const header = req.get('authorization') ?? '';
  const [scheme, token] = header.split(' ');

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    throw ApiError.unauthorized('Authentication required', { code: 'NO_TOKEN' });
  }

  const payload = verifyToken(token);
  if (!mongoose.isValidObjectId(payload.sub)) {
    throw ApiError.unauthorized('Invalid authentication token', { code: 'INVALID_TOKEN' });
  }

  const user = await User.findById(payload.sub);
  if (!user) {
    throw ApiError.unauthorized('This account no longer exists', { code: 'USER_NOT_FOUND' });
  }

  req.user = user;
  req.userId = user._id;
  next();
}
