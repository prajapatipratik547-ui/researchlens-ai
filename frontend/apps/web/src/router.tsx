import { createBrowserRouter } from 'react-router';
import { GuestOnly, RequireAuth } from './components/app/RouteGuards';
import { LandingPage } from './pages/LandingPage';
import { PlaceholderPage } from './pages/PlaceholderPage';

/* The landing page ships in the main chunk; every app screen is split out and loaded on demand. */

export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  {
    element: <GuestOnly />,
    children: [
      { path: '/login', lazy: () => import('./pages/auth/LoginPage').then((m) => ({ Component: m.LoginPage })) },
      { path: '/register', lazy: () => import('./pages/auth/RegisterPage').then((m) => ({ Component: m.RegisterPage })) },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        lazy: () => import('./components/app/AppShell').then((m) => ({ Component: m.AppShell })),
        children: [
          { path: '/dashboard', lazy: () => import('./pages/app/DashboardPage').then((m) => ({ Component: m.DashboardPage })) },
          {
            path: '/research/new',
            lazy: () => import('./pages/app/NewProjectPage').then((m) => ({ Component: m.NewProjectPage })),
          },
          {
            path: '/research/:id',
            lazy: () => import('./pages/app/WorkspaceLayout').then((m) => ({ Component: m.WorkspaceLayout })),
            children: [
              { index: true, lazy: () => import('./pages/workspace/OverviewTab').then((m) => ({ Component: m.OverviewTab })) },
              { path: 'sources', lazy: () => import('./pages/workspace/SourcesTab').then((m) => ({ Component: m.SourcesTab })) },
              {
                path: 'assistant',
                lazy: () => import('./pages/workspace/AssistantTab').then((m) => ({ Component: m.AssistantTab })),
              },
              { path: 'evidence', lazy: () => import('./pages/workspace/EvidenceTab').then((m) => ({ Component: m.EvidenceTab })) },
              { path: 'insights', lazy: () => import('./pages/workspace/InsightsTab').then((m) => ({ Component: m.InsightsTab })) },
              { path: 'gaps', lazy: () => import('./pages/workspace/GapsTab').then((m) => ({ Component: m.GapsTab })) },
              { path: 'brief', lazy: () => import('./pages/workspace/BriefTab').then((m) => ({ Component: m.BriefTab })) },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <PlaceholderPage title="Page not found" code="404" /> },
]);
