import { env } from '../config/env.js';

// Minimal structured logger. JSON lines in production (Render log search
// handles them well), readable lines in development, silent in tests.
const levels = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = env.isTest ? Infinity : env.isProduction ? levels.info : levels.debug;

function write(level, message, meta) {
  if (levels[level] < threshold) return;
  const stream = level === 'error' || level === 'warn' ? console.error : console.log;

  if (env.isProduction) {
    stream(JSON.stringify({ level, time: new Date().toISOString(), message, ...meta }));
  } else {
    const suffix = meta && Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    stream(`[${level.toUpperCase()}] ${message}${suffix}`);
  }
}

export const logger = {
  debug: (message, meta) => write('debug', message, meta),
  info: (message, meta) => write('info', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  error: (message, meta) => write('error', message, meta),
};
