import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { isKnockoutStage, scoreLiveProvisionalPrediction, type Stage } from '@wc2026/shared';
import { apiFetch } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { UpcomingMatchesCarousel } from '../components/UpcomingMatchesCarousel';
import { PreTournamentChecklist } from '../components/PreTournamentChecklist';
import { ScoringGuide } from '../components/ScoringGuide';
import { PointsBreakdownRow } from '../components/PointsBreakdownRow';
import { useCountdown } from '../hooks/useCountdown';
import { Skeleton } from '../components/ui/skeleton';
import type {
  CrossLeagueSummary,
  HomeResponse,
  KnockoutPredictionResponse,
  MatchResponse,
  PredictionResponse,
} from '../lib/types';

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

function SectionHeader({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="mb-2 px-0.5 text-lg font-bold tracking-tight text-text-primary">
      {children}
    </h2>
  );
}

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

function formatElapsed(elapsed: number | null | undefined): string | null {
  if (elapsed == null) return null;
  return `${elapsed}'`;
}

function formatTileKickoff(kickoffUtc: string, timezone: string): string {
  return formatInTimeZone(new Date(kickoffUtc), timezone, 'EEE d MMM, HH:mm');
}

function getLivePriority(match: MatchResponse, prediction: PredictionResponse | undefined): number {
  const hasPrediction =
    prediction != null &&
    prediction.predicted_home !== null &&
    prediction.predicted_away !== null;

  return (hasPrediction ? 10_000 : 0) + (match.elapsed_minutes ?? 0);
}

function PointsTile({
  playerId,
  points,
  rollup,
  inlineSlot,
  timezone,
  isLoading,
}: {
  playerId: string | undefined;
  points: number;
  rollup: HomeResponse['rollup'];
  inlineSlot: InlineSlot | null;
  timezone: string;
  isLoading: boolean;
}) {
  if (isLoading) {
    return <Skeleton className="h-full min-h-[184px] rounded-[1.25rem]" />;
  }

  return (
    <Link
      to={playerId ? `/players/${playerId}` : '/leagues'}
      aria-label="Open your profile"
      className="flex h-full min-h-[184px] flex-col justify-between rounded-[1.25rem] border border-border bg-gradient-to-br from-surface-elevated via-surface to-surface p-4 shadow-sm transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:shadow-glow sm:p-5"
      data-testid="points-tile"
    >
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-text-muted">Points</p>
        <p className="mt-2 font-mono text-4xl font-semibold leading-none tabular-nums text-primary sm:text-5xl">
          {points}
        </p>
      </div>

      <div className="space-y-3 border-t border-border/60 pt-3">
        {rollup ? (
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
              Latest matchday
            </p>
            <p className="mt-1 text-sm text-text-primary">
              <span className="font-mono font-semibold tabular-nums text-primary">
                +{rollup.points_gained} today
              </span>
              <span className="text-text-muted">
                {' '}
                · {formatInTimeZone(new Date(rollup.matchday + 'T00:00:00Z'), timezone, 'EEE d MMM')}
              </span>
            </p>
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-text-muted">
            Your tally starts when the first results land.
          </p>
        )}

        {inlineSlot && (
          <div
            className="rounded-2xl border border-border/60 bg-surface/80 px-3 py-2.5"
            data-testid={inlineSlot.kind === 'next' ? 'points-tile-inline-next' : 'points-tile-inline-last'}
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
              {inlineSlot.kind === 'next' ? 'Next fixture' : 'Latest final'}
            </p>
            <p className="mt-1 font-mono text-sm tabular-nums text-text-primary">
              {(() => {
                const home = chipTeam(inlineSlot.match.home_team, inlineSlot.match.home_team_placeholder);
                const away = chipTeam(inlineSlot.match.away_team, inlineSlot.match.away_team_placeholder);
                if (inlineSlot.kind === 'next') {
                  return `${home.flag} ${home.code} v ${away.code} ${away.flag}`;
                }
                return `${home.flag} ${home.code} ${inlineSlot.match.actual_home_score ?? 0}–${inlineSlot.match.actual_away_score ?? 0} ${away.code} ${away.flag}`;
              })()}
            </p>
          </div>
        )}
      </div>
    </Link>
  );
}

