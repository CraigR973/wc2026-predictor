import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PinInput } from '@/components/PinInput';
import { Brand } from '@/components/Brand';
import { brand } from '@/theme/tokens';

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
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-4 pt-safe pb-safe">
      <div className="w-full max-w-sm">
        <div className="mb-10">
          <Brand variant="splash" />
          {/* Robinson's partnership gag */}
          <div className="mt-8 flex flex-col items-center gap-2">
            <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-muted">
              In partnership with
            </p>
            <img
              src="/robinsons-logo.png"
              alt="Robinson's"
              className="h-10 w-auto object-contain opacity-80"
              draggable={false}
            />
          </div>

          <p className="text-center text-text-primary mt-6 font-sans text-base sm:text-lg italic">
            {brand.tagline}
          </p>
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
                  <Select value={displayName} onValueChange={setDisplayName} required>
                    <SelectTrigger id="displayName">
                      <SelectValue placeholder="Select your name" />
                    </SelectTrigger>
                    <SelectContent>
                      {players.map((p) => (
                        <SelectItem key={p.id} value={p.display_name}>
                          {p.display_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                <Label>PIN</Label>
                <PinInput value={pin} onChange={setPin} />
              </div>

              {error && <p role="alert" className="text-xs text-error font-sans">{error}</p>}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Signing in…' : 'Sign in'}
              </Button>

              <p className="text-xs text-text-muted font-sans text-center">
                Forgot your PIN? Ask your league admin for a reset.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
