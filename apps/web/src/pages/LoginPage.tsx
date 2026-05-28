import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PinInput } from '@/components/PinInput';
import { Brand } from '@/components/Brand';
import { brand } from '@/theme/tokens';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await login(email.trim(), pin);
      navigate('/', { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      if (msg.toLowerCase().includes('locked')) {
        setError('Account locked — too many failed attempts. Try again later.');
      } else {
        setError('Invalid email or PIN.');
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
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>

              <div className="space-y-1">
                <Label>PIN</Label>
                <PinInput value={pin} onChange={setPin} />
              </div>

              {error && <p role="alert" className="text-xs text-error font-sans">{error}</p>}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Signing in…' : 'Sign in'}
              </Button>

              <div className="flex items-center justify-between text-xs font-sans text-text-muted">
                <Link to="/signup" className="hover:text-text-primary transition-colors">
                  Create account
                </Link>
                <Link to="/forgot-pin" className="hover:text-text-primary transition-colors">
                  Forgot PIN?
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
