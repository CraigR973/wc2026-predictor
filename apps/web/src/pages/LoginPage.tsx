import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const BASE = import.meta.env.VITE_API_URL ?? '';

interface PlayerName {
  id: string;
  display_name: string;
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [players, setPlayers] = useState<PlayerName[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetch(`${BASE}/api/v1/players/names`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: PlayerName[]) => {
        setPlayers(data);
        if (data.length > 0) setDisplayName(data[0].display_name);
      })
      .catch(() => {
        // Fall back to text input — players state stays empty
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await login(displayName.trim(), pin);
      navigate('/', { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      if (msg.toLowerCase().includes('locked')) {
        setError('Account locked — too many failed attempts. Try again later.');
      } else {
        setError('Invalid name or PIN.');
      }
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
                <Label htmlFor="displayName">Name</Label>
                {players.length > 0 ? (
                  <select
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary font-sans focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  >
                    {players.map((p) => (
                      <option key={p.id} value={p.display_name}>
                        {p.display_name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    id="displayName"
                    type="text"
                    autoComplete="username"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your display name"
                  />
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="pin">PIN</Label>
                <Input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="current-password"
                  required
                  maxLength={8}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="tracking-widest"
                />
              </div>

              {error && <p role="alert" className="text-xs text-error font-sans">{error}</p>}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
