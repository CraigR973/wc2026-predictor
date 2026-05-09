import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
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
          <div className="mt-6 p-4 rounded-lg border border-border bg-surface">
            <p className="text-xs text-text-muted font-sans">Admin panel — coming in Phase 2</p>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminPanel() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="font-display text-4xl text-primary">Admin</h1>
        <p className="text-text-secondary font-sans mt-4">Admin-only area — coming in Phase 2</p>
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

          {/* Player routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Dashboard />} />
          </Route>

          {/* Admin-only routes */}
          <Route element={<ProtectedRoute requireAdmin />}>
            <Route path="/admin" element={<AdminPanel />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
