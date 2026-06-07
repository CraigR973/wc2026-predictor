import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface Props {
  requireAdmin?: boolean;
}

export function ProtectedRoute({ requireAdmin = false }: Props) {
  const { player, biometricUnlockRequired } = useAuth();

  if (biometricUnlockRequired) {
    return <BiometricUnlockGate />;
  }

  if (!player) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && player.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

function BiometricUnlockGate() {
  const { biometricUnlockFailed, isLoading, unlockStoredSession } = useAuth();
  const navigate = useNavigate();

  const handleUnlock = async () => {
    try {
      await unlockStoredSession();
    } catch {
      // AuthContext flips biometricUnlockFailed; PIN remains available below.
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4 pt-safe pb-safe">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center text-text-primary">Unlock Calcio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-text-secondary font-sans text-center">
            Use Face ID or fingerprint to reopen your saved session. Your PIN always works too.
          </p>

          {biometricUnlockFailed && (
            <p role="alert" className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning font-sans">
              Biometric unlock was cancelled or unavailable. Sign in with your PIN instead.
            </p>
          )}

          <Button type="button" className="w-full" disabled={isLoading} onClick={() => void handleUnlock()}>
            {isLoading ? 'Checking…' : 'Unlock with Face ID / fingerprint'}
          </Button>

          <Button type="button" variant="outline" className="w-full" onClick={() => navigate('/login', { replace: true })}>
            Use PIN instead
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
