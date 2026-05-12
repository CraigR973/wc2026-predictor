import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import { apiFetch } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SyncStatus {
  last_sync_at: string | null;
  last_sync_action: string | null;
  next_run_at: string | null;
  recent_errors: { id: string; action_type: string; timestamp: string }[];
}

interface UpcomingLock {
  match_id: string;
  match_number: number;
  kickoff_utc: string;
  home_team: string | null;
  away_team: string | null;
  minutes_until_lock: number;
}

interface PendingMatch {
  match_id: string;
  match_number: number;
  status: string;
  kickoff_utc: string;
  home_team: string | null;
  away_team: string | null;
}

interface AuditEntry {
  id: string;
  action_type: string;
  actor_type: string;
  timestamp: string;
  target_table: string;
}

interface Dashboard {
  active_players: number;
  upcoming_locks: UpcomingLock[];
  pending_result_matches: PendingMatch[];
  recent_audit: AuditEntry[];
  sync_status: SyncStatus;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function syncActionLabel(action: string | null): string {
  const map: Record<string, string> = {
    result_auto_fetched: 'OK',
    sync_failed: 'Failed',
    kickoff_changed: 'Kickoff updated',
    sync_triggered: 'Manual OK',
  };
  return action ? (map[action] ?? action) : 'Never run';
}

function syncBadgeVariant(action: string | null): 'success' | 'error' | 'muted' {
  if (!action) return 'muted';
  if (action === 'sync_failed') return 'error';
  return 'success';
}

function auditActionLabel(action: string): string {
  const map: Record<string, string> = {
    result_auto_fetched: 'Result auto-fetched',
    result_manual_entered: 'Result entered',
    result_overridden: 'Result overridden',
    match_postponed: 'Match postponed',
    match_rescheduled: 'Match rescheduled',
    match_cancelled: 'Match cancelled',
    kickoff_changed: 'Kickoff changed',
    predictions_locked: 'Predictions locked',
    player_removed: 'Player removed',
    player_pin_reset: 'PIN reset',
    invite_created: 'Invite created',
    invite_revoked: 'Invite revoked',
    sync_triggered: 'Sync triggered',
    sync_failed: 'Sync failed',
  };
  return map[action] ?? action;
}

// ---------------------------------------------------------------------------
// Widget components
// ---------------------------------------------------------------------------

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs font-display tracking-wider text-text-secondary mb-1">{label}</div>
        <div className="font-display text-3xl text-primary tracking-wider">{value}</div>
        {sub && <div className="text-xs font-sans text-text-muted mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function SyncWidget({ sync }: { sync: SyncStatus }) {
  const hasErrors = sync.recent_errors.length > 0;
  return (
    <Card className={hasErrors ? 'border-error/50' : ''}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-display tracking-wider text-text-secondary">AUTO SYNC</span>
          <Badge variant={syncBadgeVariant(sync.last_sync_action)}>
            {syncActionLabel(sync.last_sync_action)}
          </Badge>
        </div>
        <div className="text-xs font-sans text-text-muted space-y-1">
          <div>
            Last run:{' '}
            <span className="text-text-primary">
              {sync.last_sync_at
                ? formatInTimeZone(new Date(sync.last_sync_at), 'UTC', 'HH:mm:ss') + ' UTC'
                : '—'}
            </span>
          </div>
          {sync.next_run_at && (
            <div>
              Next:{' '}
              <span className="text-text-primary">
                {formatInTimeZone(new Date(sync.next_run_at), 'UTC', 'HH:mm:ss')} UTC
              </span>
            </div>
          )}
          {hasErrors && (
            <div className="text-error font-medium">
              {sync.recent_errors.length} recent error{sync.recent_errors.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
        <Link to="/admin/sync" className="mt-3 block text-xs font-sans text-primary hover:underline">
          Manage sync →
        </Link>
      </CardContent>
    </Card>
  );
}

function UpcomingLocksWidget({ locks }: { locks: UpcomingLock[] }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs font-display tracking-wider text-text-secondary mb-3">
          UPCOMING LOCKS (24H)
        </div>
        {locks.length === 0 ? (
          <p className="text-text-muted text-xs font-sans">No matches locking in the next 24 hours.</p>
        ) : (
          <div className="space-y-2">
            {locks.map((m) => (
              <div key={m.match_id} className="flex items-center justify-between gap-2 text-sm">
                <span className="font-sans text-text-primary truncate">
                  {m.home_team ?? '?'} vs {m.away_team ?? '?'}
                </span>
                <Badge variant="warning" className="shrink-0">
                  {m.minutes_until_lock < 60
                    ? `${m.minutes_until_lock}m`
                    : `${Math.round(m.minutes_until_lock / 60)}h`}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PendingResultsWidget({ matches }: { matches: PendingMatch[] }) {
  return (
    <Card className={matches.length > 0 ? 'border-warning/40' : ''}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-display tracking-wider text-text-secondary">
            PENDING RESULTS
          </span>
          {matches.length > 0 && (
            <Badge variant="warning">{matches.length}</Badge>
          )}
        </div>
        {matches.length === 0 ? (
          <p className="text-text-muted text-xs font-sans">No locked/live matches awaiting results.</p>
        ) : (
          <div className="space-y-2">
            {matches.map((m) => (
              <div key={m.match_id} className="flex items-center justify-between gap-2 text-sm">
                <span className="font-sans text-text-primary truncate">
                  #{m.match_number} · {m.home_team ?? '?'} vs {m.away_team ?? '?'}
                </span>
                <Badge variant={m.status === 'live' ? 'live' : 'warning'} className="shrink-0 capitalize">
                  {m.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
        {matches.length > 0 && (
          <Link to="/admin/results" className="mt-3 block text-xs font-sans text-primary hover:underline">
            Enter results →
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

function RecentAuditWidget({ entries }: { entries: AuditEntry[] }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs font-display tracking-wider text-text-secondary mb-3">
          RECENT ACTIVITY
        </div>
        {entries.length === 0 ? (
          <p className="text-text-muted text-xs font-sans">No audit entries yet.</p>
        ) : (
          <div className="space-y-2">
            {entries.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-2">
                <span className="text-xs font-sans text-text-secondary truncate">
                  {auditActionLabel(e.action_type)}
                </span>
                <span className="text-xs font-mono text-text-muted shrink-0">
                  {formatInTimeZone(new Date(e.timestamp), 'UTC', 'HH:mm')}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function AdminDashboardPage() {
  const { data, isLoading, error } = useQuery<Dashboard>({
    queryKey: ['admin', 'dashboard'],
    queryFn: () => apiFetch<Dashboard>('/api/v1/admin/dashboard'),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  return (
    <div>
      <h1 className="font-display text-3xl text-primary tracking-wider mb-6">Admin</h1>

      {error && (
        <div className="mb-4 p-3 rounded-lg border border-error/50 bg-surface text-error text-sm font-sans">
          Failed to load dashboard data.
        </div>
      )}

      {isLoading && !data && (
        <p className="text-text-muted text-sm font-sans">Loading…</p>
      )}

      {data && (
        <>
          {/* Top stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            <StatCard
              label="ACTIVE PLAYERS"
              value={data.active_players}
            />
            <StatCard
              label="UPCOMING LOCKS"
              value={data.upcoming_locks.length}
              sub="next 24 hours"
            />
            <StatCard
              label="PENDING RESULTS"
              value={data.pending_result_matches.length}
              sub="locked/live, no result"
            />
          </div>

          {/* Widgets grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <SyncWidget sync={data.sync_status} />
            <UpcomingLocksWidget locks={data.upcoming_locks} />
            <PendingResultsWidget matches={data.pending_result_matches} />
            <RecentAuditWidget entries={data.recent_audit} />
          </div>
        </>
      )}

      {/* Admin nav links */}
      <h2 className="font-display text-sm text-text-secondary tracking-wider mb-3">MANAGE</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { to: '/admin/sync', label: 'Sync' },
          { to: '/admin/results', label: 'Results' },
          { to: '/admin/players', label: 'Players' },
          { to: '/admin/invites', label: 'Invites' },
        ].map(({ to, label }) => (
          <Link
            key={to}
            to={to}
            className="block p-3 rounded-lg border border-border bg-surface hover:bg-surface-elevated transition-colors text-center"
          >
            <p className="font-display text-base text-primary tracking-wider">{label}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
