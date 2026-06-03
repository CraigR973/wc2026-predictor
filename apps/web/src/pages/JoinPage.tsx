import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Share, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Brand } from '@/components/Brand';
import { PinInput } from '@/components/PinInput';
import { brand } from '@/theme/tokens';
import { useAuth } from '@/contexts/AuthContext';
import { getAccessToken } from '@/lib/tokens';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';

const BASE = import.meta.env.VITE_API_URL ?? '';
const INSTALL_DISMISS_KEY = 'sss_join_install_dismissed';

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

// A join code is exactly 6 uppercase alphanumeric chars.
// Invite tokens from generate_opaque_token() are 43-char base64url strings.
// The length difference makes them trivially distinguishable.
const JOIN_CODE_RE = /^[A-Z0-9]{6}$/;
function isJoinCode(token: string): boolean {
  return JOIN_CODE_RE.test(token.toUpperCase());
}

interface LeaguePreview {
  name: string;
  member_count: number;
  max_members: number;
  privacy: string;
}

export function JoinPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { player } = useAuth();
  const { isInstalled, isIosSafari, canInstall, prompt: triggerInstall } = useInstallPrompt();

  const useCode = !!token && isJoinCode(token);

  const [inviteState, setInviteState] = useState<InviteState>('loading');
  const [inviteError, setInviteError] = useState('');
  const [leagueHint, setLeagueHint] = useState('');
  const [leaguePreview, setLeaguePreview] = useState<LeaguePreview | null>(null);

  const [installDismissed, setInstallDismissed] = useState(
    () => !!localStorage.getItem(INSTALL_DISMISS_KEY),
  );

  // Unauthenticated create-account form state
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

    if (useCode) {
      // Join-by-code path: look up league preview (public endpoint, no auth needed)
      fetch(`${BASE}/api/v1/leagues/by-code/${encodeURIComponent(token.toUpperCase())}`)
        .then(async (r) => {
          if (!r.ok) throw new Error('Invalid join code');
          return r.json() as Promise<LeaguePreview>;
        })
        .then((data) => {
          setLeaguePreview(data);
          setLeagueHint(data.name);
          setInviteState('valid');
        })
        .catch(() => {
          setInviteState('error');
          setInviteError('This join code is invalid or the league no longer exists.');
        });
      return;
    }

    // Original invite-token path
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
  }, [token, useCode]);

  function dismissInstall() {
    localStorage.setItem(INSTALL_DISMISS_KEY, '1');
    setInstallDismissed(true);
  }

  // Authenticated path — join by code or claim single-use invite
  async function handleAuthenticatedClaim() {
    setError('');
    setIsSubmitting(true);
    try {
      const accessToken = getAccessToken();

      if (useCode) {
        const resp = await fetch(`${BASE}/api/v1/leagues/join-by-code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ code: token!.toUpperCase() }),
        });
        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}));
          const detail = body.detail ?? 'Failed to join league';
          if (detail === 'ALREADY_MEMBER') throw new Error('You are already a member of this league.');
          if (detail === 'LEAGUE_FULL') throw new Error('This league is full.');
          throw new Error(detail);
        }
        const data = await resp.json() as { league_slug: string; league_name: string };
        navigate(`/leagues/${data.league_slug}`, { replace: true });
        return;
      }

      const resp = await fetch(`${BASE}/api/v1/leagues/claim-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ token }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        const detail = body.detail ?? 'Failed to join league';
        if (detail === 'ALREADY_MEMBER') throw new Error('You are already a member of this league.');
        if (detail === 'LEAGUE_FULL') throw new Error('This league is full.');
        throw new Error(detail);
      }
      const data = await resp.json() as { league_slug: string; league_name: string };
      setLeagueHint(data.league_name);
      navigate(`/leagues/${data.league_slug}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join league');
      setIsSubmitting(false);
    }
  }

  // Unauthenticated path — create account then join
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (pin.length !== 4) {
      setError('PIN must be exactly 4 digits.');
      return;
    }
    if (pin !== pinConfirm) {
      setError('PINs do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const endpoint = useCode ? `${BASE}/api/v1/auth/join-by-code` : `${BASE}/api/v1/auth/join`;
      const payload = useCode
        ? { code: token!.toUpperCase(), display_name: displayName.trim(), pin, timezone }
        : { token, display_name: displayName.trim(), pin, timezone };

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.detail ?? 'Join failed');
      }
      const data = await resp.json();
      const { storeTokens } = await import('@/lib/tokens');
      storeTokens(data.access_token, data.refresh_token, {
        id: data.player.id,
        displayName: data.player.display_name,
        role: data.player.role,
        timezone: data.player.timezone,
      });
      window.location.href = '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Join failed');
      setIsSubmitting(false);
    }
  }

  const showInstallNudge = !isInstalled && !installDismissed && (canInstall || isIosSafari);

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-4 pt-safe pb-safe">
      <div className="w-full max-w-sm space-y-6">
        <div className="mb-2">
          <Brand variant="splash" />
          <p className="text-center text-text-primary mt-6 font-sans text-base sm:text-lg italic">
            {brand.tagline}
          </p>
          <p className="text-center text-text-secondary font-sans text-sm mt-2">
            World Cup 2026 prediction league — pick scores, climb the table.
          </p>
        </div>

        {inviteState === 'loading' && (
          <p className="text-center text-text-secondary font-sans text-sm">Checking invite…</p>
        )}

        {inviteState === 'error' && (
          <Card>
            <CardContent className="pt-6">
              <p role="alert" className="text-center text-error font-sans text-sm">{inviteError}</p>
              <p className="text-center text-text-muted font-sans text-xs mt-2">
                Ask the league admin to share a new join code or invite link.
              </p>
            </CardContent>
          </Card>
        )}

        {inviteState === 'valid' && player && (
          <Card>
            <CardHeader>
              <CardTitle className="text-center text-text-primary">
                {leagueHint ? `Join ${leagueHint}?` : 'Join the league'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {leaguePreview && (
                <p className="text-sm text-text-muted font-sans text-center">
                  {leaguePreview.member_count} / {leaguePreview.max_members} members
                </p>
              )}
              <p className="text-sm text-text-secondary font-sans text-center">
                You&apos;re signed in as <strong>{player.displayName}</strong>.
              </p>
              {error && <p role="alert" className="text-xs text-error font-sans">{error}</p>}
              <Button className="w-full" onClick={handleAuthenticatedClaim} disabled={isSubmitting}>
                {isSubmitting ? 'Joining…' : 'Join league'}
              </Button>
            </CardContent>
          </Card>
        )}

        {inviteState === 'valid' && !player && (
          <Card>
            <CardHeader>
              <CardTitle className="text-center text-text-primary">
                {leagueHint ? `Join ${leagueHint}` : 'Join the league'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {leaguePreview && (
                <p className="text-sm text-text-muted font-sans text-center mb-4">
                  {leaguePreview.member_count} / {leaguePreview.max_members} members
                </p>
              )}
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
                  <Label>Choose a 4-digit PIN</Label>
                  <PinInput value={pin} onChange={setPin} maxLength={4} autoComplete="new-password" />
                </div>

                <div className="space-y-1">
                  <Label>Confirm PIN</Label>
                  <PinInput value={pinConfirm} onChange={setPinConfirm} maxLength={4} autoComplete="new-password" label="Confirm PIN" />
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

        {/* "Already have the app?" hint for code path */}
        {inviteState === 'valid' && useCode && !player && (
          <p className="text-center text-text-muted font-sans text-xs">
            Already have the app? Open it, tap <strong>Leagues → Join by code</strong> and enter{' '}
            <span className="font-mono font-semibold text-text-secondary">{token?.toUpperCase()}</span>.
          </p>
        )}

        {/* Install affordance — only when not already running as installed PWA */}
        {showInstallNudge && (
          <div className="rounded-xl border border-border bg-surface px-4 py-4 relative">
            <button
              onClick={dismissInstall}
              aria-label="Dismiss"
              className="absolute top-2.5 right-3 p-1 rounded text-text-muted hover:text-text-secondary transition-colors"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>

            <div className="pr-6 space-y-3">
              <div>
                <p className="text-sm font-sans font-semibold text-text-primary">Get the app for the best experience</p>
                <p className="text-xs text-text-muted font-sans mt-1 leading-relaxed">
                  The Steele Spreadsheet System is a World Cup 2026 prediction league — pick scores match by match as the tournament unfolds. No bracket to fill in upfront, just predict each game before kick-off and see who tops the table.
                </p>
              </div>

              {/* Platform-specific install step */}
              {canInstall && (
                <Button size="sm" variant="outline" className="gap-1.5 w-full" onClick={triggerInstall}>
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Add to home screen
                </Button>
              )}

              {/* Numbered steps */}
              <ol className="space-y-2 text-xs font-sans text-text-secondary">
                {isIosSafari && !canInstall && (
                  <li className="flex items-start gap-2">
                    <span className="shrink-0 font-mono text-primary font-semibold">1.</span>
                    <span>
                      In Safari, tap{' '}
                      <Share className="inline h-3 w-3 text-[#007AFF] align-text-bottom" aria-hidden />{' '}
                      <strong>Share → Add to Home Screen</strong>
                    </span>
                  </li>
                )}
                <li className="flex items-start gap-2">
                  <span className="shrink-0 font-mono text-primary font-semibold">
                    {isIosSafari && !canInstall ? '2.' : canInstall ? '1.' : '1.'}
                  </span>
                  <span>Open the app from your home screen</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="shrink-0 font-mono text-primary font-semibold">
                    {isIosSafari && !canInstall ? '3.' : canInstall ? '2.' : '2.'}
                  </span>
                  <span>
                    Tap <strong>Leagues → Join by code</strong> and enter{' '}
                    {useCode
                      ? <span className="font-mono font-semibold text-primary">{token!.toUpperCase()}</span>
                      : 'your join code'
                    }
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="shrink-0 font-mono text-primary font-semibold">
                    {isIosSafari && !canInstall ? '4.' : canInstall ? '3.' : '3.'}
                  </span>
                  <span>Before the tournament starts, go to <strong>Predict → Specials</strong> to lock in your tournament award picks</span>
                </li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
