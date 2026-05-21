import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import {
  Pencil,
  Swords,
  Sparkles,
  CalendarDays,
  Users,
  GitCompare,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useCountdown } from '../hooks/useCountdown';
import { Skeleton } from '../components/ui/skeleton';
import type { LeaderboardEntry, MatchResponse, RecentPrediction } from '../lib/types';

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 sm:p-5">
      <p className="text-[10px] font-mono text-text-muted uppercase tracking-[0.25em] mb-3">
        {label}
      </p>
      <p className="font-mono text-3xl sm:text-4xl text-primary tabular-nums font-medium leading-none">
        {value}
      </p>
    </div>
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

function NextMatchCard({ match, timezone }: { match: MatchResponse; timezone: string }) {
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
    <div className="rounded-lg border border-border bg-surface p-4 sm:p-5">
      <p className="text-[10px] font-mono text-text-muted uppercase tracking-[0.25em] mb-3">
        Next Match
      </p>
      <p className="font-sans text-xs text-text-muted mb-1">{kickoffLocal}</p>
      <p className="font-sans text-sm text-text-primary mb-3 truncate">
        {homeLabel} <span className="text-text-muted">vs</span> {awayLabel}
      </p>
      <p
        className={`font-mono text-2xl tabular-nums font-medium leading-none ${
          isUrgent ? 'text-warning' : 'text-primary'
        }`}
      >
        {formatCountdown(cd)}
      </p>
    </div>
  );
}

function LatestResultCard({
  prediction,
  timezone,
}: {
  prediction: RecentPrediction;
  timezone: string;
}) {
  const kickoffLocal = formatInTimeZone(new Date(prediction.kickoff_utc), timezone, 'EEE d MMM');
  const homeLabel = prediction.home_team_name ?? '?';
  const awayLabel = prediction.away_team_name ?? '?';
  const pts = prediction.points_awarded;
  const hasPoints = pts !== null && pts > 0;

  return (
    <div className="rounded-lg border border-border bg-surface p-4 sm:p-5">
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
        <p className="font-mono text-xs text-text-muted tabular-nums mb-2">
          {prediction.actual_home}–{prediction.actual_away}
          {prediction.predicted_home !== null && prediction.predicted_away !== null && (
            <span className="ml-2 text-text-muted/70">
              (you: {prediction.predicted_home}–{prediction.predicted_away})
            </span>
          )}
        </p>
      )}
      <span
        className={`inline-flex items-baseline gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium ${
          hasPoints
            ? 'bg-primary/15 text-primary border border-primary/25'
            : 'bg-surface-elevated text-text-muted border border-border'
        }`}
      >
        <span className="tabular-nums">{pts !== null ? pts : '—'}</span>
        <span className="opacity-70">{pts !== null ? `pt${pts !== 1 ? 's' : ''}` : 'no entry'}</span>
      </span>
    </div>
  );
}

