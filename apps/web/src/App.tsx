import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Skeleton } from './components/ui/skeleton';
import { LoginPage } from './pages/LoginPage';
import { JoinPage } from './pages/JoinPage';

// Layout pulls in framer-motion + supabase realtime via NavBar/OfflineBanner;
// lazy-loading it keeps those deps out of the unauthenticated /login chunk.
const Layout = lazy(() => import('./components/Layout').then((m) => ({ default: m.Layout })));

// Lazy-loaded routes: only the login + join chunks ship eagerly so the unauth
// entry point is fast. Everything else loads after auth.
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const SchedulePage = lazy(() => import('./pages/SchedulePage').then((m) => ({ default: m.SchedulePage })));
const PredictionsPage = lazy(() => import('./pages/PredictionsPage').then((m) => ({ default: m.PredictionsPage })));
const KnockoutPredictionsPage = lazy(() => import('./pages/KnockoutPredictionsPage').then((m) => ({ default: m.KnockoutPredictionsPage })));
const SpecialsPage = lazy(() => import('./pages/SpecialsPage').then((m) => ({ default: m.SpecialsPage })));
const BracketPage = lazy(() => import('./pages/BracketPage').then((m) => ({ default: m.BracketPage })));
const GroupsPage = lazy(() => import('./pages/GroupsPage').then((m) => ({ default: m.GroupsPage })));
const GroupDetailPage = lazy(() => import('./pages/GroupDetailPage').then((m) => ({ default: m.GroupDetailPage })));
const MatchDetailPage = lazy(() => import('./pages/MatchDetailPage').then((m) => ({ default: m.MatchDetailPage })));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage').then((m) => ({ default: m.LeaderboardPage })));
const LeaderboardHistoryPage = lazy(() => import('./pages/LeaderboardHistoryPage').then((m) => ({ default: m.LeaderboardHistoryPage })));
const RoundLeaderboardPage = lazy(() => import('./pages/RoundLeaderboardPage').then((m) => ({ default: m.RoundLeaderboardPage })));
const PlayerProfilePage = lazy(() => import('./pages/PlayerProfilePage').then((m) => ({ default: m.PlayerProfilePage })));
const ComparePage = lazy(() => import('./pages/ComparePage').then((m) => ({ default: m.ComparePage })));
const OfflinePage = lazy(() => import('./pages/OfflinePage').then((m) => ({ default: m.OfflinePage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const AdminInvitesPage = lazy(() => import('./pages/admin/InvitesPage').then((m) => ({ default: m.AdminInvitesPage })));
const AdminPlayersPage = lazy(() => import('./pages/admin/PlayersPage').then((m) => ({ default: m.AdminPlayersPage })));
const AdminDashboardPage = lazy(() => import('./pages/admin/DashboardPage').then((m) => ({ default: m.AdminDashboardPage })));
const AdminSyncPage = lazy(() => import('./pages/admin/SyncPage').then((m) => ({ default: m.AdminSyncPage })));
const AdminResultsPage = lazy(() => import('./pages/admin/ResultsPage').then((m) => ({ default: m.AdminResultsPage })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function RouteFallback() {
  return (
    <div className="space-y-4" aria-label="Loading page">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-[320px] w-full" />
    </div>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
          <Toaster position="bottom-right" richColors closeButton />
          <ErrorBoundary>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/join/:token" element={<JoinPage />} />

                {/* Player routes — wrapped in Layout (NavBar + main) */}
                <Route element={<ProtectedRoute />}>
                  <Route element={<Layout />}>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/schedule" element={<SchedulePage />} />
                    <Route path="/predictions" element={<PredictionsPage />} />
                    <Route path="/predictions/knockout" element={<KnockoutPredictionsPage />} />
                    <Route path="/predictions/specials" element={<SpecialsPage />} />
                    <Route path="/bracket" element={<BracketPage />} />
                    <Route path="/groups" element={<GroupsPage />} />
                    <Route path="/groups/:name" element={<GroupDetailPage />} />
                    <Route path="/matches/:id" element={<MatchDetailPage />} />
                    <Route path="/leaderboard" element={<LeaderboardPage />} />
                    <Route path="/leaderboard/history" element={<LeaderboardHistoryPage />} />
                    <Route path="/leaderboard/round/:stage" element={<RoundLeaderboardPage />} />
                    <Route path="/players/:id" element={<PlayerProfilePage />} />
                    <Route path="/compare" element={<ComparePage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/offline" element={<OfflinePage />} />
                  </Route>
                </Route>

                {/* Admin-only routes */}
                <Route element={<ProtectedRoute requireAdmin />}>
                  <Route element={<Layout />}>
                    <Route path="/admin" element={<AdminDashboardPage />} />
                    <Route path="/admin/sync" element={<AdminSyncPage />} />
                    <Route path="/admin/results" element={<AdminResultsPage />} />
                    <Route path="/admin/invites" element={<AdminInvitesPage />} />
                    <Route path="/admin/players" element={<AdminPlayersPage />} />
                  </Route>
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
