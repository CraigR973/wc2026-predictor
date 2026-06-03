import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import {
  Sparkles,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Clock,
  ListChecks,
} from 'lucide-react';
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
  HomeTodo,
} from '../lib/types';

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

// Far-future sentinel used as a no-op target for conditional countdown hooks.
const FAR_FUTURE = '2099-01-01T00:00:00Z';

// ---------------------------------------------------------------------------
// Section header — consistent zone label that gives each zone its own identity
// ---------------------------------------------------------------------------

function SectionHeader({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2
      id={id}
      className="mb-2 px-0.5 font-mono text-[10px] uppercase tracking-[0.25em] text-text-muted"
    >
      {children}
    </h2>
  );
}

// ---------------------------------------------------------------------------
// Shared countdown formatter
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

// ---------------------------------------------------------------------------
// Greeting + points hero (U18.1)
// ---------------------------------------------------------------------------

// Returns the ISO string for the soonest upcoming lock, or null if none.
function nearestLockTarget(todo: HomeTodo | undefined): string | null {
  if (!todo) return null;
  const candidates: string[] = [];
  if (todo.specials_lock_at && !todo.specials_submitted) {
    candidates.push(todo.specials_lock_at);
  }
  if (todo.next_match?.kickoff_utc) {
    candidates.push(todo.next_match.kickoff_utc);
  }
  if (candidates.length === 0) return null;
  return candidates.sort()[0];
}

function HeroCountdownLine({ target }: { target: string | null }) {
  const cd = useCountdown(target ?? FAR_FUTURE);
  if (!target || cd.expired) return null;
  const isUrgent = cd.days === 0 && cd.hours === 0;
  return (
    <p className="mt-2 font-sans text-xs text-text-muted">
      next lock in{' '}
      <span
        className={`font-mono tabular-nums ${isUrgent ? 'text-warning' : 'text-primary'}`}
      >
        {formatCountdown(cd)}
      </span>
    </p>
  );
}

function GreetingHero({
  summary,
  todo,
  displayName,
  isLoading,
}: {
  summary: CrossLeagueSummary | undefined;
  todo: HomeTodo | undefined;
  displayName: string;
  isLoading: boolean;
}) {
  if (isLoading) {
    return <Skeleton className="h-[110px] rounded-xl sm:h-[130px]" />;
  }

  const pts = summary?.total_points ?? 0;
  const hasActivity = pts > 0;
  const lockTarget = nearestLockTarget(todo);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-gradient-to-br from-surface-elevated to-surface shadow-sm">
      <div className="px-4 py-4 sm:px-5 sm:py-5">
        <p className="mb-3 font-sans text-sm text-text-muted">
          Welcome back,{' '}
          <span className="font-semibold text-text-primary">{displayName}</span>
        </p>
        <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.25em] text-text-muted">
          Points
        </p>
        <p className="font-mono text-4xl font-semibold leading-none tabular-nums text-primary sm:text-5xl">
          {pts}
        </p>
        <HeroCountdownLine target={lockTarget} />
      </div>

      {!hasActivity && (
        <p className="border-t border-border/60 px-4 py-2.5 text-center font-sans text-xs text-text-muted sm:px-5">
          Your tally starts when the first results land · WC kicks off 11 Jun
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Urgent zone (U18.3 — self-hiding when nothing time-pressured)
// ---------------------------------------------------------------------------

function NextMatchCountdown({ kickoffUtc }: { kickoffUtc: string }) {
  const cd = useCountdown(kickoffUtc);
  const isUrgent = !cd.expired && cd.days === 0 && cd.hours === 0;
  return (
    <span className={`font-mono tabular-nums ${isUrgent ? 'text-warning' : 'text-primary'}`}>
      {formatCountdown(cd)}
    </span>
  );
}

const ACTION_CARD =
  'group flex items-center gap-3 rounded-lg border border-border bg-surface-elevated p-4 shadow-sm transition-colors hover:border-border-strong hover:bg-surface-overlay press-down focus-visible:outline-none focus-visible:shadow-glow sm:p-5';

function ActionIcon({ children }: { children: ReactNode }) {
  return (
    <span
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary transition-colors group-hover:bg-primary/15"
      aria-hidden
    >
      {children}
    </span>
  );
}

function UrgentZone({ todo, isLoading }: { todo: HomeTodo | undefined; isLoading: boolean }) {
  if (isLoading) {
    return <Skeleton className="h-[72px] rounded-lg sm:h-[80px]" />;
  }
  if (!todo) return null;

  const { specials_submitted, specials_lock_at, upcoming_unpredicted, next_match } = todo;
  const specialsOpen = specials_lock_at !== null && !specials_submitted;

  // Priority 1: specials open + not submitted
  if (specialsOpen) {
    return (
      <Link to="/predictions/specials" className={ACTION_CARD}>
        <ActionIcon>
          <Sparkles className="h-4 w-4" />
        </ActionIcon>
        <span className="min-w-0 flex-1">
          <span className="block font-sans text-sm font-semibold text-text-primary">
            Make your Specials picks
          </span>
          <span className="mt-0.5 block font-sans text-xs text-text-muted">
            Tournament winner, Golden Boot, top scorer
          </span>
        </span>
        <ChevronRight
          className="h-4 w-4 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </Link>
    );
  }

  // Priority 2: next match unpredicted + not locked
  if (next_match && !next_match.predicted) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-elevated p-4 shadow-sm sm:p-5">
        <ActionIcon>
          <Clock className="h-4 w-4" />
        </ActionIcon>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-sans text-sm font-medium text-text-primary">
            {next_match.home_label}{' '}
            <span className="font-normal text-text-muted">vs</span>{' '}
            {next_match.away_label}
          </span>
          <span className="mt-0.5 block font-sans text-xs text-text-muted">
            locks in <NextMatchCountdown kickoffUtc={next_match.kickoff_utc} />
          </span>
        </span>
        <Button asChild size="sm" variant="default" className="shrink-0">
          <Link to="/predictions">Predict now</Link>
        </Button>
      </div>
    );
  }

  // Priority 3: multiple upcoming matches to predict
  if (upcoming_unpredicted > 1) {
    return (
      <Link to="/predictions" className={ACTION_CARD}>
        <ActionIcon>
          <ListChecks className="h-4 w-4" />
        </ActionIcon>
        <span className="flex-1 font-sans text-sm font-medium text-text-primary">
          {upcoming_unpredicted} matches open to predict
        </span>
        <ChevronRight
          className="h-4 w-4 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </Link>
    );
  }

  // Nothing time-pressured — self-hide
  return null;
}

