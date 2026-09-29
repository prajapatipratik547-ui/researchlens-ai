import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { createApp } from './app.js';
import { recoverInterruptedDocuments } from './services/document.service.js';
import { aiStatus } from './services/llm.service.js';
import { logger } from './utils/logger.js';

async function start() {
  try {
    await connectDB();
  } catch (err) {
    logger.error('Could not connect to MongoDB', { error: err.message });
    process.exit(1);
  }

  // Uploads are processed in memory; any a restart left unfinished have failed.
  await recoverInterruptedDocuments();

  const ai = aiStatus();
  if (ai.configured) {
    logger.info('AI provider ready', { provider: ai.provider, model: ai.model });
  } else {
    logger.warn(`AI provider "${ai.provider}" is not configured (missing key/model); AI features are off`);
  }

  const server = createApp().listen(env.PORT, () => {
    logger.info(`ResearchLens API listening on port ${env.PORT}`, { env: env.NODE_ENV });
  });

  const shutdown = (signal) => {
    logger.info(`${signal} received, shutting down`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    // Force exit if connections refuse to drain.
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { error: String(reason) });
});

start();
