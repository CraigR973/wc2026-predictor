import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import { apiFetch } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import type { MatchResponse } from '../lib/types';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { useCountdown } from '../hooks/useCountdown';
import { cn } from '../lib/utils';

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

function Countdown({ kickoffUtc }: { kickoffUtc: string }) {
  const { days, hours, minutes, seconds, expired } = useCountdown(kickoffUtc);
  if (expired) return null;
  const parts =
    days > 0
      ? `${days}d ${hours}h`
      : hours > 0
        ? `${hours}h ${minutes}m`
        : `${minutes}m ${seconds}s`;
  return (
    <span className="text-[10px] font-mono text-text-muted tabular-nums tracking-tight">
      {parts}
    </span>
  );
}

function MatchCard({ match, timezone }: { match: MatchResponse; timezone: string }) {
  const kickoffLocal = formatInTimeZone(new Date(match.kickoff_utc), timezone, 'HH:mm');

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

  const homeWon = isResult && match.actual_home_score! > match.actual_away_score!;
  const awayWon = isResult && match.actual_away_score! > match.actual_home_score!;

  return (
    <Link
      to={`/matches/${match.id}`}
      className={cn(
        'rounded-lg border border-border bg-surface px-3 py-3 flex items-center gap-3',
        'hover:bg-surface-elevated transition-colors press-down focus-visible:outline-none focus-visible:shadow-glow',
        isPostponedOrCancelled && 'opacity-60',
      )}
    >
      <div className="w-12 text-center shrink-0">
        <p className="text-sm font-mono text-text-primary font-medium tabular-nums tracking-tight">
          {kickoffLocal}
        </p>
        {match.status === 'scheduled' && <Countdown kickoffUtc={match.kickoff_utc} />}
        {match.status === 'live' && (
          <span className="text-[10px] font-mono text-live uppercase tracking-[0.2em] animate-pulse-live">
            Live
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              'text-sm font-sans truncate',
              homeWon ? 'text-text-primary font-semibold' : 'text-text-secondary',
            )}
          >
            {homeLabel}
          </span>

          {isResult ? (
            <span className="font-mono text-sm font-semibold text-text-primary tabular-nums shrink-0">
              {match.actual_home_score} – {match.actual_away_score}
            </span>
          ) : (
            <span className="text-[10px] text-text-muted font-mono shrink-0">vs</span>
          )}

          <span
            className={cn(
              'text-sm font-sans truncate text-right',
              awayWon ? 'text-text-primary font-semibold' : 'text-text-secondary',
            )}
          >
            {awayLabel}
          </span>
        </div>

        <div className="flex items-center gap-2 mt-1">
          {match.venue && (
            <span className="text-xs text-text-muted font-sans truncate">{match.venue}</span>
          )}
          {match.penalties && (
            <span className="text-[10px] text-text-muted font-mono uppercase tracking-wider">
              pens
            </span>
          )}
          {match.extra_time && !match.penalties && (
            <span className="text-[10px] text-text-muted font-mono uppercase tracking-wider">
              aet
            </span>
          )}
        </div>
      </div>

      <div className="shrink-0">
        <Badge variant={STATUS_VARIANT[match.status]}>{STATUS_LABEL[match.status]}</Badge>
      </div>
    </Link>
  );
}

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
      <div className="sticky top-14 z-10 -mx-4 sm:-mx-0 px-4 sm:px-0 py-2 bg-bg/95 backdrop-blur-sm mb-2 first:pt-0">
        <h2 className="text-[10px] font-mono text-text-muted uppercase tracking-[0.25em]">
          {dateLabel}
        </h2>
      </div>
      <div className="flex flex-col gap-2">
        {matches.map((m) => (
          <MatchCard key={m.id} match={m} timezone={timezone} />
        ))}
      </div>
    </section>
  );
}

const STAGES = [
  { value: '', label: 'All' },
  { value: 'group', label: 'Group' },
  { value: 'r32', label: 'R32' },
  { value: 'r16', label: 'R16' },
  { value: 'qf', label: 'QF' },
  { value: 'sf', label: 'SF' },
  { value: 'third_place', label: '3rd' },
  { value: 'final', label: 'Final' },
];

function StageFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <nav className="-mx-4 sm:-mx-0 mb-5 overflow-x-auto" aria-label="Filter by stage">
      <div className="flex gap-1.5 px-4 sm:px-0 min-w-max">
        {STAGES.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => onChange(s.value)}
            aria-pressed={value === s.value}
            className={cn(
              'inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-medium font-sans whitespace-nowrap transition-colors press-down focus-visible:outline-none focus-visible:shadow-glow',
              value === s.value
                ? 'bg-primary/15 text-primary border border-primary/30'
                : 'bg-surface text-text-secondary hover:bg-surface-elevated border border-border',
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

export function SchedulePage() {
  const { player } = useAuth();
  const timezone = player?.timezone ?? 'UTC';

  const [stageFilter, setStageFilter] = useState('');

  const { data, isLoading, error } = useQuery<MatchResponse[]>({
    queryKey: ['matches', stageFilter],
    queryFn: () =>
      apiFetch<MatchResponse[]>(`/api/v1/matches${stageFilter ? `?stage=${stageFilter}` : ''}`),
    staleTime: 30_000,
  });

  const matches = data ?? [];

  const byDate = new Map<string, MatchResponse[]>();
  for (const m of matches) {
    const dateKey = formatInTimeZone(new Date(m.kickoff_utc), timezone, 'EEE d MMM yyyy');
    const bucket = byDate.get(dateKey) ?? [];
    bucket.push(m);
    byDate.set(dateKey, bucket);
  }

  return (
    <div>
      <PageHeader title="Schedule" eyebrow="Fixtures" />
      <StageFilter value={stageFilter} onChange={setStageFilter} />

      {isLoading && (
        <div className="flex flex-col gap-6" aria-label="Loading matches">
          {[0, 1].map((s) => (
            <section key={s}>
              <Skeleton className="h-3 w-32 mb-3" />
              <div className="flex flex-col gap-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      {error && (
        <EmptyState
          title="Couldn't load the schedule"
          description="There was a problem reaching the server. Check your connection and try again."
        />
      )}

      {!isLoading && !error && byDate.size === 0 && (
        <EmptyState
          title="No matches found"
          description={
            stageFilter
              ? 'Nothing matches this stage filter — try "All".'
              : 'The fixture list is empty.'
          }
        />
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
