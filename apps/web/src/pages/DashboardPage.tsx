import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import { ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { scoreMatchPrediction, type Stage } from '@wc2026/shared';
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
  PredictionResponse,
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
// Inline match slot (U27.5 / U27.6) — a single glanceable line below the points
// number surfacing the next upcoming fixture (with a countdown) or, failing
// that, the most recent result. Live matches are NOT shown here: they get the
// dedicated "Live now" hub below the hero. Derived entirely from the shared
// group-matches query — no extra request, no backend change.
// ---------------------------------------------------------------------------

type InlineSlot = { kind: 'next' | 'last'; match: MatchResponse };

function pickInlineSlot(matches: MatchResponse[]): InlineSlot | null {
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

function InlineMatchSlot({ kind, match }: InlineSlot) {
  const cd = useCountdown(match.kickoff_utc);
  const home = chipTeam(match.home_team, match.home_team_placeholder);
  const away = chipTeam(match.away_team, match.away_team_placeholder);

  const label = kind === 'next' ? 'Next' : 'Full time';
  const testid = kind === 'next' ? 'hero-chip-next' : 'hero-chip-last';

  return (
    <div
      className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-0.5 border-t border-border/40 pt-3 font-sans text-sm"
      data-testid={testid}
    >
      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">
        {label}
      </span>
      <span className="text-text-muted" aria-hidden>
        ·
      </span>
      {kind === 'next' ? (
        <span className="text-text-primary">
          {home.flag} {home.code} <span className="text-text-muted">v</span> {away.code} {away.flag}
        </span>
      ) : (
        <span className="font-mono tabular-nums text-text-primary">
          {home.flag} {home.code} {match.actual_home_score ?? 0}–{match.actual_away_score ?? 0}{' '}
          {away.code} {away.flag}
        </span>
      )}
      {kind === 'next' && !cd.expired && (
        <>
          <span className="text-text-muted" aria-hidden>
            ·
          </span>
          <span className="font-mono text-xs tabular-nums text-primary">in {formatCountdown(cd)}</span>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Live match hub (U27.1) — a full-width section between the hero and the
// checklist, shown whenever ≥1 group match is live. One card per live match,
// responsive (one column on mobile, two on wider screens). Each card shows the
// running score, elapsed minute (when the backend supplies one), the caller's
// prediction, and the points that prediction *would* score if the current
// scoreline held — computed with the shared scoring logic, the same rules the
// backend trigger applies on full time.
// ---------------------------------------------------------------------------

function formatElapsed(elapsed: number | null | undefined): string | null {
  if (elapsed == null) return null;
  return `${elapsed}'`;
}

function LivePulse() {
  return (
    <span className="relative flex h-2 w-2" aria-hidden>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
    </span>
  );
}

function LiveMatchCard({
  match,
  prediction,
}: {
  match: MatchResponse;
  prediction: PredictionResponse | undefined;
}) {
  const home = chipTeam(match.home_team, match.home_team_placeholder);
  const away = chipTeam(match.away_team, match.away_team_placeholder);
  const hs = match.actual_home_score ?? 0;
  const as = match.actual_away_score ?? 0;
  const minute = formatElapsed(match.elapsed_minutes);

  const hasPrediction =
    prediction != null &&
    prediction.predicted_home !== null &&
    prediction.predicted_away !== null;

  const provisional = hasPrediction
    ? scoreMatchPrediction(
        { homeScore: prediction!.predicted_home!, awayScore: prediction!.predicted_away! },
        { homeScore: hs, awayScore: as },
        match.stage as Stage,
      ).total
    : 0;

  return (
    <div
      className="rounded-xl border border-live/40 bg-live/5 p-4 shadow-sm"
      data-testid="live-match-card"
    >
      <div className="mb-3 flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-success">
        <LivePulse />
        Live
        {minute && <span className="tabular-nums text-text-muted">· {minute}</span>}
      </div>

      <p className="font-mono text-2xl font-semibold tabular-nums text-text-primary">
        {home.flag} {home.code}{' '}
        <span className="text-primary">
          {hs}–{as}
        </span>{' '}
        {away.code} {away.flag}
      </p>

      <p className="mt-2 font-sans text-sm text-text-muted">
        You:{' '}
        {hasPrediction ? (
          <span className="font-mono font-medium tabular-nums text-text-primary">
            {prediction!.predicted_home}–{prediction!.predicted_away}
          </span>
        ) : (
          <span className="text-text-muted">not predicted</span>
        )}
      </p>

      {hasPrediction && (
        <p className="mt-1 font-sans text-sm">
          <span className="text-text-muted">Points if this stands: </span>
          <span className="font-mono font-semibold tabular-nums text-primary">{provisional}</span>
        </p>
      )}
    </div>
  );
}

function LiveMatchHub({
  matches,
  predByMatch,
}: {
  matches: MatchResponse[];
  predByMatch: Record<string, PredictionResponse>;
}) {
  if (matches.length === 0) return null;

  return (
    <section aria-labelledby="home-live-label" data-testid="live-hub">
      <SectionHeader id="home-live-label">Live now</SectionHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        {matches.map((m) => (
          <LiveMatchCard key={m.id} match={m} prediction={predByMatch[m.id]} />
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Daily summary, folded into the hero (U20.1 → U27.2/U27.3/U27.4). A "Daily
// summary"-labelled, tappable "+N pts · {matchday}" delta line. The cross-
// league rank movement it caused now shows *always* (no tap needed); tapping
// expands the per-match breakdown — prominent score, a distinct prediction
// pill, and the kickoff date/time. Only rendered when `rollup` exists.
// ---------------------------------------------------------------------------

function HeroDailySummary({
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
  const movementParts = perLeague
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
        <span className="min-w-0 flex-1">
          <span className="mb-0.5 block font-mono text-[10px] uppercase tracking-[0.25em] text-text-muted">
            Daily summary
          </span>
          <span className="font-sans text-sm">
            <span className="font-mono font-semibold tabular-nums text-primary">
              +{points_gained} pts
            </span>
            <span className="text-text-muted"> · {matchdayLabel}</span>
          </span>
        </span>
        {expanded ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
        )}
      </button>

      {/* U27.3 — league movement is always visible, below the collapsed line. */}
      {movementParts.length > 0 && (
        <p
          className="border-t border-border/50 px-4 py-2.5 font-sans text-xs text-text-muted sm:px-5"
          data-testid="daily-movement"
        >
          {movementParts.map((part, i) => (
            <span key={i}>
              {i > 0 && ' · '}
              <span className={part.up ? 'text-success' : 'text-live'}>{part.label}</span>
            </span>
          ))}
        </p>
      )}

      {expanded && (
        <div className="border-t border-border/50">
          {matches.map((m) => {
            const hasScore = m.actual_home !== null && m.actual_away !== null;
            const hasPrediction = m.predicted_home !== null && m.predicted_away !== null;
            return (
              <Link
                key={m.match_id}
                to={`/matches/${m.match_id}`}
                className="block border-b border-border/50 px-4 py-3 transition-colors last:border-b-0 hover:bg-surface-elevated focus-visible:outline-none focus-visible:shadow-glow sm:px-5"
              >
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <p className="min-w-0 truncate font-sans text-xs font-medium text-text-primary">
                    {m.home_label} <span className="font-normal text-text-muted">vs</span>{' '}
                    {m.away_label}
                  </p>
                  <span className="shrink-0 font-mono text-[10px] tabular-nums text-text-muted">
                    {formatInTimeZone(new Date(m.kickoff_utc), timezone, 'd MMM, HH:mm')}
                  </span>
                </div>
                {hasScore && (
                  <p className="mb-2 flex items-center gap-2">
                    <span className="font-mono text-base font-semibold tabular-nums text-text-primary">
                      {m.actual_home}–{m.actual_away}
                    </span>
                    {hasPrediction && (
                      <span className="rounded-full border border-border bg-surface-elevated px-2 py-0.5 font-mono text-[10px] font-medium tabular-nums text-text-muted">
                        you {m.predicted_home}–{m.predicted_away}
                      </span>
                    )}
                  </p>
                )}
                {m.points_breakdown && <PointsBreakdownRow breakdown={m.points_breakdown} />}
              </Link>
            );
          })}
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
  inlineSlot,
  isLoading,
}: {
  summary: CrossLeagueSummary | undefined;
  rollup: HomeResponse['rollup'];
  perLeague: CrossLeagueSummary['per_league'];
  timezone: string;
  inlineSlot: InlineSlot | null;
  isLoading: boolean;
}) {
  if (isLoading) {
    return <Skeleton className="h-[150px] rounded-xl sm:h-[170px]" />;
  }

  const pts = summary?.total_points ?? 0;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-gradient-to-br from-surface-elevated to-surface shadow-sm">
      <div className="px-4 py-4 sm:px-5 sm:py-5">
        <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.25em] text-text-muted">
          Points
        </p>
        <p className="font-mono text-4xl font-semibold leading-none tabular-nums text-primary sm:text-5xl">
          {pts}
        </p>
        {/* U27.5 / U27.6 — next-or-last fixture inline, below the points. */}
        {inlineSlot && <InlineMatchSlot kind={inlineSlot.kind} match={inlineSlot.match} />}
      </div>

      {rollup ? (
        <HeroDailySummary rollup={rollup} perLeague={perLeague} timezone={timezone} />
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
// Page — fixed order: greeting → hero → live hub → checklist → carousel → leagues
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

  // Shared with the carousel + checklist (React Query dedupes the key): drives
  // the live hub and the hero's inline next/last fixture slot.
  const { data: matches = [] } = useQuery<MatchResponse[]>({
    queryKey: ['matches', 'group'],
    queryFn: () => apiFetch<MatchResponse[]>('/api/v1/matches?stage=group'),
    staleTime: 30_000,
  });

  // Shared with the carousel (same key, deduped). Supplies each live match's
  // prediction so the hub can show provisional "points if this stands".
  const { data: predictions = [] } = useQuery<PredictionResponse[]>({
    queryKey: ['predictions', 'me'],
    queryFn: () => apiFetch<PredictionResponse[]>('/api/v1/predictions/me'),
    staleTime: 30_000,
  });

  const perLeague = summary?.per_league ?? [];
  const todo = home?.todo;

  const liveMatches = matches.filter((m) => m.status === 'live');
  const inlineSlot = pickInlineSlot(matches);
  const predByMatch: Record<string, PredictionResponse> = Object.fromEntries(
    predictions.map((p) => [p.match_id, p]),
  );

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
          inlineSlot={inlineSlot}
          isLoading={summaryLoading || homeLoading}
        />
      </div>

      {/* Live match hub (U27.1) — surfaces between hero and checklist when live */}
      <LiveMatchHub matches={liveMatches} predByMatch={predByMatch} />

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
