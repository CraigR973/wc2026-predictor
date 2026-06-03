import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import { Sparkles, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { WelcomeCard } from '../components/WelcomeCard';
import { PointsBreakdownRow } from '../components/PointsBreakdownRow';
import { useCountdown } from '../hooks/useCountdown';
import { Skeleton } from '../components/ui/skeleton';
import { Button } from '../components/ui/button';
import type {
  CrossLeagueSummary,
  HomeResponse,
} from '../lib/types';

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

// ---------------------------------------------------------------------------
// Stat strip — 2-tile compact row (U17.2 replaces U16 PointsHero)
// ---------------------------------------------------------------------------

function StatStrip({
  summary,
  isLoading,
}: {
  summary: CrossLeagueSummary | undefined;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-[76px] rounded-lg" />
        <Skeleton className="h-[76px] rounded-lg" />
      </div>
    );
  }

  const pts = summary?.total_points ?? 0;
  const hasActivity = pts > 0;

  // Best rank = lowest rank number across per_league
  const leagueRanks = summary?.per_league.filter((e) => e.rank !== null) ?? [];
  const bestEntry =
    leagueRanks.length > 0
      ? leagueRanks.reduce((best, e) => (e.rank! < best.rank! ? e : best))
      : null;
  const bestRank = bestEntry?.rank ?? null;
  const leaguesCount = summary?.leagues_count ?? 0;

  // Pick rank_delta for the best-rank entry
  const bestDelta = bestEntry?.rank_delta ?? null;

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        {/* Points tile */}
        <div className="rounded-lg border border-border bg-surface p-3 sm:p-4">
          <p className="text-[10px] font-mono text-text-muted uppercase tracking-[0.25em] mb-2">
            Points
          </p>
          <p className="font-mono text-4xl sm:text-5xl text-primary tabular-nums font-semibold leading-none">
            {pts}
          </p>
        </div>

        {/* Rank tile */}
        <div className="rounded-lg border border-border bg-surface p-3 sm:p-4">
          <p className="text-[10px] font-mono text-text-muted uppercase tracking-[0.25em] mb-2">
            Rank
          </p>
          {bestRank !== null ? (
            <div className="flex items-baseline gap-2">
              <p className="font-mono text-4xl sm:text-5xl text-primary tabular-nums font-semibold leading-none">
                #{bestRank}
              </p>
              {bestDelta !== null && bestDelta !== 0 && (
                <span
                  className={`font-mono text-sm tabular-nums ${bestDelta > 0 ? 'text-success' : 'text-text-muted'}`}
                  aria-label={bestDelta > 0 ? `up ${bestDelta}` : `down ${Math.abs(bestDelta)}`}
                >
                  {bestDelta > 0 ? '↑' : '↓'}
                  {Math.abs(bestDelta)}
                </span>
              )}
              {leaguesCount > 1 && (
                <span className="text-[10px] font-sans text-text-muted">
                  best of {leaguesCount}
                </span>
              )}
            </div>
          ) : (
            <p className="font-mono text-4xl sm:text-5xl text-text-muted tabular-nums font-semibold leading-none">
              —
            </p>
          )}
        </div>
      </div>
      {!hasActivity && (
        <p className="mt-2 font-sans text-xs text-text-muted text-center">
          Your tally starts when the first results land · WC kicks off 11 Jun
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Next-up to-do card (U17.3 — single action surface)
// ---------------------------------------------------------------------------

function formatCountdown(cd: {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
}): string {
  if (cd.expired) return 'Kicked off';
  if (cd.days > 0) return `${cd.days}d ${cd.hours}h`;
  if (cd.hours > 0) return `${cd.hours}h ${cd.minutes}m`;
  return `${cd.minutes}m ${cd.seconds}s`;
}

function NextMatchCountdown({ kickoffUtc }: { kickoffUtc: string }) {
  const cd = useCountdown(kickoffUtc);
  const isUrgent = !cd.expired && cd.days === 0 && cd.hours === 0;
  return (
    <span className={`font-mono tabular-nums ${isUrgent ? 'text-warning' : 'text-primary'}`}>
      {formatCountdown(cd)}
    </span>
  );
}

function NextUpCard({ todo, isLoading }: { todo: HomeResponse['todo'] | undefined; isLoading: boolean }) {
  if (isLoading) {
    return <Skeleton className="h-[88px] rounded-lg" />;
  }
  if (!todo) return null;

  const { specials_submitted, specials_lock_at, upcoming_unpredicted, next_match } = todo;

  // Priority 1: specials open + not submitted
  const specialsOpen = specials_lock_at !== null && !specials_submitted;

  if (specialsOpen) {
    return (
      <Link
        to="/predictions/specials"
        className="group flex items-center gap-3 p-4 sm:p-5 rounded-lg border border-border bg-surface hover:bg-surface-elevated transition-colors press-down focus-visible:outline-none focus-visible:shadow-glow"
      >
        <span
          className="shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-md bg-primary/10 text-primary group-hover:bg-primary/15 transition-colors"
          aria-hidden
        >
          <Sparkles className="h-4 w-4" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-sans text-sm font-semibold text-text-primary">
            Make your Specials picks
          </span>
          <span className="block text-text-muted text-xs font-sans mt-0.5">
            Tournament winner, Golden Boot, top scorer
          </span>
        </span>
        <ChevronRight
          className="h-4 w-4 text-text-muted shrink-0 transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </Link>
    );
  }

  // Priority 2: next match unpredicted + not locked
  if (next_match && !next_match.predicted) {
    return (
      <div className="rounded-lg border border-border bg-surface-elevated p-4 sm:p-5">
        <p className="text-[10px] font-mono text-text-muted uppercase tracking-[0.25em] mb-2">
          Next up
        </p>
        <p className="font-sans text-sm font-medium text-text-primary mb-1 truncate">
          {next_match.home_label}{' '}
          <span className="text-text-muted font-normal">vs</span>{' '}
          {next_match.away_label}
        </p>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-muted font-sans">
            locks in <NextMatchCountdown kickoffUtc={next_match.kickoff_utc} />
          </span>
          <Button asChild size="sm" variant="default" className="ml-auto">
            <Link to="/predictions">Predict now</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Priority 3: more upcoming matches to predict
  if (upcoming_unpredicted > 1) {
    return (
      <Link
        to="/predictions"
        className="flex items-center gap-3 p-4 sm:p-5 rounded-lg border border-border bg-surface hover:bg-surface-elevated transition-colors press-down focus-visible:outline-none focus-visible:shadow-glow"
      >
        <span className="flex-1 font-sans text-sm font-medium text-text-primary">
          {upcoming_unpredicted} matches open to predict
        </span>
        <ChevronRight className="h-4 w-4 text-text-muted shrink-0" aria-hidden />
      </Link>
    );
  }

  // Priority 4: all done — calm state
  return (
    <div className="flex items-center gap-3 p-4 sm:p-5 rounded-lg border border-border bg-surface">
      <span className="flex-1 font-sans text-sm text-text-secondary">
        You&apos;re all set
        {next_match && (
          <>
            {' · next lock in '}
            <NextMatchCountdown kickoffUtc={next_match.kickoff_utc} />
          </>
        )}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Results roll-up card (U17.4 — replaces LatestResultCard)
// ---------------------------------------------------------------------------

function ResultsRollupCard({
  rollup,
  perLeague,
  timezone,
}: {
  rollup: HomeResponse['rollup'];
  perLeague: CrossLeagueSummary['per_league'];
  timezone: string;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!rollup) return null;

  const { matchday, points_gained, match_count, matches } = rollup;

  // Format the matchday date string for display
  const matchdayLabel = formatInTimeZone(
    new Date(matchday + 'T00:00:00Z'),
    timezone,
    'EEE d MMM',
  );

  // Cross-league impact: per_league entries whose triggered_by is one of the rollup match ids
  const rollupMatchIds = new Set(matches.map((m) => m.match_id));
  const impactParts = perLeague
    .filter(
      (e) =>
        e.triggered_by_match_id !== null &&
        rollupMatchIds.has(e.triggered_by_match_id) &&
        e.rank_delta !== null &&
        e.rank_delta !== 0,
    )
    .map((e) => {
      const dir = e.rank_delta! > 0 ? '↑' : '↓';
      return `${dir}${Math.abs(e.rank_delta!)} ${e.name}`;
    });

  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      {/* Collapsed header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 p-4 sm:p-5 text-left hover:bg-surface-elevated transition-colors focus-visible:outline-none focus-visible:shadow-glow"
        aria-expanded={expanded}
      >
        <span className="flex-1 min-w-0">
          <span className="block text-[10px] font-mono text-text-muted uppercase tracking-[0.25em] mb-1">
            Latest Results
          </span>
          <span className="font-sans text-sm font-medium text-text-primary">
            {matchdayLabel}:{' '}
            <span className="text-primary font-mono tabular-nums">
              +{points_gained}
            </span>{' '}
            <span className="text-text-muted font-normal">
              · {match_count} {match_count === 1 ? 'match' : 'matches'}
            </span>
          </span>
        </span>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-text-muted shrink-0" aria-hidden />
        ) : (
          <ChevronDown className="h-4 w-4 text-text-muted shrink-0" aria-hidden />
        )}
      </button>

      {/* Expanded per-match rows */}
      {expanded && (
        <div className="border-t border-border/50">
          {matches.map((m) => {
            const hasScore = m.actual_home !== null && m.actual_away !== null;
            return (
              <Link
                key={m.match_id}
                to={`/matches/${m.match_id}`}
                className="block px-4 sm:px-5 py-3 border-b border-border/50 last:border-b-0 hover:bg-surface-elevated transition-colors focus-visible:outline-none focus-visible:shadow-glow"
              >
                <p className="font-sans text-xs font-medium text-text-primary mb-1 truncate">
                  {m.home_label}{' '}
                  <span className="text-text-muted font-normal">vs</span>{' '}
                  {m.away_label}
                </p>
                {hasScore && (
                  <p className="font-mono text-xs text-text-muted tabular-nums mb-2">
                    {m.actual_home}–{m.actual_away}
                    {m.predicted_home !== null && m.predicted_away !== null && (
                      <span className="ml-2 text-text-muted/70">
                        (you: {m.predicted_home}–{m.predicted_away})
                      </span>
                    )}
                  </p>
                )}
                {m.points_breakdown && (
                  <PointsBreakdownRow breakdown={m.points_breakdown} />
                )}
              </Link>
            );
          })}

          {/* Movement impact across leagues */}
          {impactParts.length > 0 && (
            <p className="px-4 sm:px-5 py-3 text-xs font-sans text-text-muted">
              {impactParts.join(' · ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compact league rank strip (U16.4) + cross-league movement summary (U17.5)
// ---------------------------------------------------------------------------

type PerLeagueEntry = CrossLeagueSummary['per_league'][number];

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) return null;
  if (delta === 0) return <span className="font-mono text-xs text-text-muted tabular-nums">▬</span>;
  if (delta > 0)
    return (
      <span className="font-mono text-xs text-success tabular-nums" aria-label={`up ${delta}`}>
        ↑{delta}
      </span>
    );
  return (
    <span className="font-mono text-xs text-text-muted tabular-nums" aria-label={`down ${Math.abs(delta)}`}>
      ↓{Math.abs(delta)}
    </span>
  );
}

function CompactLeagueRow({ entry }: { entry: PerLeagueEntry }) {
  const { rank, member_count, name, slug, rank_delta } = entry;

  return (
    <Link
      to={`/leagues/${slug}/leaderboard`}
      className="flex items-center gap-3 px-4 sm:px-5 py-3 border-b border-border/50 last:border-b-0 hover:bg-surface-elevated transition-colors focus-visible:outline-none focus-visible:shadow-glow"
    >
      <span className="flex-1 min-w-0 font-sans text-sm font-medium text-text-primary truncate">
        {name}
      </span>
      {rank !== null ? (
        <span className="shrink-0 flex items-center gap-2 font-mono text-xs tabular-nums">
          <span className="text-text-muted">
            {MEDAL[rank] ?? `#${rank}`}
            <span className="font-sans opacity-60"> of {member_count}</span>
          </span>
          <DeltaBadge delta={rank_delta} />
        </span>
      ) : (
        <span className="shrink-0 text-xs font-sans text-text-muted">—</span>
      )}
      <ChevronRight className="h-3.5 w-3.5 text-text-muted shrink-0" aria-hidden />
    </Link>
  );
}

function CrossLeagueMovementSummary({
  perLeague,
}: {
  perLeague: CrossLeagueSummary['per_league'];
}) {
  if (perLeague.length < 2) return null;

  const movers = perLeague.filter((e) => e.rank_delta !== null && e.rank_delta !== 0);
  if (movers.length === 0) return null;

  const parts = movers.map((e) => {
    const dir = e.rank_delta! > 0 ? '↑' : '↓';
    return `${dir}${Math.abs(e.rank_delta!)} ${e.name}`;
  });

  return (
    <p className="px-4 sm:px-5 pt-3 pb-0 text-xs font-sans text-text-muted">
      Across your leagues: {parts.join(' · ')}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Page (U17.6 — adaptive composition)
// ---------------------------------------------------------------------------

export function DashboardPage() {
  const { player } = useAuth();
  const timezone = player?.timezone ?? 'UTC';

  const { data: summary, isLoading: summaryLoading } = useQuery<CrossLeagueSummary>({
    queryKey: ['cross-league-summary'],
    queryFn: () => apiFetch<CrossLeagueSummary>('/api/v1/me/cross-league-summary'),
    staleTime: 30_000,
  });

  const { data: home, isLoading: homeLoading } = useQuery<HomeResponse>({
    queryKey: ['me-home'],
    queryFn: () => apiFetch<HomeResponse>('/api/v1/me/home'),
    staleTime: 30_000,
  });

  const perLeague = summary?.per_league ?? [];
  const hasRollup = home?.rollup != null;

  return (
    <div className="space-y-5">
      {/* Stat strip — POINTS + best RANK (U17.2) */}
      <StatStrip summary={summary} isLoading={summaryLoading} />

      {/* Adaptive top zone (U17.6) */}
      {hasRollup ? (
        <>
          {/* Results lead when scores exist */}
          <ResultsRollupCard rollup={home!.rollup} perLeague={perLeague} timezone={timezone} />
          <NextUpCard todo={home?.todo} isLoading={homeLoading} />
        </>
      ) : (
        /* Next-up leads pre-tournament */
        <NextUpCard todo={home?.todo} isLoading={homeLoading} />
      )}

      {/* WelcomeCard below the to-do (U17.6) */}
      <WelcomeCard />

      {/* Compact league rank strip (U16.4) with cross-league summary (U17.5) */}
      {summaryLoading ? (
        <Skeleton className="h-[80px] rounded-lg" />
      ) : perLeague.length > 0 ? (
        <div className="rounded-lg border border-border bg-surface overflow-hidden">
          <CrossLeagueMovementSummary perLeague={perLeague} />
          {perLeague.map((entry) => (
            <CompactLeagueRow key={entry.slug} entry={entry} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
