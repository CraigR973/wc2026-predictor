import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { JoinPage } from './pages/JoinPage';
import { AdminInvitesPage } from './pages/admin/InvitesPage';
import { AdminPlayersPage } from './pages/admin/PlayersPage';
import { useAuth } from './contexts/AuthContext';

function Dashboard() {
  const { player, logout } = useAuth();
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-display text-4xl text-primary tracking-wider">WC 2026 PREDICTOR</h1>
          <button
            onClick={logout}
            className="text-sm text-text-secondary hover:text-text-primary font-sans transition-colors"
          >
            Sign out
          </button>
        </div>
        <p className="text-text-secondary font-sans">
          Welcome, <span className="text-text-primary font-medium">{player?.displayName}</span>
          {player?.role === 'admin' && (
            <span className="ml-2 text-xs text-primary font-mono">[admin]</span>
          )}
        </p>
        {player?.role === 'admin' && (
          <div className="mt-6 p-4 rounded-lg border border-border bg-surface flex gap-4">
            <a href="/admin/invites" className="text-sm text-primary hover:underline font-sans">
              Manage invites
            </a>
            <a href="/admin/players" className="text-sm text-primary hover:underline font-sans">
              Manage players
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/join/:token" element={<JoinPage />} />

          {/* Player routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Dashboard />} />
          </Route>

          {/* Admin-only routes */}
          <Route element={<ProtectedRoute requireAdmin />}>
            <Route path="/admin/invites" element={<AdminInvitesPage />} />
            <Route path="/admin/players" element={<AdminPlayersPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