function MatchTileLiveCard({
  match,
  prediction,
  knockoutPrediction,
  timezone,
}: {
  match: MatchResponse;
  prediction: PredictionResponse | undefined;
  knockoutPrediction: KnockoutPredictionResponse | undefined;
  timezone: string;
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
  const provisionalBreakdown = scoreLiveProvisionalPrediction({
    prediction: hasPrediction
      ? { homeScore: prediction.predicted_home!, awayScore: prediction.predicted_away! }
      : null,
    actual: { homeScore: hs, awayScore: as },
    stage: match.stage as Stage,
    homeTeamId: match.home_team?.id,
    awayTeamId: match.away_team?.id,
    predictedWinnerId: knockoutPrediction?.predicted_winner_id,
  });
  const hasProvisionalBreakdown = hasPrediction && !provisionalBreakdown.match.noPrediction;
  const advancement = provisionalBreakdown.advancement;
  const showAdvancementLine = advancement.status !== 'not_applicable';

  return (
    <Link
      to={`/matches/${match.id}`}
      aria-label={`Open live match ${home.code} versus ${away.code}`}
      className="block rounded-[1.25rem] border border-live/40 bg-gradient-to-br from-live/10 via-surface to-surface p-4 shadow-sm transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:shadow-glow sm:p-5"
      data-testid="match-tile-live-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-success">
            Live{minute ? ` · ${minute}` : ''}
          </p>
          <p className="mt-1 text-xs text-text-muted">{formatTileKickoff(match.kickoff_utc, timezone)}</p>
        </div>
        <span className="rounded-full border border-live/40 bg-live/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-success">
          In play
        </span>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <span className="min-w-0 font-mono text-base font-semibold text-text-primary sm:text-lg">
          {home.flag} {home.code}
        </span>
        <span className="shrink-0 font-mono text-3xl font-semibold tabular-nums text-primary sm:text-[2rem]">
          {hs}–{as}
        </span>
        <span className="min-w-0 text-right font-mono text-base font-semibold text-text-primary sm:text-lg">
          {away.code} {away.flag}
        </span>
      </div>

      <div className="mt-5 space-y-2 border-t border-border/60 pt-3">
        <p className="text-sm text-text-primary">
          {hasPrediction ? (
            <>
              <span className="text-text-muted">You </span>
              <span className="font-mono font-medium tabular-nums">
                {prediction.predicted_home}–{prediction.predicted_away}
              </span>
              <span className="text-text-muted"> · </span>
              <span className="font-mono font-semibold tabular-nums text-primary">
                +{provisionalBreakdown.total} if it stands
              </span>
            </>
          ) : (
            <span className="text-text-muted">No prediction on this one.</span>
          )}
        </p>
        {hasProvisionalBreakdown && showAdvancementLine && (
          <div
            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border/60 bg-surface/70 px-3 py-2 font-mono text-[11px] tabular-nums"
            data-testid="provisional-combined-breakdown"
          >
            <span className="text-text-muted">
              Match{' '}
              <span className="font-semibold text-text-primary">
                +{provisionalBreakdown.match.total}
              </span>
            </span>
            {advancement.status === 'determined' ? (
              <span className="text-text-muted">
                Advancement{' '}
                <span className="font-semibold text-text-primary">+{advancement.points}</span>
              </span>
            ) : (
              <span className="text-live">Advancement undecided</span>
            )}
            <span className="ml-auto font-semibold text-primary">{provisionalBreakdown.total} pts</span>
          </div>
        )}
        {hasProvisionalBreakdown && (
          <PointsBreakdownRow
            breakdown={{
              result: provisionalBreakdown.match.correctResult,
              goals: provisionalBreakdown.match.totalGoals,
              exact: provisionalBreakdown.match.exactScore,
              total: provisionalBreakdown.total,
            }}
          />
        )}
      </div>
    </Link>
  );
}

function MatchTileFixtureCard({
  kind,
  match,
  timezone,
}: {
  kind: 'next' | 'last';
  match: MatchResponse;
  timezone: string;
}) {
  const countdown = useCountdown(match.kickoff_utc);
  const home = chipTeam(match.home_team, match.home_team_placeholder);
  const away = chipTeam(match.away_team, match.away_team_placeholder);

  return (
    <Link
      to={`/matches/${match.id}`}
      aria-label={`Open ${kind === 'next' ? 'next' : 'last'} match ${home.code} versus ${away.code}`}
      className="flex h-full min-h-[184px] flex-col justify-between rounded-[1.25rem] border border-border bg-gradient-to-br from-surface-elevated via-surface to-surface p-4 shadow-sm transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:shadow-glow sm:p-5"
      data-testid={kind === 'next' ? 'match-tile-next' : 'match-tile-last'}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
            {kind === 'next' ? 'Next up' : 'Latest final'}
          </p>
          <p className="mt-1 text-xs text-text-muted">{formatTileKickoff(match.kickoff_utc, timezone)}</p>
        </div>
        <span className="rounded-full border border-border/60 bg-surface/80 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-text-muted">
          {kind === 'next' ? (countdown.expired ? 'Locked' : `in ${formatCountdown(countdown)}`) : 'Full time'}
        </span>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <span className="min-w-0 font-mono text-base font-semibold text-text-primary sm:text-lg">
          {home.flag} {home.code}
        </span>
        <span className="shrink-0 font-mono text-3xl font-semibold tabular-nums text-primary sm:text-[2rem]">
          {kind === 'next'
            ? 'v'
            : `${match.actual_home_score ?? 0}–${match.actual_away_score ?? 0}`}
        </span>
        <span className="min-w-0 text-right font-mono text-base font-semibold text-text-primary sm:text-lg">
          {away.code} {away.flag}
        </span>
      </div>

      <p className="mt-5 border-t border-border/60 pt-3 text-sm text-text-muted">
        {kind === 'next'
          ? 'Tap through to check the match detail and prediction form before lock.'
          : 'Tap through for the full result and your prediction outcome.'}
      </p>
    </Link>
  );
}

function LiveMatchCarousel({
  matches,
  predByMatch,
  knockoutPredByMatch,
  timezone,
}: {
  matches: MatchResponse[];
  predByMatch: Record<string, PredictionResponse>;
  knockoutPredByMatch: Record<string, KnockoutPredictionResponse>;
  timezone: string;
}) {
  const orderedMatches = [...matches].sort(
    (a, b) => getLivePriority(b, predByMatch[b.id]) - getLivePriority(a, predByMatch[a.id]),
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const liveIds = orderedMatches.map((match) => match.id).join(',');

  useEffect(() => {
    setActiveIndex(0);
  }, [liveIds]);

  const canPage = orderedMatches.length > 1;
  const currentMatch = orderedMatches[activeIndex] ?? orderedMatches[0];

  const move = (delta: number) => {
    setActiveIndex((value) => {
      const nextValue = value + delta;
      if (nextValue < 0) return orderedMatches.length - 1;
      if (nextValue >= orderedMatches.length) return 0;
      return nextValue;
    });
  };

  return (
    <div
      className="flex h-full min-h-[184px] flex-col rounded-[1.25rem] border border-border bg-surface shadow-sm"
      data-testid="match-tile-live-carousel"
      onTouchStart={(event) => {
        touchStartX.current = event.changedTouches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        const startX = touchStartX.current;
        const endX = event.changedTouches[0]?.clientX ?? null;
        touchStartX.current = null;
        if (startX == null || endX == null) return;
        const deltaX = endX - startX;
        if (Math.abs(deltaX) < 40) return;
        move(deltaX < 0 ? 1 : -1);
      }}
    >
      <div className="flex items-center justify-between px-3 pt-3 sm:px-4 sm:pt-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">Match hub</p>
          <p className="mt-1 text-sm text-text-muted">
            {orderedMatches.length} live {orderedMatches.length === 1 ? 'match' : 'matches'}
          </p>
        </div>
        {canPage && (
          <div className="hidden items-center gap-1 sm:flex">
            <button
              type="button"
              aria-label="Previous live match"
              onClick={() => move(-1)}
              className="rounded-full border border-border/60 bg-surface-elevated p-2 text-text-muted transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:shadow-glow"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Next live match"
              onClick={() => move(1)}
              className="rounded-full border border-border/60 bg-surface-elevated p-2 text-text-muted transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:shadow-glow"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 px-2 pb-2 pt-2 sm:px-3 sm:pb-3">
        <MatchTileLiveCard
          key={currentMatch.id}
          match={currentMatch}
          prediction={predByMatch[currentMatch.id]}
          knockoutPrediction={knockoutPredByMatch[currentMatch.id]}
          timezone={timezone}
        />
      </div>

      {canPage && (
        <div className="flex items-center justify-center gap-2 px-3 pb-3">
          {orderedMatches.map((match, index) => (
            <button
              key={match.id}
              type="button"
              aria-label={`Show live match ${index + 1}`}
              aria-current={index === activeIndex}
              onClick={() => setActiveIndex(index)}
              className={`h-2.5 rounded-full transition-all focus-visible:outline-none focus-visible:shadow-glow ${
                index === activeIndex ? 'w-6 bg-primary' : 'w-2.5 bg-border'
              }`}
              data-testid="live-match-dot"
            />
          ))}
        </div>
      )}
    </div>
  );
}

type PerLeagueEntry = CrossLeagueSummary['per_league'][number];

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) return null;
  if (delta === 0) return <span className="font-mono text-xs text-text-muted tabular-nums">▬</span>;
  if (delta > 0) {
    return (
      <span className="font-mono text-xs text-success tabular-nums" aria-label={`up ${delta}`}>
        ↑{delta}
      </span>
    );
  }
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
      aria-label={`Open ${name} leaderboard`}
      className="flex items-center gap-3 border-b border-border/50 px-4 py-3 transition-colors last:border-b-0 hover:bg-surface-elevated focus-visible:outline-none focus-visible:shadow-glow"
      data-testid="league-row-link"
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

  const { data: matches = [] } = useQuery<MatchResponse[]>({
    queryKey: ['matches', 'all'],
    queryFn: () => apiFetch<MatchResponse[]>('/api/v1/matches'),
    staleTime: 30_000,
  });

  const { data: predictions = [] } = useQuery<PredictionResponse[]>({
    queryKey: ['predictions', 'me'],
    queryFn: () => apiFetch<PredictionResponse[]>('/api/v1/predictions/me'),
    staleTime: 30_000,
  });

  const liveHasKnockout = matches.some(
    (m) => m.status === 'live' && isKnockoutStage(m.stage as Stage),
  );
  const { data: knockoutPredictions = [] } = useQuery<KnockoutPredictionResponse[]>({
    queryKey: ['knockout-predictions', 'me'],
    queryFn: () => apiFetch<KnockoutPredictionResponse[]>('/api/v1/knockout-predictions/me'),
    enabled: liveHasKnockout,
    staleTime: 30_000,
  });

  const perLeague = summary?.per_league ?? [];
  const liveMatches = matches.filter((m) => m.status === 'live');
  const inlineSlot = pickInlineSlot(matches);
  const predByMatch: Record<string, PredictionResponse> = Object.fromEntries(
    predictions.map((prediction) => [prediction.match_id, prediction]),
  );
  const knockoutPredByMatch: Record<string, KnockoutPredictionResponse> = Object.fromEntries(
    knockoutPredictions.map((prediction) => [prediction.match_id, prediction]),
  );
  const points = summary?.total_points ?? 0;
  const loadingTopRow = summaryLoading || homeLoading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-3 px-0.5 text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
          Welcome back, {displayName}
        </h1>
        <div
          className="grid grid-cols-[minmax(0,0.92fr)_minmax(0,1.48fr)] gap-3"
          data-testid="dashboard-top-row"
        >
          <PointsTile
            playerId={player?.id}
            points={points}
            rollup={home?.rollup ?? null}
            inlineSlot={inlineSlot}
            timezone={timezone}
            isLoading={loadingTopRow}
          />
          {liveMatches.length > 0 ? (
            <LiveMatchCarousel
              matches={liveMatches}
              predByMatch={predByMatch}
              knockoutPredByMatch={knockoutPredByMatch}
              timezone={timezone}
            />
          ) : inlineSlot ? (
            <MatchTileFixtureCard kind={inlineSlot.kind} match={inlineSlot.match} timezone={timezone} />
          ) : (
            <Skeleton className="h-full min-h-[184px] rounded-[1.25rem]" />
          )}
        </div>
      </div>

      {summaryLoading ? (
        <section aria-labelledby="home-leagues-label">
          <SectionHeader id="home-leagues-label">My Leagues</SectionHeader>
          <Skeleton className="h-[80px] rounded-lg" />
        </section>
      ) : perLeague.length > 0 ? (
        <section aria-labelledby="home-leagues-label">
          <SectionHeader id="home-leagues-label">My Leagues</SectionHeader>
          <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
            {perLeague.map((entry) => (
              <CompactLeagueRow key={entry.slug} entry={entry} />
            ))}
          </div>
        </section>
      ) : null}

      <UpcomingMatchesCarousel />

      <PreTournamentChecklist
        specialsSubmitted={home?.todo?.specials_submitted}
        isLoading={homeLoading}
      />

      <ScoringGuide storageKey="sss_scoring_guide_home_open" defaultOpen={false} />
    </div>
  );
}
