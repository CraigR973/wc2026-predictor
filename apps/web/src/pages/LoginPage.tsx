import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await login(displayName.trim(), pin);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-5xl text-primary tracking-wider">WC 2026</h1>
          <p className="text-text-secondary mt-1 font-sans text-sm">Prediction League</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-center text-text-primary">Sign in</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label htmlFor="displayName" className="text-xs text-text-secondary font-sans">
                  Name
                </label>
                <input
                  id="displayName"
                  type="text"
                  autoComplete="username"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-text-primary font-sans text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Your display name"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="pin" className="text-xs text-text-secondary font-sans">
                  PIN
                </label>
                <input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="current-password"
                  required
                  maxLength={8}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-text-primary font-sans text-sm focus:outline-none focus:ring-2 focus:ring-primary tracking-widest"
                  placeholder="••••"
                />
              </div>

              {error && (
                <p className="text-xs text-error font-sans">{error}</p>
              )}

              <Button
                type="submit"
                variant="default"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
