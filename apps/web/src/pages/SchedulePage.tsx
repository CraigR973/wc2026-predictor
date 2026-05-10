import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import { apiFetch } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import type { MatchResponse } from '../lib/types';
import { Badge } from '../components/ui/badge';
import { useCountdown } from '../hooks/useCountdown';

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

type StatusVariant = 'default' | 'success' | 'error' | 'muted' | 'accent' | 'warning' | 'live';

const STATUS_LABEL: Record<MatchResponse['status'], string> = {
  scheduled: 'Scheduled',
  locked: 'Locked',
  live: 'Live',
  completed: 'FT',
  postponed: 'Postponed',
  cancelled: 'Cancelled',
};

const STATUS_VARIANT: Record<MatchResponse['status'], StatusVariant> = {
  scheduled: 'muted',
  locked: 'warning',
  live: 'live',
  completed: 'success',
  postponed: 'warning',
  cancelled: 'error',
};


// ---------------------------------------------------------------------------
// Countdown display
// ---------------------------------------------------------------------------

function Countdown({ kickoffUtc }: { kickoffUtc: string }) {
  const { days, hours, minutes, seconds, expired } = useCountdown(kickoffUtc);
  if (expired) return null;
  const parts =
    days > 0
      ? `${days}d ${hours}h ${minutes}m`
      : hours > 0
        ? `${hours}h ${minutes}m ${seconds}s`
        : `${minutes}m ${seconds}s`;
  return (
    <span className="text-xs font-mono text-text-muted tabular-nums">
      {parts}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Match card
// ---------------------------------------------------------------------------

function MatchCard({ match, timezone }: { match: MatchResponse; timezone: string }) {
  const kickoffLocal = formatInTimeZone(
    new Date(match.kickoff_utc),
    timezone,
    'HH:mm',
  );

  const homeLabel = match.home_team
    ? `${match.home_team.flag_emoji} ${match.home_team.code}`
    : match.home_team_placeholder ?? '?';
  const awayLabel = match.away_team
    ? `${match.away_team.flag_emoji} ${match.away_team.code}`
    : match.away_team_placeholder ?? '?';

  const isResult =
    match.status === 'completed' &&
    match.actual_home_score !== null &&
    match.actual_away_score !== null;

  const isPostponedOrCancelled =
    match.status === 'postponed' || match.status === 'cancelled';

  return (
    <div
      className={`rounded-lg border bg-surface p-3 flex items-center gap-3 ${
        isPostponedOrCancelled ? 'opacity-60' : ''
      }`}
    >
      {/* Kickoff time */}
      <div className="w-12 text-center shrink-0">
        <p className="text-sm font-mono text-text-primary font-medium">{kickoffLocal}</p>
        {match.status === 'scheduled' && (
          <Countdown kickoffUtc={match.kickoff_utc} />
        )}
      </div>

      {/* Teams */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`text-sm font-sans truncate ${
              isResult && match.actual_home_score! > match.actual_away_score!
                ? 'text-text-primary font-semibold'
                : 'text-text-secondary'
            }`}
          >
            {homeLabel}
          </span>

          {isResult ? (
            <span className="font-mono text-sm font-bold text-text-primary tabular-nums shrink-0">
              {match.actual_home_score} – {match.actual_away_score}
            </span>
          ) : (
            <span className="text-xs text-text-muted font-mono shrink-0">vs</span>
          )}

          <span
            className={`text-sm font-sans truncate text-right ${
              isResult && match.actual_away_score! > match.actual_home_score!
                ? 'text-text-primary font-semibold'
                : 'text-text-secondary'
            }`}
          >
            {awayLabel}
          </span>
        </div>

        <div className="flex items-center gap-2 mt-1">
          {match.venue && (
            <span className="text-xs text-text-muted font-sans truncate">{match.venue}</span>
          )}
          {match.penalties && (
            <span className="text-xs text-text-muted font-mono">(pens)</span>
          )}
          {match.extra_time && !match.penalties && (
            <span className="text-xs text-text-muted font-mono">(aet)</span>
          )}
        </div>
      </div>

      {/* Status */}
      <div className="shrink-0">
        <Badge variant={STATUS_VARIANT[match.status]}>
          {STATUS_LABEL[match.status]}
        </Badge>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Group header for a date section
// ---------------------------------------------------------------------------

function DateSection({
  dateLabel,
  matches,
  timezone,
}: {
  dateLabel: string;
  matches: MatchResponse[];
  timezone: string;
}) {
  return (
    <section>
      <h2 className="text-sm font-mono text-text-muted uppercase tracking-wider mb-3 pt-4 border-t border-border first:border-t-0 first:pt-0">
        {dateLabel}
      </h2>
      <div className="flex flex-col gap-2">
        {matches.map((m) => (
          <MatchCard key={m.id} match={m} timezone={timezone} />
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Schedule page
// ---------------------------------------------------------------------------

const STAGES = [
  { value: '', label: 'All stages' },
  { value: 'group', label: 'Group stage' },
  { value: 'r32', label: 'Round of 32' },
  { value: 'r16', label: 'Round of 16' },
  { value: 'qf', label: 'Quarter-finals' },
  { value: 'sf', label: 'Semi-finals' },
  { value: 'third_place', label: 'Third place' },
  { value: 'final', label: 'Final' },
];

export function SchedulePage() {
  const { player } = useAuth();
  const timezone = player?.timezone ?? 'UTC';

  const [stageFilter, setStageFilter] = useState('');

  const { data, isLoading, error } = useQuery<MatchResponse[]>({
    queryKey: ['matches', stageFilter],
    queryFn: () =>
      apiFetch<MatchResponse[]>(
        `/api/v1/matches${stageFilter ? `?stage=${stageFilter}` : ''}`,
      ),
    staleTime: 30_000,
  });

  const matches = data ?? [];

  // Group by local date
  const byDate = new Map<string, MatchResponse[]>();
  for (const m of matches) {
    const dateKey = formatInTimeZone(new Date(m.kickoff_utc), timezone, 'EEE d MMM yyyy');
    const bucket = byDate.get(dateKey) ?? [];
    bucket.push(m);
    byDate.set(dateKey, bucket);
  }

  return (
    <div>
      <h1 className="font-display text-3xl text-primary tracking-wider mb-4">Schedule</h1>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="bg-surface border border-border rounded-md px-3 py-1.5 text-sm font-sans text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {STAGES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {isLoading && (
        <p className="text-text-muted font-sans text-sm">Loading matches…</p>
      )}
      {error && (
        <p className="text-error font-sans text-sm">Failed to load matches.</p>
      )}

      {!isLoading && !error && byDate.size === 0 && (
        <p className="text-text-muted font-sans text-sm">No matches found.</p>
      )}

      <div className="flex flex-col gap-6">
        {Array.from(byDate.entries()).map(([dateLabel, dayMatches]) => (
          <DateSection
            key={dateLabel}
            dateLabel={dateLabel}
            matches={dayMatches}
            timezone={timezone}
          />
        ))}
      </div>
    </div>
  );
}