// ---------------------------------------------------------------------------
// Specials read-only strip (U18.4)
// ---------------------------------------------------------------------------

function SpecialsLockCountdown({ lockAt }: { lockAt: string }) {
  const cd = useCountdown(lockAt);
  if (cd.expired) return <>Locked</>;
  return (
    <>
      locks in{' '}
      <span className="font-mono tabular-nums text-primary">{formatCountdown(cd)}</span>
    </>
  );
}

function SpecialsStrip({ todo, isLoading }: { todo: HomeTodo | undefined; isLoading: boolean }) {
  if (isLoading) return <Skeleton className="h-[56px] rounded-lg" />;
  // Show only when picks are submitted — unsubmitted+open state is handled by UrgentZone.
  if (!todo?.specials_submitted) return null;

  const { specials_lock_at } = todo;

  return (
    <Link
      to="/predictions/specials"
      className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 shadow-sm transition-colors hover:border-border-strong hover:bg-surface-elevated focus-visible:outline-none focus-visible:shadow-glow sm:px-5"
    >
      <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block font-sans text-sm font-medium text-text-primary">
          Specials picks submitted
        </span>
        <span className="mt-0.5 block font-sans text-xs text-text-muted">
          {specials_lock_at ? (
            <SpecialsLockCountdown lockAt={specials_lock_at} />
          ) : (
            <>Locked</>
          )}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Results roll-up card (U17.4 — replaces LatestResultCard)
// ---------------------------------------------------------------------------

function ResultsRollupCard({
  rollup,
  perLeague,
  timezone,
  isLoading,
}: {
  rollup: HomeResponse['rollup'];
  perLeague: CrossLeagueSummary['per_league'];
  timezone: string;
  isLoading: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  if (isLoading) {
    return <Skeleton className="h-[64px] rounded-lg sm:h-[72px]" />;
  }

  if (!rollup) {
    return (
      <div className="rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-5">
        <p className="font-sans text-sm text-text-muted">
          Your points and match results will appear here once the first scores are in.
        </p>
      </div>
    );
  }

  const { matchday, points_gained, match_count, matches } = rollup;
  const matchLabel = `${match_count} ${match_count === 1 ? 'match' : 'matches'}`;

  const matchdayLabel = formatInTimeZone(
    new Date(matchday + 'T00:00:00Z'),
    timezone,
    'EEE d MMM',
  );

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
    <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-surface-elevated focus-visible:outline-none focus-visible:shadow-glow sm:p-5"
        aria-expanded={expanded}
        aria-label={`Latest results, ${matchdayLabel}, +${points_gained} points from ${matchLabel}`}
      >
        <span className="min-w-0 flex-1 font-sans text-sm font-medium text-text-primary">
          {matchdayLabel}
          <span className="font-normal text-text-muted"> · {matchLabel}</span>
        </span>
        <span className="shrink-0 font-mono text-lg font-semibold tabular-nums text-primary">
          +{points_gained}
        </span>
        {expanded ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
        )}
      </button>

      {expanded && (
        <div className="border-t border-border/50">
          {matches.map((m) => {
            const hasScore = m.actual_home !== null && m.actual_away !== null;
            return (
              <Link
                key={m.match_id}
                to={`/matches/${m.match_id}`}
                className="block border-b border-border/50 px-4 py-3 transition-colors last:border-b-0 hover:bg-surface-elevated focus-visible:outline-none focus-visible:shadow-glow sm:px-5"
              >
                <p className="mb-1 truncate font-sans text-xs font-medium text-text-primary">
                  {m.home_label}{' '}
                  <span className="font-normal text-text-muted">vs</span>{' '}
                  {m.away_label}
                </p>
                {hasScore && (
                  <p className="mb-2 font-mono text-xs tabular-nums text-text-muted">
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

          {impactParts.length > 0 && (
            <p className="px-4 py-3 font-sans text-xs text-text-muted sm:px-5">
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
      className="flex items-center gap-3 border-b border-border/50 px-4 py-3 transition-colors last:border-b-0 hover:bg-surface-elevated focus-visible:outline-none focus-visible:shadow-glow sm:px-5"
    >
      <span className="min-w-0 flex-1 truncate font-sans text-sm font-medium text-text-primary">
        {name}
      </span>
      {rank !== null ? (
        <span className="flex shrink-0 items-center gap-2 font-mono text-xs tabular-nums">
          <span className="text-text-muted">
            {MEDAL[rank] ?? `#${rank}`}
            <span className="font-sans opacity-60"> of {member_count}</span>
          </span>
          <DeltaBadge delta={rank_delta} />
        </span>
      ) : (
        <span className="shrink-0 font-sans text-xs text-text-muted">—</span>
      )}
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-text-muted" aria-hidden />
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
    <p className="border-b border-border/50 px-4 py-3 font-sans text-xs text-text-muted sm:px-5">
      Across your leagues: {parts.join(' · ')}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Page — fixed order: hero → how-it-works → urgent → results → specials → leagues
// ---------------------------------------------------------------------------

export function DashboardPage() {
  const { player } = useAuth();
  const timezone = player?.timezone ?? 'UTC';
  const displayName = player?.displayName ?? 'there';

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
  const todo = home?.todo;

  // Urgent zone is visible while loading (shows skeleton) or when there's a pressured action.
  const hasUrgent =
    todo !== undefined &&
    ((todo.specials_lock_at !== null && !todo.specials_submitted) ||
      (todo.next_match !== null && !todo.next_match.predicted) ||
      todo.upcoming_unpredicted > 1);
  const showUrgent = homeLoading || hasUrgent;

  // Specials strip shows when picks are submitted (unsubmitted+open handled by UrgentZone).
  const showSpecials = homeLoading || todo?.specials_submitted === true;

  return (
    <div className="space-y-6">
      {/* Hero — greeting + points + next-lock countdown */}
      <GreetingHero
        summary={summary}
        todo={todo}
        displayName={displayName}
        isLoading={summaryLoading || homeLoading}
      />

      {/* How it works — persistent collapsible (U18.2) */}
      <WelcomeCard />

      {/* Urgent zone — self-hides when nothing time-pressured (U18.3) */}
      {showUrgent && (
        <section aria-labelledby="home-urgent-label">
          <SectionHeader id="home-urgent-label">To-do</SectionHeader>
          <UrgentZone todo={todo} isLoading={homeLoading} />
        </section>
      )}

      {/* Results roll-up */}
      <section aria-labelledby="home-results-label">
        <SectionHeader id="home-results-label">Results</SectionHeader>
        <ResultsRollupCard
          rollup={home?.rollup ?? null}
          perLeague={perLeague}
          timezone={timezone}
          isLoading={homeLoading}
        />
      </section>

      {/* Specials strip — read-only steady-state summary (U18.4) */}
      {showSpecials && (
        <section aria-labelledby="home-specials-label">
          <SectionHeader id="home-specials-label">Specials</SectionHeader>
          <SpecialsStrip todo={todo} isLoading={homeLoading} />
        </section>
      )}

      {/* Leagues */}
      {summaryLoading ? (
        <section aria-labelledby="home-leagues-label">
          <SectionHeader id="home-leagues-label">Leagues</SectionHeader>
          <Skeleton className="h-[80px] rounded-lg" />
        </section>
      ) : perLeague.length > 0 ? (
        <section aria-labelledby="home-leagues-label">
          <SectionHeader id="home-leagues-label">Leagues</SectionHeader>
          <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
            <CrossLeagueMovementSummary perLeague={perLeague} />
            {perLeague.map((entry) => (
              <CompactLeagueRow key={entry.slug} entry={entry} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
