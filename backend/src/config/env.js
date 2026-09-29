import 'dotenv/config';
import { z } from 'zod';

// An empty `KEY=` line in .env means "not set".
const optionalString = z
  .string()
  .optional()
  .transform((v) => (v?.trim() ? v.trim() : undefined));

const csv = (fallback) =>
  z
    .string()
    .optional()
    .transform((v) =>
      (v?.trim() ? v : fallback)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    );

// Single source of truth for configuration. Everything else imports `env`
// from here instead of reading process.env directly, so a missing or
// malformed variable fails loudly at startup rather than mid-request.
const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().default(5000),
    MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
    JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
    JWT_EXPIRES_IN: z.string().default('7d'),
    // Comma-separated list of allowed browser origins, e.g.
    // "http://localhost:5173,https://researchlens.vercel.app"
    CLIENT_URL: z.string().default('http://localhost:5173'),
    // AI provider. Keys are read only here and never sent to the client.
    // gemini: Google Gemini · groq: Groq · openai: any OpenAI-compatible API
    // (OpenRouter, LM Studio, Ollama) configured with AI_BASE_URL/AI_MODEL.
    AI_PROVIDER: z.enum(['gemini', 'groq', 'openai']).default('gemini'),
    GEMINI_API_KEY: optionalString,
    // Flash-Lite answers in seconds on the free tier; Flash is stronger but
    // often overloaded, so it is the first fallback.
    GEMINI_MODEL: z.string().trim().default('gemini-3.5-flash-lite'),
    // Tried in order when the main model is overloaded, out of quota or
    // retired. Each model has its own free-tier quota.
    GEMINI_FALLBACK_MODELS: csv('gemini-3.5-flash,gemini-2.5-flash'),
    GROQ_API_KEY: optionalString,
    GROQ_MODEL: z.string().trim().default('llama-3.3-70b-versatile'),
    AI_BASE_URL: optionalString,
    AI_API_KEY: optionalString,
    AI_MODEL: optionalString,
    AI_TIMEOUT_MS: z.coerce.number().int().positive().default(90_000),
    BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  })
  .superRefine((cfg, ctx) => {
    if (cfg.NODE_ENV === 'production' && cfg.JWT_SECRET.length < 32) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_SECRET'],
        message: 'JWT_SECRET must be at least 32 characters in production',
      });
    }
  });

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  // Logger depends on env, so write directly to stderr here.
  console.error(`Invalid environment configuration:\n${details}`);
  process.exit(1);
}

export const env = Object.freeze({
  ...parsed.data,
  clientOrigins: parsed.data.CLIENT_URL.split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean),
  isProduction: parsed.data.NODE_ENV === 'production',
  isTest: parsed.data.NODE_ENV === 'test',
});
