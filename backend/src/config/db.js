import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

mongoose.set('strictQuery', true);

export async function connectDB(uri = env.MONGODB_URI) {
  mongoose.connection.on('error', (err) => logger.error('MongoDB error', { error: err.message }));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  logger.info('MongoDB connected', { db: mongoose.connection.name });
  return mongoose.connection;
}

export async function disconnectDB() {
  await mongoose.disconnect();
}

export function dbStatus() {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return states[mongoose.connection.readyState] ?? 'unknown';
}
