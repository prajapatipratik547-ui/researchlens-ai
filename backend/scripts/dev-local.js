// Runs the API against a MongoDB server on this machine, for trying the app
// before a MongoDB Atlas cluster is set up. Data persists in backend/.local-db
// between runs. Not for production: Render and Atlas use `npm start`.
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MongoMemoryServer } from 'mongodb-memory-server';

const dbPath = fileURLToPath(new URL('../.local-db', import.meta.url));
mkdirSync(dbPath, { recursive: true });

const mongo = await MongoMemoryServer.create({
  instance: { dbPath, storageEngine: 'wiredTiger', port: 27018, launchTimeout: 60_000 },
});

process.env.MONGODB_URI = mongo.getUri('researchlens');
console.log(`[dev:local] MongoDB running at ${process.env.MONGODB_URI} (data in .local-db)`);

const stop = async () => {
  await mongo.stop({ doCleanup: false });
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

await import('../src/server.js');
