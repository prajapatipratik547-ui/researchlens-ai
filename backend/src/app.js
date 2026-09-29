import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { dbStatus } from './config/db.js';
import { ApiError } from './utils/ApiError.js';
import { notFound, errorHandler } from './middleware/error.middleware.js';
import authRoutes from './routes/auth.routes.js';
import projectRoutes from './routes/project.routes.js';
import documentRoutes from './routes/document.routes.js';
import aiRoutes from './routes/ai.routes.js';
import researchRoutes from './routes/research.routes.js';

export function createApp() {
  const app = express();

  // Render (and most PaaS) terminate TLS at a proxy; needed for correct
  // client IPs in rate limiting.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        // Non-browser clients (curl, health checks) send no Origin header.
        if (!origin || env.clientOrigins.includes(origin)) return callback(null, true);
        callback(ApiError.forbidden(`Origin not allowed by CORS: ${origin}`, { code: 'CORS' }));
      },
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    const database = dbStatus();
    res.status(database === 'connected' ? 200 : 503).json({
      status: database === 'connected' ? 'ok' : 'degraded',
      database,
      uptime: Math.round(process.uptime()),
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/research', researchRoutes);
  app.use('/api', documentRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
