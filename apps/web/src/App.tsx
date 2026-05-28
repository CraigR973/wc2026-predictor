import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider } from './contexts/AuthContext';
import { LeagueProvider } from './contexts/LeagueContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { UpdateBanner } from './components/UpdateBanner';
import { InstallPromptController } from './components/InstallPromptController';
import { Skeleton } from './components/ui/skeleton';
import { LoginPage } from './pages/LoginPage';
import { JoinPage } from './pages/JoinPage';

// Layout pulls in framer-motion + supabase realtime via NavBar/OfflineBanner;
// lazy-loading it keeps those deps out of the unauthenticated /login chunk.
const Layout = lazy(() => import('./components/Layout').then((m) => ({ default: m.Layout })));

// Lazy-loaded routes: only login + join ship eagerly so the unauth entry is fast.
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
const AboutPage = lazy(() => import('./pages/AboutPage').then((m) => ({ default: m.AboutPage })));
const AdminInvitesPage = lazy(() => import('./pages/admin/InvitesPage').then((m) => ({ default: m.AdminInvitesPage })));
const AdminPlayersPage = lazy(() => import('./pages/admin/PlayersPage').then((m) => ({ default: m.AdminPlayersPage })));
const AdminDashboardPage = lazy(() => import('./pages/admin/DashboardPage').then((m) => ({ default: m.AdminDashboardPage })));
const AdminSyncPage = lazy(() => import('./pages/admin/SyncPage').then((m) => ({ default: m.AdminSyncPage })));
const AdminResultsPage = lazy(() => import('./pages/admin/ResultsPage').then((m) => ({ default: m.AdminResultsPage })));

// M6 new pages
const SignupPage = lazy(() => import('./pages/SignupPage').then((m) => ({ default: m.SignupPage })));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage').then((m) => ({ default: m.VerifyEmailPage })));
const WelcomePage = lazy(() => import('./pages/WelcomePage').then((m) => ({ default: m.WelcomePage })));
const MyLeaguesPage = lazy(() => import('./pages/MyLeaguesPage').then((m) => ({ default: m.MyLeaguesPage })));
const CreateLeaguePage = lazy(() => import('./pages/CreateLeaguePage').then((m) => ({ default: m.CreateLeaguePage })));
const DiscoverLeaguesPage = lazy(() => import('./pages/DiscoverLeaguesPage').then((m) => ({ default: m.DiscoverLeaguesPage })));
const LeagueHomePage = lazy(() => import('./pages/LeagueHomePage').then((m) => ({ default: m.LeagueHomePage })));
const LeagueMembersPage = lazy(() => import('./pages/LeagueMembersPage').then((m) => ({ default: m.LeagueMembersPage })));
const LeagueSettingsPage = lazy(() => import('./pages/LeagueSettingsPage').then((m) => ({ default: m.LeagueSettingsPage })));
const LeagueJoinRequestsPage = lazy(() => import('./pages/LeagueJoinRequestsPage').then((m) => ({ default: m.LeagueJoinRequestsPage })));
const LeagueAdminInvitesPage = lazy(() => import('./pages/LeagueAdminInvitesPage').then((m) => ({ default: m.LeagueAdminInvitesPage })));

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

/**
 * Wraps protected routes with LeagueProvider.
 * Must be inside BrowserRouter (for useNavigate) and QueryClientProvider (for useQuery).
 * /welcome lives here without Layout chrome so it can be a full-screen redirect landing.
 */
function LeagueAwareLayout() {
  return (
    <LeagueProvider>
      <Outlet />
    </LeagueProvider>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
          <UpdateBanner />
          <InstallPromptController />
          <Toaster position="bottom-right" richColors closeButton />
          <ErrorBoundary>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                {/* Public routes (no auth, no league context) */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/verify-email/:token" element={<VerifyEmailPage />} />
                <Route path="/join/:token" element={<JoinPage />} />

                {/* Protected: authenticated + LeagueProvider */}
                <Route element={<ProtectedRoute />}>
                  <Route element={<LeagueAwareLayout />}>
                    {/* Full-screen pages (no Layout chrome) */}
                    <Route path="/welcome" element={<WelcomePage />} />

                    {/* Standard app shell with TopBar + TabBar */}
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
                      <Route path="/about" element={<AboutPage />} />
                      <Route path="/offline" element={<OfflinePage />} />

                      {/* League management */}
                      <Route path="/leagues" element={<MyLeaguesPage />} />
                      <Route path="/leagues/new" element={<CreateLeaguePage />} />
                      <Route path="/leagues/discover" element={<DiscoverLeaguesPage />} />
                      <Route path="/leagues/:slug" element={<LeagueHomePage />} />
                      <Route path="/leagues/:slug/members" element={<LeagueMembersPage />} />
                      <Route path="/leagues/:slug/settings" element={<LeagueSettingsPage />} />
                      <Route path="/leagues/:slug/requests" element={<LeagueJoinRequestsPage />} />
                      <Route path="/leagues/:slug/admin/invites" element={<LeagueAdminInvitesPage />} />
                    </Route>
                  </Route>
                </Route>

                {/* Admin-only routes — no LeagueProvider needed; TopBar is safe via useLeagueOptional() */}
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
