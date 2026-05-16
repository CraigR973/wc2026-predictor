import { useCallback, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, BellOff, Download, Send, Check } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '../lib/api';
import { usePushSubscription } from '../hooks/usePushSubscription';
import { useInstallPrompt } from '../hooks/useInstallPrompt';

// ── Types ─────────────────────────────────────────────────────────────────────

interface NotificationPreferences {
  deadline_warning: boolean;
  match_locked: boolean;
  result_detected: boolean;
  leaderboard_shift: boolean;
  round_complete: boolean;
  match_postponed: boolean;
  special_results: boolean;
  global_mute: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Array<{ key: keyof NotificationPreferences; label: string }> = [
  { key: 'deadline_warning', label: 'Deadline warning (15 min before kickoff)' },
  { key: 'match_locked', label: 'Predictions locked' },
  { key: 'result_detected', label: 'Match result posted' },
  { key: 'leaderboard_shift', label: 'Leaderboard rank change' },
  { key: 'round_complete', label: 'Round complete' },
  { key: 'match_postponed', label: 'Match postponed' },
  { key: 'special_results', label: 'Special prediction results' },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <h2 className="font-display text-lg text-primary tracking-wider mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer py-2">
      <span className="text-sm font-sans text-text-primary">{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          checked ? 'bg-primary' : 'bg-border'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </label>
  );
}

// ── Push notifications section ────────────────────────────────────────────────

function PushSection() {
  const { permission, isSubscribed, isLoading, subscribe, unsubscribe } = usePushSubscription();
  const [testing, setTesting] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    try {
      await apiFetch('/api/v1/push/test', { method: 'POST' });
      toast.success('Test notification sent — check your device');
    } catch {
      toast.error('Failed to send test notification');
    } finally {
      setTesting(false);
    }
  };

  const notSupported =
    typeof window !== 'undefined' &&
    (!('serviceWorker' in navigator) || !('PushManager' in window));

  if (notSupported) {
    return (
      <p className="text-sm text-text-muted font-sans">
        Push notifications are not supported in this browser.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-sans text-text-primary">
            {isSubscribed ? 'Notifications enabled' : 'Notifications disabled'}
          </p>
          {permission === 'denied' && (
            <p className="text-xs text-text-muted mt-0.5">
              Permission blocked — allow notifications in browser settings
            </p>
          )}
        </div>
        <button
          onClick={isSubscribed ? unsubscribe : subscribe}
          disabled={isLoading || permission === 'denied'}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-sans transition-colors border border-border hover:bg-surface-elevated disabled:opacity-50"
        >
          {isSubscribed ? <BellOff size={14} /> : <Bell size={14} />}
          {isSubscribed ? 'Unsubscribe' : 'Subscribe'}
        </button>
      </div>
      {isSubscribed && (
        <button
          onClick={handleTest}
          disabled={testing}
          data-testid="test-push-btn"
          className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-sans border border-border hover:bg-surface-elevated disabled:opacity-50 transition-colors"
        >
          <Send size={14} />
          {testing ? 'Sending…' : 'Send test notification'}
        </button>
      )}
    </div>
  );
}

// ── PWA install section ───────────────────────────────────────────────────────

function InstallSection() {
  const { canInstall, isInstalled, isIosSafari, prompt } = useInstallPrompt();

  if (isInstalled) {
    return (
      <div className="flex items-center gap-2 text-sm text-text-secondary font-sans">
        <Check size={16} className="text-primary" />
        App is already installed
      </div>
    );
  }

  if (isIosSafari) {
    return (
      <p className="text-sm text-text-secondary font-sans">
        Tap the <strong>Share</strong> button in Safari, then choose{' '}
        <strong>Add to Home Screen</strong>.
      </p>
    );
  }

  if (!canInstall) {
    return (
      <p className="text-sm text-text-muted font-sans">
        Install prompt not available. Use your browser's install option if supported.
      </p>
    );
  }

  return (
    <button
      onClick={prompt}
      className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-sans border border-border hover:bg-surface-elevated transition-colors"
    >
      <Download size={14} />
      Install app
    </button>
  );
}

// ── Preferences section ───────────────────────────────────────────────────────

function PreferencesSection() {
  const queryClient = useQueryClient();

  const { data: prefs, isLoading } = useQuery<NotificationPreferences>({
    queryKey: ['notification-preferences'],
    queryFn: () => apiFetch('/api/v1/notifications/preferences'),
  });

  const mutation = useMutation({
    mutationFn: (patch: Partial<NotificationPreferences>) =>
      apiFetch<NotificationPreferences>('/api/v1/notifications/preferences', {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['notification-preferences'], updated);
    },
    onError: () => toast.error('Failed to save preferences'),
  });

  const update = useCallback(
    (patch: Partial<NotificationPreferences>) => mutation.mutate(patch),
    [mutation],
  );

  if (isLoading || !prefs) {
    return <p className="text-sm text-text-muted font-sans">Loading…</p>;
  }

  const muted = prefs.global_mute;

  return (
    <div className="space-y-1">
      <Toggle
        checked={!muted}
        onChange={(v) => update({ global_mute: !v })}
        label="Enable all notifications"
      />

      <div className={`pl-4 border-l border-border space-y-0 ${muted ? 'opacity-50' : ''}`}>
        {CATEGORY_LABELS.map(({ key, label }) => (
          <Toggle
            key={key}
            checked={prefs[key] as boolean}
            onChange={(v) => update({ [key]: v })}
            label={label}
            disabled={muted}
          />
        ))}
      </div>

      <div className="pt-3 border-t border-border">
        <p className="text-sm font-sans text-text-secondary mb-2">Quiet hours (no notifications)</p>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-sans text-text-secondary">
            From
            <input
              type="time"
              value={prefs.quiet_hours_start ?? ''}
              disabled={muted}
              onChange={(e) => update({ quiet_hours_start: e.target.value || '' })}
              className="rounded-md border border-border bg-surface-elevated px-2 py-1 text-sm font-mono text-text-primary disabled:opacity-50"
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-sans text-text-secondary">
            To
            <input
              type="time"
              value={prefs.quiet_hours_end ?? ''}
              disabled={muted}
              onChange={(e) => update({ quiet_hours_end: e.target.value || '' })}
              className="rounded-md border border-border bg-surface-elevated px-2 py-1 text-sm font-mono text-text-primary disabled:opacity-50"
            />
          </label>
          {(prefs.quiet_hours_start || prefs.quiet_hours_end) && (
            <button
              onClick={() => update({ quiet_hours_start: '', quiet_hours_end: '' })}
              disabled={muted}
              className="text-xs text-text-muted hover:text-text-primary disabled:opacity-50"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function SettingsPage() {
  return (
    <div className="max-w-xl space-y-6">
      <h1 className="font-display text-3xl text-primary tracking-wider">Settings</h1>

      <SectionCard title="Push Notifications">
        <PushSection />
      </SectionCard>

      <SectionCard title="Notification Preferences">
        <PreferencesSection />
      </SectionCard>

      <SectionCard title="Install App">
        <InstallSection />
      </SectionCard>
    </div>
  );
}
