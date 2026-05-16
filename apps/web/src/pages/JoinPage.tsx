import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const BASE = import.meta.env.VITE_API_URL ?? '';

const TIMEZONES = [
  'Europe/London',
  'Europe/Dublin',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Rome',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Vancouver',
  'America/Mexico_City',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Pacific/Auckland',
  'UTC',
];

type InviteState = 'loading' | 'valid' | 'error';

export function JoinPage() {
  const { token } = useParams<{ token: string }>();

  const [inviteState, setInviteState] = useState<InviteState>('loading');
  const [inviteError, setInviteError] = useState('');

  const [displayName, setDisplayName] = useState('');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  );
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setInviteState('error');
      setInviteError('No invite token provided.');
      return;
    }
    fetch(`${BASE}/api/v1/auth/invite/${token}`)
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.detail ?? 'Invalid invite');
        }
        return r.json();
      })
      .then((data: { display_name_hint: string | null }) => {
        if (data.display_name_hint) setDisplayName(data.display_name_hint);
        setInviteState('valid');
      })
      .catch((err: Error) => {
        setInviteState('error');
        setInviteError(err.message);
      });
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (pin.length < 4) {
      setError('PIN must be at least 4 digits.');
      return;
    }
    if (pin !== pinConfirm) {
      setError('PINs do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const resp = await fetch(`${BASE}/api/v1/auth/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          display_name: displayName.trim(),
          pin,
          timezone,
        }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.detail ?? 'Join failed');
      }
      const data = await resp.json();
      // Manually store the tokens the same way login does
      const { storeTokens } = await import('@/lib/tokens');
      storeTokens(data.access_token, data.refresh_token, {
        id: data.player.id,
        displayName: data.player.display_name,
        role: data.player.role,
        timezone: data.player.timezone,
      });
      // Trigger an auth context refresh via login-less navigation
      // (tokens are stored; a full-page navigate forces AuthProvider to re-read)
      window.location.href = '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Join failed');
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-5xl text-primary tracking-wider">WC 2026</h1>
          <p className="text-text-secondary mt-1 font-sans text-sm">Prediction League</p>
        </div>

        {inviteState === 'loading' && (
          <p className="text-center text-text-secondary font-sans text-sm">Checking invite…</p>
        )}

        {inviteState === 'error' && (
          <Card>
            <CardContent className="pt-6">
              <p role="alert" className="text-center text-error font-sans text-sm">{inviteError}</p>
              <p className="text-center text-text-muted font-sans text-xs mt-2">
                Ask the admin for a new invite link.
              </p>
            </CardContent>
          </Card>
        )}

        {inviteState === 'valid' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-center text-text-primary">Join the league</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="displayName">Display name</Label>
                  <Input
                    id="displayName"
                    type="text"
                    autoComplete="username"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="pin">Choose a PIN (4–8 digits)</Label>
                  <Input
                    id="pin"
                    type="password"
                    inputMode="numeric"
                    autoComplete="new-password"
                    required
                    minLength={4}
                    maxLength={8}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    className="tracking-widest"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="pinConfirm">Confirm PIN</Label>
                  <Input
                    id="pinConfirm"
                    type="password"
                    inputMode="numeric"
                    autoComplete="new-password"
                    required
                    minLength={4}
                    maxLength={8}
                    value={pinConfirm}
                    onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    className="tracking-widest"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="timezone">Your timezone</Label>
                  <select
                    id="timezone"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="flex h-10 w-full items-center rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary font-sans focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>

                {error && <p role="alert" className="text-xs text-error font-sans">{error}</p>}

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? 'Joining…' : 'Join league'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
