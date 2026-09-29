import { setupWorker } from 'msw/browser';
import { buildHandlers } from './handlers';

/**
 * Dev-only mock API. VITE_USE_MOCKS=true mocks everything (seeded demo account — see .env.example);
 * VITE_USE_MOCKS=planned mocks only the Phase 4–7 endpoints and lets auth/projects hit the real backend.
 */
export async function startMocks(scope: 'true' | 'planned') {
  const worker = setupWorker(...(await buildHandlers(scope)));
  await worker.start({ onUnhandledFrame: 'bypass', quiet: true });
  console.info(`[mocks] ResearchLens mock API active (${scope === 'true' ? 'all endpoints' : 'planned endpoints only'})`);
}
