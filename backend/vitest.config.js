import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    // First run downloads a MongoDB binary for mongodb-memory-server.
    hookTimeout: 180_000,
    testTimeout: 20_000,
    // Each file gets its own in-memory database; run files one at a time
    // to keep memory use predictable on laptops.
    fileParallelism: false,
  },
});
