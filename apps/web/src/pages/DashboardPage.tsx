import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import { Sparkles, ChevronRight } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { WelcomeCard } from '../components/WelcomeCard';
import { useCountdown } from '../hooks/useCountdown';
import { Skeleton } from '../components/ui/skeleton';
import { Button } from '../components/ui/button';
import type {
  CrossLeagueSummary,
  MatchResponse,
  RecentPrediction,
} from '../lib/types';

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

// ---------------------------------------------------------------------------
// Points hero (U16.1 + U16.2)
// ---------------------------------------------------------------------------

function PointsHero({
  summary,
  isLoading,
  displayName,
}: {
  summary: CrossLeagueSummary | undefined;
  isLoading: boolean;
  displayName: string | undefined;
}) {
  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-surface p-4 sm:p-5 space-y-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-12 w-40" />
        <Skeleton className="h-3 w-56" />
      </div>
    );
  }

  const pts = summary?.total_points ?? 0;
  const hasPoints = pts > 0;

  return (
    <div className="rounded-lg border border-border bg-surface p-4 sm:p-5">
      <p className="text-[10px] font-mono text-text-muted uppercase tracking-[0.25em] mb-3">
        Points
      </p>
      <p className="font-mono text-5xl sm:text-6xl text-primary tabular-nums font-semibold leading-none mb-2">
        {pts}
      </p>
      <p className="font-sans text-sm text-text-secondary">
        {hasPoints
          ? `Welcome back, ${displayName}`
          : 'Your tally starts when the first results land · WC kicks off 11 Jun'}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Next match card
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

function NextMatchCard({
  match,
  timezone,
  hasPrediction,
}: {
  match: MatchResponse;
  timezone: string;
  hasPrediction: boolean;
}) {
  const cd = useCountdown(match.kickoff_utc);
  const kickoffLocal = formatInTimeZone(new Date(match.kickoff_utc), timezone, 'EEE d MMM, HH:mm');
  const homeLabel = match.home_team
    ? `${match.home_team.flag_emoji} ${match.home_team.name}`
    : (match.home_team_placeholder ?? '?');
  const awayLabel = match.away_team
    ? `${match.away_team.flag_emoji} ${match.away_team.name}`
    : (match.away_team_placeholder ?? '?');
  const isUrgent = !cd.expired && cd.days === 0 && cd.hours === 0;

  return (
    <div className="block rounded-lg border border-border bg-surface-elevated p-4 sm:p-5 transition-colors">
      <p className="text-[10px] font-mono text-text-muted uppercase tracking-[0.25em] mb-3">
        Next Match
      </p>
      <p className="font-sans text-xs text-text-muted mb-1">{kickoffLocal}</p>
      <p className="font-sans text-base text-text-primary mb-3 truncate font-medium">
        {homeLabel} <span className="text-text-muted font-normal">vs</span> {awayLabel}
      </p>
      <p
        className={`font-mono text-4xl tabular-nums font-medium leading-none mb-4 ${
          isUrgent ? 'text-warning' : 'text-primary'
        }`}
      >
        {formatCountdown(cd)}
      </p>
      <div className="flex items-center gap-2">
        <Link
          to={`/matches/${match.id}`}
          className="text-xs font-sans text-text-muted hover:text-primary transition-colors"
        >
          Match details →
        </Link>
        {!hasPrediction && !cd.expired && (
          <Button asChild size="sm" variant="default" className="ml-auto">
            <Link to="/predictions">Predict now</Link>
          </Button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compact league rank strip (U16.4) — reads from per_league, no leaderboard fetch
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

// ---------------------------------------------------------------------------
// Latest result (U16.5) — with per-league movement impact line
// ---------------------------------------------------------------------------

function LatestResultCard({
  prediction,
  timezone,
  perLeague,
}: {
  prediction: RecentPrediction;
  timezone: string;
  perLeague: CrossLeagueSummary['per_league'];
}) {
  const kickoffLocal = formatInTimeZone(new Date(prediction.kickoff_utc), timezone, 'EEE d MMM');
  const homeLabel = prediction.home_team_name ?? '?';
  const awayLabel = prediction.away_team_name ?? '?';
  const pts = prediction.points_awarded;
  const bd = prediction.points_breakdown;

  // Build impact line: per_league entries whose latest result triggered by this match
  const impactParts = perLeague
    .filter(
      (e) =>
        e.triggered_by_match_id === prediction.match_id &&
        e.rank_delta !== null &&
        e.rank_delta !== 0,
    )
    .map((e) => {
      const dir = e.rank_delta! > 0 ? '↑' : '↓';
      return `${dir}${Math.abs(e.rank_delta!)} in ${e.name}`;
    });

  return (
    <Link
      to={`/matches/${prediction.match_id}`}
      className="block rounded-lg border border-border bg-surface p-4 sm:p-5 hover:bg-surface-elevated press-down transition-colors focus-visible:outline-none focus-visible:shadow-glow"
    >
      <p className="text-[10px] font-mono text-text-muted uppercase tracking-[0.25em] mb-3">
        Latest Result
      </p>
      <p className="font-sans text-xs text-text-muted mb-1">{kickoffLocal}</p>
      <p className="font-sans text-sm text-text-primary mb-2 truncate">
        {prediction.home_team_flag} {homeLabel}{' '}
        <span className="text-text-muted">vs</span>{' '}
        {prediction.away_team_flag} {awayLabel}
      </p>
      {prediction.actual_home !== null && prediction.actual_away !== null && (
        <p className="font-mono text-xs text-text-muted tabular-nums mb-3">
          {prediction.actual_home}–{prediction.actual_away}
          {prediction.predicted_home !== null && prediction.predicted_away !== null && (
            <span className="ml-2 text-text-muted/70">
              (you: {prediction.predicted_home}–{prediction.predicted_away})
            </span>
          )}
        </p>
      )}
      {bd ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
          {(
            [
              { label: 'Result', val: bd.result },
              { label: 'Goals', val: bd.goals },
              { label: 'Exact', val: bd.exact },
            ] as const
          ).map(({ label, val }) => (
            <span key={label} className="flex items-center gap-1 font-sans text-xs">
              <span className={val > 0 ? 'text-success' : 'text-text-muted'}>
                {val > 0 ? '✓' : '✗'}
              </span>
              <span className="text-text-muted">{label}</span>
              <span
                className={`font-mono tabular-nums font-medium ${val > 0 ? 'text-primary' : 'text-text-muted'}`}
              >
                {val > 0 ? `+${val}` : '—'}
              </span>
            </span>
          ))}
          <span className="font-mono text-xs font-semibold text-primary tabular-nums ml-auto">
            {bd.total} pts
          </span>
        </div>
      ) : (
        pts !== null && (
          <span
            className={`inline-flex items-baseline gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium mb-2 ${
              pts > 0
                ? 'bg-primary/15 text-primary border border-primary/25'
                : 'bg-surface-elevated text-text-muted border border-border'
            }`}
          >
            <span className="tabular-nums">{pts}</span>
            <span className="opacity-70">pt{pts !== 1 ? 's' : ''}</span>
          </span>
        )
      )}
      {impactParts.length > 0 && (
        <p className="text-xs font-sans text-text-muted mt-2">{impactParts.join(' · ')}</p>
      )}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Specials CTA
// ---------------------------------------------------------------------------

function SpecialsCTA() {
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
          Make your specials picks
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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function DashboardPage() {
  const { player } = useAuth();
  const timezone = player?.timezone ?? 'UTC';

  const { data: summary, isLoading: summaryLoading } = useQuery<CrossLeagueSummary>({
    queryKey: ['cross-league-summary'],
    queryFn: () => apiFetch<CrossLeagueSummary>('/api/v1/me/cross-league-summary'),
    staleTime: 30_000,
  });

  const { data: upcoming = [], isLoading: upcomingLoading } = useQuery<MatchResponse[]>({
    queryKey: ['matches', 'upcoming', 1],
    queryFn: () => apiFetch<MatchResponse[]>('/api/v1/matches/upcoming?n=1'),
    staleTime: 60_000,
  });

  const { data: recentPreds = [], isLoading: recentLoading } = useQuery<RecentPrediction[]>({
    queryKey: ['predictions', 'recent', player?.id],
    queryFn: () =>
      apiFetch<RecentPrediction[]>(`/api/v1/players/${player!.id}/predictions/recent?limit=1`),
    enabled: !!player?.id,
    staleTime: 30_000,
  });

  const nextMatch = upcoming[0] ?? null;

  const { data: nextMatchPrediction } = useQuery({
    queryKey: ['prediction', nextMatch?.id, player?.id],
    queryFn: async () => {
      try {
        return await apiFetch(`/api/v1/predictions/${nextMatch!.id}`);
      } catch {
        return null;
      }
    },
    enabled: !!nextMatch?.id && !!player?.id,
    staleTime: 30_000,
  });

  const latestPred = recentPreds[0] ?? null;
  const hasPrediction = nextMatchPrediction !== null && nextMatchPrediction !== undefined;
  const perLeague = summary?.per_league ?? [];

  return (
    <div className="space-y-5">
      {/* Points hero — replaces h1 greeting + CrossLeagueSummaryWidget */}
      <PointsHero summary={summary} isLoading={summaryLoading} displayName={player?.displayName} />

      <WelcomeCard />

      {/* Next match */}
      {upcomingLoading ? (
        <Skeleton className="h-[160px] rounded-lg" />
      ) : nextMatch ? (
        <NextMatchCard match={nextMatch} timezone={timezone} hasPrediction={hasPrediction} />
      ) : (
        <div className="rounded-lg border border-border bg-surface p-4 sm:p-5">
          <p className="text-[10px] font-mono text-text-muted uppercase tracking-[0.25em] mb-3">
            Next Match
          </p>
          <p className="text-text-muted font-sans text-sm">No upcoming matches</p>
        </div>
      )}

      {/* Latest result — with per-league movement impact line */}
      {recentLoading ? (
        <Skeleton className="h-[140px] rounded-lg" />
      ) : latestPred ? (
        <LatestResultCard prediction={latestPred} timezone={timezone} perLeague={perLeague} />
      ) : null}

      {/* Compact league rank strip — sourced from cross-league summary (no N+1 fetch) */}
      {summaryLoading ? (
        <Skeleton className="h-[80px] rounded-lg" />
      ) : perLeague.length > 0 ? (
        <div className="rounded-lg border border-border bg-surface overflow-hidden">
          {perLeague.map((entry) => (
            <CompactLeagueRow key={entry.slug} entry={entry} />
          ))}
        </div>
      ) : null}

      {/* Specials CTA */}
      <SpecialsCTA />
    </div>
  );
}
