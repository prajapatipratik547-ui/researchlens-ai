import { z } from 'zod';

const email = z
  .string({ error: 'Email is required' })
  .trim()
  .toLowerCase()
  .max(254, 'Email is too long')
  .pipe(z.email('Enter a valid email address'));

// bcrypt silently ignores everything after 72 bytes, so reject longer
// passwords instead of letting two different passwords hash the same.
const newPassword = z
  .string({ error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .refine((p) => Buffer.byteLength(p, 'utf8') <= 72, 'Password must be at most 72 bytes')
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), 'Password must contain a letter and a number');

// z.object strips unknown keys, so clients cannot smuggle in fields such as
// `_id` or `passwordHash`.
export const registerSchema = z.object({
  name: z
    .string({ error: 'Name is required' })
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(80, 'Name must be at most 80 characters'),
  email,
  password: newPassword,
});

export const loginSchema = z.object({
  email,
  password: z.string({ error: 'Password is required' }).min(1, 'Password is required').max(200),
});
