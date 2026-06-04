import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import { ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { UpcomingMatchesCarousel } from '../components/UpcomingMatchesCarousel';
import { PreTournamentChecklist } from '../components/PreTournamentChecklist';
import { PointsBreakdownRow } from '../components/PointsBreakdownRow';
import { useCountdown } from '../hooks/useCountdown';
import { Skeleton } from '../components/ui/skeleton';
import type {
  CrossLeagueSummary,
  HomeResponse,
  MatchResponse,
} from '../lib/types';

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

// ---------------------------------------------------------------------------
// Section title — real bold titles, sentence case (U20 v2)
// ---------------------------------------------------------------------------

function SectionHeader({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="mb-2 px-0.5 text-lg font-bold tracking-tight text-text-primary">
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
// Hero match chip (U20 v2) — a glanceable slot in the hero's top-right that
// surfaces the most relevant fixture: a live match, else the next upcoming
// one (with a countdown), else the most recent result. Derived entirely from
// the shared group-matches query — no extra request, no backend change.
// ---------------------------------------------------------------------------

type HeroChip = { kind: 'live' | 'next' | 'last'; match: MatchResponse };

function pickHeroChip(matches: MatchResponse[]): HeroChip | null {
  const live = matches.find((m) => m.status === 'live');
  if (live) return { kind: 'live', match: live };

  const upcoming = matches
    .filter((m) => m.status === 'scheduled' || m.status === 'locked')
    .sort((a, b) => a.kickoff_utc.localeCompare(b.kickoff_utc));
  if (upcoming[0]) return { kind: 'next', match: upcoming[0] };

  const completed = matches
    .filter((m) => m.status === 'completed')
    .sort((a, b) => b.kickoff_utc.localeCompare(a.kickoff_utc));
  if (completed[0]) return { kind: 'last', match: completed[0] };

  return null;
}

function chipTeam(team: MatchResponse['home_team'], placeholder: string | null) {
  return { flag: team?.flag_emoji ?? '', code: team?.code ?? placeholder ?? 'TBD' };
}

const CHIP_LABEL_CLS =
  'block font-mono text-[10px] font-semibold uppercase tracking-[0.15em]';
const CHIP_SUB_CLS = 'block font-sans text-[10px] text-text-muted';

function HeroMatchChip({ kind, match }: HeroChip) {
  const cd = useCountdown(match.kickoff_utc);
  const home = chipTeam(match.home_team, match.home_team_placeholder);
  const away = chipTeam(match.away_team, match.away_team_placeholder);
  const score = `${match.actual_home_score ?? 0}–${match.actual_away_score ?? 0}`;

  if (kind === 'live') {
    return (
      <div
        className="shrink-0 rounded-lg border border-live/40 bg-live/10 px-3 py-2 text-right"
        data-testid="hero-chip-live"
      >
        <span className={`${CHIP_LABEL_CLS} flex items-center justify-end gap-1.5 text-success`}>
          <span className="relative flex h-2 w-2" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          Live
        </span>
        <span className="mt-1 block font-mono text-sm tabular-nums text-text-primary">
          {home.flag} {score} {away.flag}
        </span>
        <span className={CHIP_SUB_CLS}>
          {home.code} v {away.code}
        </span>
      </div>
    );
  }

  if (kind === 'next') {
    return (
      <div
        className="shrink-0 rounded-lg border border-border bg-surface px-3 py-2 text-right"
        data-testid="hero-chip-next"
      >
        <span className={`${CHIP_LABEL_CLS} text-text-muted`}>Next</span>
        <span className="mt-1 block font-sans text-sm text-text-primary">
          {home.flag} {home.code} <span className="text-text-muted">v</span> {away.code} {away.flag}
        </span>
        {!cd.expired && (
          <span className="block font-mono text-[10px] tabular-nums text-primary">
            in {formatCountdown(cd)}
          </span>
        )}
      </div>
    );
  }

  // last (completed)
  return (
    <div
      className="shrink-0 rounded-lg border border-border bg-surface px-3 py-2 text-right"
      data-testid="hero-chip-last"
    >
      <span className={`${CHIP_LABEL_CLS} text-text-muted`}>Full time</span>
      <span className="mt-1 block font-mono text-sm tabular-nums text-text-primary">
        {home.flag} {score} {away.flag}
      </span>
      <span className={CHIP_SUB_CLS}>
        {home.code} v {away.code}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Results roll-up folded into the hero (U20.1). A tappable "+N pts ·
// {matchday}" delta line that expands inline to the per-match breakdown and a
// cross-league rank-impact line. Only rendered when `rollup` exists.
// ---------------------------------------------------------------------------

function HeroResultsRollup({
  rollup,
  perLeague,
  timezone,
}: {
  rollup: NonNullable<HomeResponse['rollup']>;
  perLeague: CrossLeagueSummary['per_league'];
  timezone: string;
}) {
  const [expanded, setExpanded] = useState(false);

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
    .map((e) => ({
      label: `${e.rank_delta! > 0 ? '↑' : '↓'}${Math.abs(e.rank_delta!)} ${e.name}`,
      up: e.rank_delta! > 0,
    }));

  return (
    <div className="border-t border-border/60">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-elevated focus-visible:outline-none focus-visible:shadow-glow sm:px-5"
        aria-expanded={expanded}
        aria-label={`Latest results, ${matchdayLabel}, +${points_gained} points from ${matchLabel}`}
      >
        <span className="min-w-0 flex-1 font-sans text-sm">
          <span className="font-mono font-semibold tabular-nums text-primary">
            +{points_gained} pts
          </span>
          <span className="text-text-muted"> · {matchdayLabel}</span>
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
              {impactParts.map((part, i) => (
                <span key={i}>
                  {i > 0 && ' · '}
                  <span className={part.up ? 'text-success' : 'text-live'}>
                    {part.label}
                  </span>
                </span>
              ))}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Greeting + points hero (U20 v2 — greeting lives above; card = points + chip)
// ---------------------------------------------------------------------------

function GreetingHero({
  summary,
  rollup,
  perLeague,
  timezone,
  chip,
  isLoading,
}: {
  summary: CrossLeagueSummary | undefined;
  rollup: HomeResponse['rollup'];
  perLeague: CrossLeagueSummary['per_league'];
  timezone: string;
  chip: HeroChip | null;
  isLoading: boolean;
}) {
  if (isLoading) {
    return <Skeleton className="h-[150px] rounded-xl sm:h-[170px]" />;
  }

  const pts = summary?.total_points ?? 0;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-gradient-to-br from-surface-elevated to-surface shadow-sm">
      <div className="px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.25em] text-text-muted">
              Points
            </p>
            <p className="font-mono text-4xl font-semibold leading-none tabular-nums text-primary sm:text-5xl">
              {pts}
            </p>
          </div>
          {chip && <HeroMatchChip kind={chip.kind} match={chip.match} />}
        </div>
      </div>

      {rollup ? (
        <HeroResultsRollup rollup={rollup} perLeague={perLeague} timezone={timezone} />
      ) : (
        <p className="border-t border-border/60 px-4 py-2.5 text-center font-sans text-xs text-text-muted sm:px-5">
          Your tally starts when the first results land · WC kicks off 11 Jun
        </p>
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
    <span className="font-mono text-xs text-live tabular-nums" aria-label={`down ${Math.abs(delta)}`}>
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

  const parts = movers.map((e) => ({
    label: `${e.rank_delta! > 0 ? '↑' : '↓'}${Math.abs(e.rank_delta!)} ${e.name}`,
    up: e.rank_delta! > 0,
  }));

  return (
    <p className="border-b border-border/50 px-4 py-3 font-sans text-xs text-text-muted sm:px-5">
      Across your leagues:{' '}
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 && ' · '}
          <span className={part.up ? 'text-success' : 'text-live'}>{part.label}</span>
        </span>
      ))}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Page — fixed order: greeting → hero → checklist → carousel → leagues
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

  // Shared with the carousel + checklist (React Query dedupes the key); used
  // here only to derive the hero's live/next/last match chip.
  const { data: matches = [] } = useQuery<MatchResponse[]>({
    queryKey: ['matches', 'group'],
    queryFn: () => apiFetch<MatchResponse[]>('/api/v1/matches?stage=group'),
    staleTime: 30_000,
  });

  const perLeague = summary?.per_league ?? [];
  const todo = home?.todo;
  const heroChip = pickHeroChip(matches);

  return (
    <div className="space-y-6">
      {/* Greeting (own bold title) + points/chip hero (U20 v2) */}
      <div>
        <h1 className="mb-3 px-0.5 text-2xl font-bold tracking-tight text-text-primary">
          Welcome back, {displayName}
        </h1>
        <GreetingHero
          summary={summary}
          rollup={home?.rollup ?? null}
          perLeague={perLeague}
          timezone={timezone}
          chip={heroChip}
          isLoading={summaryLoading || homeLoading}
        />
      </div>

      {/* Pre-tournament setup checklist (U20.4) — auto-ticks, latches dismissed */}
      <PreTournamentChecklist
        specialsSubmitted={todo?.specials_submitted}
        isLoading={homeLoading}
      />

      {/* Upcoming-matches carousel — inline group-stage prediction editing (U19) */}
      <UpcomingMatchesCarousel />

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
