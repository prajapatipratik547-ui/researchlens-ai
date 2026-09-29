// Runs before each test file, before any app module is imported, so
// config/env.js sees these values instead of a developer's .env.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-production-rules';
process.env.JWT_EXPIRES_IN = '1h';
process.env.MONGODB_URI = 'mongodb://placeholder-replaced-by-memory-server';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.BCRYPT_SALT_ROUNDS = '4';

// Tests must never call a real AI API (cost, quota, flakiness). Blank keys
// win over .env because dotenv never overrides variables that already exist;
// AI tests install a fake provider instead.
process.env.AI_PROVIDER = 'gemini';
process.env.GEMINI_API_KEY = '';
process.env.GROQ_API_KEY = '';
process.env.AI_API_KEY = '';
process.env.AI_BASE_URL = '';
process.env.AI_MODEL = '';
