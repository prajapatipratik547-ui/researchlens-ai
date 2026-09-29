import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { register, login, me } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { registerSchema, loginSchema } from '../validators/auth.validator.js';

// Brute-force protection: only failed attempts count, so a demo audience
// sharing one Wi-Fi network is not locked out by successful logins.
const credentialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => env.isTest,
  handler: (_req, res) =>
    res.status(429).json({
      error: { message: 'Too many attempts. Please try again in a few minutes.', code: 'RATE_LIMITED' },
    }),
});

const router = Router();

router.post('/register', credentialLimiter, validate({ body: registerSchema }), register);
router.post('/login', credentialLimiter, validate({ body: loginSchema }), login);
router.get('/me', requireAuth, me);

export default router;
