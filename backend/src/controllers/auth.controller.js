import bcrypt from 'bcrypt';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { signToken } from '../utils/jwt.js';
import { ApiError } from '../utils/ApiError.js';

// Compared against when the email is unknown, so a login attempt takes the
// same time whether or not the account exists (no user enumeration by timing).
const DUMMY_HASH = bcrypt.hashSync('researchlens-timing-guard', env.BCRYPT_SALT_ROUNDS);

function authResponse(user) {
  return { user, token: signToken(user._id) };
}

export async function register(req, res) {
  const { name, email, password } = req.body;

  if (await User.exists({ email })) {
    throw ApiError.conflict('An account with this email already exists', {
      code: 'EMAIL_TAKEN',
      details: [{ field: 'email', message: 'An account with this email already exists' }],
    });
  }

  const passwordHash = await bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);
  const user = await User.create({ name, email, passwordHash });

  res.status(201).json(authResponse(user));
}

export async function login(req, res) {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+passwordHash');
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !valid) {
    throw ApiError.unauthorized('Invalid email or password', { code: 'INVALID_CREDENTIALS' });
  }

  res.json(authResponse(user));
}

export function me(req, res) {
  res.json({ user: req.user });
}
