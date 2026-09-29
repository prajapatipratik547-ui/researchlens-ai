import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import { AuthProvider } from './context/AuthProvider';
import { ToastProvider } from './context/ToastProvider';
import { queryClient } from './lib/queryClient';
import { router } from './router';
import './styles/index.css';

async function enableMocks() {
  const scope = import.meta.env.VITE_USE_MOCKS;
  if (!import.meta.env.DEV || (scope !== 'true' && scope !== 'planned')) return;
  const { startMocks } = await import('./mocks/browser');
  await startMocks(scope);
}

const root = document.getElementById('root');
if (!root) throw new Error('#root missing from index.html');

void enableMocks().then(() => {
  createRoot(root).render(
    <StrictMode>
      <MotionConfig reducedMotion="user">
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <AuthProvider>
              <RouterProvider router={router} />
            </AuthProvider>
          </ToastProvider>
        </QueryClientProvider>
      </MotionConfig>
    </StrictMode>,
  );
});
