import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../../src/config/db.js';

let mongo;

export async function startTestDB() {
  mongo = await MongoMemoryServer.create({ instance: { launchTimeout: 60_000 } });
  await connectDB(mongo.getUri());
  // Build unique indexes before tests rely on them (e.g. duplicate emails).
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
}

export async function clearTestDB() {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
}

export async function stopTestDB() {
  await disconnectDB();
  await mongo?.stop();
}
