import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { JoinPage } from './pages/JoinPage';
import { SchedulePage } from './pages/SchedulePage';
import { GroupsPage } from './pages/GroupsPage';
import { GroupDetailPage } from './pages/GroupDetailPage';
import { AdminInvitesPage } from './pages/admin/InvitesPage';
import { AdminPlayersPage } from './pages/admin/PlayersPage';
import { AdminDashboardPage } from './pages/admin/DashboardPage';
import { AdminSyncPage } from './pages/admin/SyncPage';
import { AdminResultsPage } from './pages/admin/ResultsPage';
import { PredictionsPage } from './pages/PredictionsPage';
import { KnockoutPredictionsPage } from './pages/KnockoutPredictionsPage';
import { SpecialsPage } from './pages/SpecialsPage';
import { BracketPage } from './pages/BracketPage';
import { MatchDetailPage } from './pages/MatchDetailPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { LeaderboardHistoryPage } from './pages/LeaderboardHistoryPage';
import { RoundLeaderboardPage } from './pages/RoundLeaderboardPage';
import { PlayerProfilePage } from './pages/PlayerProfilePage';
import { ComparePage } from './pages/ComparePage';
import { OfflinePage } from './pages/OfflinePage';
import { SettingsPage } from './pages/SettingsPage';
import { useAuth } from './contexts/AuthContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Dashboard() {
  const { player } = useAuth();
  return (
    <div>
      <h1 className="font-display text-4xl text-primary tracking-wider mb-4">WC 2026 PREDICTOR</h1>
      <p className="text-text-secondary font-sans">
        Welcome back, <span className="text-text-primary font-medium">{player?.displayName}</span>!
      </p>
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <a
          href="/predictions"
          className="block p-4 rounded-lg border border-border bg-surface hover:bg-surface-elevated transition-colors"
        >
          <p className="font-display text-xl text-primary tracking-wider">Predictions</p>
          <p className="text-text-muted text-sm font-sans mt-1">Submit your match scores</p>
        </a>
        <a
          href="/predictions/knockout"
          className="block p-4 rounded-lg border border-border bg-surface hover:bg-surface-elevated transition-colors"
        >
          <p className="font-display text-xl text-primary tracking-wider">Knockout Picks</p>
          <p className="text-text-muted text-sm font-sans mt-1">Pick winners for each round</p>
        </a>
        <a
          href="/predictions/specials"
          className="block p-4 rounded-lg border border-border bg-surface hover:bg-surface-elevated transition-colors"
        >
          <p className="font-display text-xl text-primary tracking-wider">Specials</p>
          <p className="text-text-muted text-sm font-sans mt-1">Tournament winner, Golden Boot, top scorer</p>
        </a>
        <a
          href="/schedule"
          className="block p-4 rounded-lg border border-border bg-surface hover:bg-surface-elevated transition-colors"
        >
          <p className="font-display text-xl text-primary tracking-wider">Schedule</p>
          <p className="text-text-muted text-sm font-sans mt-1">Browse all 104 matches</p>
        </a>
        <a
          href="/groups"
          className="block p-4 rounded-lg border border-border bg-surface hover:bg-surface-elevated transition-colors"
        >
          <p className="font-display text-xl text-primary tracking-wider">Groups</p>
          <p className="text-text-muted text-sm font-sans mt-1">Live group standings</p>
        </a>
        <a
          href="/compare"
          className="block p-4 rounded-lg border border-border bg-surface hover:bg-surface-elevated transition-colors"
        >
          <p className="font-display text-xl text-primary tracking-wider">Compare</p>
          <p className="text-text-muted text-sm font-sans mt-1">Head-to-head between any two players</p>
        </a>
      </div>
    </div>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Toaster position="bottom-right" richColors closeButton />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/join/:token" element={<JoinPage />} />

            {/* Player routes — wrapped in Layout (NavBar + main) */}
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/" element={<Dashboard />} />
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
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