function MiniLeaderboard({
  entries,
  currentPlayerId,
}: {
  entries: LeaderboardEntry[];
  currentPlayerId: string;
}) {
  const top5 = entries.slice(0, 5);
  const myEntry = entries.find((e) => e.player_id === currentPlayerId);
  const myRankInTop5 = top5.some((e) => e.player_id === currentPlayerId);
  const showMyRow = myEntry && !myRankInTop5;

  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      <div className="px-4 sm:px-5 pt-4 pb-2 flex items-center justify-between">
        <p className="text-[10px] font-mono text-text-muted uppercase tracking-[0.25em]">
          Standings
        </p>
        <Link
          to="/leaderboard"
          className="text-xs font-sans text-text-muted hover:text-primary transition-colors tap-target inline-flex items-center"
        >
          Full table →
        </Link>
      </div>
      <table className="w-full text-sm font-sans">
        <tbody>
          {top5.map((e) => (
            <tr
              key={e.player_id}
              className={`border-t border-border/50 ${
                e.player_id === currentPlayerId ? 'bg-primary/5' : ''
              }`}
            >
              <td className="py-2.5 pl-4 sm:pl-5 w-9">
                <span className="text-text-muted font-mono text-xs tabular-nums">
                  {MEDAL[e.rank] ?? e.rank}
                </span>
              </td>
              <td className="py-2.5">
                <Link
                  to={`/players/${e.player_id}`}
                  className={`font-medium hover:text-primary transition-colors ${
                    e.player_id === currentPlayerId ? 'text-primary' : 'text-text-primary'
                  }`}
                >
                  {e.player_name}
                </Link>
              </td>
              <td className="py-2.5 pr-4 sm:pr-5 text-right font-mono font-semibold text-primary tabular-nums">
                {e.total_points}
              </td>
            </tr>
          ))}
          {showMyRow && (
            <>
              <tr className="border-t border-border/50">
                <td colSpan={3} className="py-1 pl-4 sm:pl-5 text-xs font-mono text-text-muted">
                  ···
                </td>
              </tr>
              <tr className="border-t border-border/50 bg-primary/5">
                <td className="py-2.5 pl-4 sm:pl-5 w-9">
                  <span className="text-text-muted font-mono text-xs tabular-nums">
                    {myEntry.rank}
                  </span>
                </td>
                <td className="py-2.5">
                  <Link
                    to={`/players/${myEntry.player_id}`}
                    className="font-medium text-primary hover:text-primary transition-colors"
                  >
                    {myEntry.player_name}
                  </Link>
                </td>
                <td className="py-2.5 pr-4 sm:pr-5 text-right font-mono font-semibold text-primary tabular-nums">
                  {myEntry.total_points}
                </td>
              </tr>
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}

interface NavCard {
  to: string;
  title: string;
  desc: string;
  Icon: LucideIcon;
}

const NAV_CARDS: ReadonlyArray<NavCard> = [
  { to: '/predictions', title: 'Predictions', desc: 'Submit your match scores', Icon: Pencil },
  { to: '/predictions/knockout', title: 'Knockout Picks', desc: 'Pick winners for each round', Icon: Swords },
  { to: '/predictions/specials', title: 'Specials', desc: 'Tournament winner, Golden Boot, top scorer', Icon: Sparkles },
  { to: '/schedule', title: 'Schedule', desc: 'Browse all 104 matches', Icon: CalendarDays },
  { to: '/groups', title: 'Groups', desc: 'Live group standings', Icon: Users },
  { to: '/compare', title: 'Compare', desc: 'Head-to-head between any two players', Icon: GitCompare },
];

function NavCardLink({ card }: { card: NavCard }) {
  const { to, title, desc, Icon } = card;
  return (
    <Link
      to={to}
      className="group flex items-start gap-4 p-4 sm:p-5 rounded-lg border border-border bg-surface hover:bg-surface-elevated transition-colors press-down focus-visible:outline-none focus-visible:shadow-glow"
    >
      <span
        className="shrink-0 inline-flex items-center justify-center h-10 w-10 rounded-md bg-primary/10 text-primary group-hover:bg-primary/15 transition-colors"
        aria-hidden
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-sans text-base font-semibold text-text-primary tracking-tight">
          {title}
        </span>
        <span className="block text-text-muted text-sm font-sans mt-0.5">{desc}</span>
      </span>
      <ChevronRight
        className="h-4 w-4 text-text-muted shrink-0 mt-1 transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </Link>
  );
}

export function DashboardPage() {
  const { player } = useAuth();
  const timezone = player?.timezone ?? 'UTC';

  const { data: leaderboard = [], isLoading: leaderboardLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ['leaderboard'],
    queryFn: () => apiFetch<LeaderboardEntry[]>('/api/v1/leaderboard'),
    staleTime: 30_000,
  });

  const { data: upcoming = [], isLoading: upcomingLoading } = useQuery<MatchResponse[]>({
    queryKey: ['matches', 'upcoming', 1],
    queryFn: () => apiFetch<MatchResponse[]>('/api/v1/matches/upcoming?n=1'),
    staleTime: 60_000,
  });

  const { data: recentPreds = [], isLoading: recentLoading } = useQuery<RecentPrediction[]>({
    queryKey: ['predictions', 'recent', player?.id],
    queryFn: () => apiFetch<RecentPrediction[]>(
      `/api/v1/players/${player!.id}/predictions/recent?limit=1`,
    ),
    enabled: !!player?.id,
    staleTime: 30_000,
  });

  const myEntry = leaderboard.find((e) => e.player_id === player?.id);
  const nextMatch = upcoming[0] ?? null;
  const latestPred = recentPreds[0] ?? null;

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-text-muted mb-2">
          The Steele Spreadsheet System
        </p>
        <h1 className="text-3xl sm:text-4xl font-semibold text-text-primary tracking-tight leading-[1.1]">
          Welcome back,
          <br className="sm:hidden" />
          <span className="text-wordmark-h"> {player?.displayName}</span>
        </h1>
      </div>

      {/* Rank + Points */}
      <div className="grid grid-cols-2 gap-3">
        {leaderboardLoading ? (
          <>
            <Skeleton className="h-[96px] rounded-lg" />
            <Skeleton className="h-[96px] rounded-lg" />
          </>
        ) : (
          <>
            <StatCard label="Your Rank" value={myEntry ? `#${myEntry.rank}` : '—'} />
            <StatCard label="Total Points" value={myEntry?.total_points ?? '—'} />
          </>
        )}
      </div>

      {/* Next match countdown + Latest result */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {upcomingLoading ? (
          <Skeleton className="h-[140px] rounded-lg" />
        ) : nextMatch ? (
          <NextMatchCard match={nextMatch} timezone={timezone} />
        ) : (
          <div className="rounded-lg border border-border bg-surface p-4 sm:p-5">
            <p className="text-[10px] font-mono text-text-muted uppercase tracking-[0.25em] mb-3">
              Next Match
            </p>
            <p className="text-text-muted font-sans text-sm">No upcoming matches</p>
          </div>
        )}
        {recentLoading ? (
          <Skeleton className="h-[140px] rounded-lg" />
        ) : latestPred ? (
          <LatestResultCard prediction={latestPred} timezone={timezone} />
        ) : (
          <div className="rounded-lg border border-border bg-surface p-4 sm:p-5">
            <p className="text-[10px] font-mono text-text-muted uppercase tracking-[0.25em] mb-3">
              Latest Result
            </p>
            <p className="text-text-muted font-sans text-sm">No results yet</p>
          </div>
        )}
      </div>

      {/* Mini leaderboard */}
      {leaderboardLoading ? (
        <div
          className="rounded-lg border border-border bg-surface p-4 space-y-3"
          aria-label="Loading standings"
        >
          <Skeleton className="h-3 w-24" />
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-3 w-4" />
              <Skeleton className="h-3 flex-1 max-w-[120px]" />
              <Skeleton className="h-3 w-8" />
            </div>
          ))}
        </div>
      ) : leaderboard.length > 0 && player?.id ? (
        <MiniLeaderboard entries={leaderboard} currentPlayerId={player.id} />
      ) : null}

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {NAV_CARDS.map((card) => (
          <NavCardLink key={card.to} card={card} />
        ))}
      </div>
    </div>
  );
}
