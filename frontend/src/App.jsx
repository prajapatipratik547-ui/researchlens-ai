import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import { Toaster } from 'sonner';
import { AuthProvider } from './context/AuthContext';
import { GuestRoute, ProtectedRoute } from './components/RouteGuards';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import CreateResearch from './pages/CreateResearch';
import ResearchWorkspace from './pages/ResearchWorkspace';
import ProjectOverview from './pages/ProjectOverview';
import Sources from './pages/Sources';
import EvidenceMatrix from './pages/EvidenceMatrix';
import Insights from './pages/Insights';
import ResearchGaps from './pages/ResearchGaps';
import ResearchChat from './components/ResearchChat';
import LoadingState from './components/LoadingState';
import NotFound from './pages/NotFound';

// The brief pulls in the Markdown renderer, so it loads only when opened.
const ResearchBrief = lazy(() => import('./pages/ResearchBrief'));

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Landing />} />

        <Route element={<GuestRoute />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/research/new" element={<CreateResearch />} />
          <Route path="/research/:projectId" element={<ResearchWorkspace />}>
            <Route index element={<ProjectOverview />} />
            <Route path="sources" element={<Sources />} />
            <Route path="assistant" element={<ResearchChat />} />
            <Route path="evidence" element={<EvidenceMatrix />} />
            <Route path="insights" element={<Insights />} />
            <Route path="gaps" element={<ResearchGaps />} />
            <Route
              path="brief"
              element={
                <Suspense fallback={<LoadingState label="Loading…" />}>
                  <ResearchBrief />
                </Suspense>
              }
            />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster position="top-right" richColors closeButton />
    </AuthProvider>
  );
}
