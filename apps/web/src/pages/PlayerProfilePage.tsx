import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { formatSubmitTime } from '../lib/format';
import { Skeleton } from '../components/ui/skeleton';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { PointsBreakdownPopover } from '../components/PointsBreakdownPopover';
import type { PlayerStats, RecentPrediction } from '../lib/types';

const STAGE_LABEL: Record<string, string> = {
  group: 'Group Stage',
  r32: 'Round of 32',
  r16: 'Round of 16',
  qf: 'Quarter-Finals',
  sf: 'Semi-Finals',
  third_place: 'Third Place',
  final: 'Final',
};

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 flex flex-col gap-2">
      <span className="text-[10px] font-mono text-text-muted uppercase tracking-[0.25em]">
        {label}
      </span>
      <span className="font-mono text-2xl font-semibold text-primary tabular-nums leading-none">
        {value}
      </span>
    </div>
  );
}

function outcomeClass(pts: number | null, isUnfinished: boolean): string {
  if (isUnfinished || pts === null) return 'text-text-muted';
  if (pts === 0) return 'text-red-400';
  return 'text-green-400';
}

function isMatchUnfinished(p: RecentPrediction): boolean {
  return p.actual_home === null || p.actual_away === null;
}

export function PlayerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { player: currentUser } = useAuth();
  const isSelf = currentUser?.id === id;

  const { data: stats, isLoading, error } = useQuery<PlayerStats>({
    queryKey: ['stats', id],
    queryFn: () => apiFetch<PlayerStats>(`/api/v1/stats/${id}`),
    enabled: !!id,
  });

  const { data: myStats } = useQuery<PlayerStats>({
    queryKey: ['stats', 'me'],
    queryFn: () => apiFetch<PlayerStats>('/api/v1/stats/me'),
    enabled: !isSelf,
  });

  const { data: recentPreds = [] } = useQuery<RecentPrediction[]>({
    queryKey: ['player-recent-preds', id],
    queryFn: () => apiFetch<RecentPrediction[]>(`/api/v1/players/${id}/predictions/recent`),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div>
          <Skeleton className="h-5 w-16 mb-3" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[88px]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <EmptyState
        title="Player not found"
        description="This profile either doesn't exist or couldn't be loaded."
        action={
          <Link to="/leagues" className="text-primary text-sm font-sans hover:underline">
            ← Back to leaderboard
          </Link>
        }
      />
    );
  }

  const h2hTarget = isSelf ? null : myStats ?? null;

  // U3.5: streak — only show 🔥 when streak >= 2
  const streakDisplay =
    stats.current_streak >= 2
      ? `${stats.current_streak}🔥`
      : stats.current_streak === 0
        ? '—'
        : `${stats.current_streak}`;

  // U3.7: collapse best/worst when zero settled rounds and both are 0
  const hasRoundVariance =
    stats.total_predictions_settled > 0 &&
    (stats.best_round !== null || stats.worst_round !== null);
  const showBestWorstPlaceholder =
    !hasRoundVariance &&
    stats.total_predictions_settled === 0 &&
    (stats.best_round !== null || stats.worst_round !== null
      ? false
      : true);

  return (
    <div className="space-y-7">
      <PageHeader
        title={stats.player_name}
        eyebrow={`${stats.total_predictions_settled} predictions settled`}
        back={{ to: '/leagues', label: 'Leagues' }}
      />

      {/* Stat cards */}
      <div>
        <h2 className="text-base font-semibold text-text-primary font-sans tracking-tight mb-3">Stats</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard label="Total Points" value={stats.total_points} />
          <StatCard label="Accuracy" value={`${stats.accuracy_pct}%`} />
          <StatCard label="Exact Score" value={`${stats.exact_rate_pct}%`} />
          <StatCard label="Avg Pts / Match" value={stats.avg_pts_per_prediction} />
          <StatCard label="Current Streak" value={streakDisplay} />
          <StatCard
            label="Avg Submit Time"
            value={
              stats.avg_prediction_timing_mins !== null
                ? formatSubmitTime(stats.avg_prediction_timing_mins)
                : '—'
            }
          />
        </div>
      </div>

      {/* Best / worst round */}
      {hasRoundVariance ? (
        <div>
          <h2 className="text-base font-semibold text-text-primary font-sans tracking-tight mb-3">
            Best &amp; Worst Round
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {stats.best_round && (
              <div className="rounded-lg border border-border bg-surface p-4">
                <span className="text-xs text-text-muted font-sans uppercase tracking-wide">
                  Best
                </span>
                <p className="text-text-primary font-medium mt-1">
                  {STAGE_LABEL[stats.best_round] ?? stats.best_round}
                </p>
                <p className="text-primary font-bold text-xl">{stats.best_round_points} pts</p>
              </div>
            )}
            {stats.worst_round && (
              <div className="rounded-lg border border-border bg-surface p-4">
                <span className="text-xs text-text-muted font-sans uppercase tracking-wide">
                  Worst
                </span>
                <p className="text-text-primary font-medium mt-1">
                  {STAGE_LABEL[stats.worst_round] ?? stats.worst_round}
                </p>
                <p className="text-primary font-bold text-xl">{stats.worst_round_points} pts</p>
              </div>
            )}
          </div>
        </div>
      ) : showBestWorstPlaceholder ? (
        <div className="rounded-lg border border-dashed border-border bg-surface/40 px-4 py-3 text-center">
          <p className="text-sm font-sans text-text-muted">No round results yet</p>
        </div>
      ) : null}

      {/* Head-to-head mini table (only shown when viewing another player) */}
      {h2hTarget && (
        <div>
          <h2 className="text-base font-semibold text-text-primary font-sans tracking-tight mb-3">
            You vs {stats.player_name}
          </h2>
          <div className="rounded-lg border border-border bg-surface overflow-hidden">
            <table className="w-full text-sm font-sans">
              <thead>
                <tr className="border-b border-border text-text-muted text-xs">
                  <th className="py-2 pl-4 text-left">Metric</th>
                  <th className="py-2 text-center">You</th>
                  <th className="py-2 pr-4 text-center">{stats.player_name}</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ['Total Points', h2hTarget.total_points, stats.total_points],
                    [
                      'Accuracy',
                      `${h2hTarget.accuracy_pct}%`,
                      `${stats.accuracy_pct}%`,
                    ],
                    [
                      'Exact Rate',
                      `${h2hTarget.exact_rate_pct}%`,
                      `${stats.exact_rate_pct}%`,
                    ],
                    ['Streak', h2hTarget.current_streak, stats.current_streak],
                    [
                      'Avg Pts',
                      h2hTarget.avg_pts_per_prediction,
                      stats.avg_pts_per_prediction,
                    ],
                  ] as [string, string | number, string | number][]
                ).map(([label, me, them]) => (
                  <tr key={label} className="border-b border-border/50 last:border-0">
                    <td className="py-2 pl-4 text-text-muted">{label}</td>
                    <td className="py-2 text-center font-medium text-text-primary">{me}</td>
                    <td className="py-2 pr-4 text-center font-medium text-text-primary">{them}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent predictions */}
      {recentPreds.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-text-primary font-sans tracking-tight mb-3">
            Recent Predictions
          </h2>
          <div className="rounded-lg border border-border bg-surface overflow-hidden">
            <table className="w-full text-sm font-sans">
              <thead>
                <tr className="border-b border-border text-text-muted text-xs">
                  <th className="py-2 pl-4 text-left">Match</th>
                  <th className="py-2 text-center">Result</th>
                  <th className="py-2 text-center">Predicted</th>
                  <th className="py-2 pr-4 text-center">Pts</th>
                </tr>
              </thead>
              <tbody>
                {recentPreds.map((p) => {
                  const unfinished = isMatchUnfinished(p);
                  return (
                    <tr
                      key={p.match_id}
                      className="border-b border-border/50 last:border-0"
                    >
                      <td className="py-2 pl-4">
                        <span className="text-text-primary">
                          {p.home_team_flag} {p.home_team_name ?? '?'} vs{' '}
                          {p.away_team_flag} {p.away_team_name ?? '?'}
                        </span>
                        <span className="block text-xs text-text-muted">
                          {STAGE_LABEL[p.stage] ?? p.stage}
                        </span>
                      </td>
                      <td className="py-2 text-center text-text-secondary font-mono">
                        {p.actual_home ?? '?'}–{p.actual_away ?? '?'}
                      </td>
                      <td className="py-2 text-center text-text-secondary font-mono">
                        {p.predicted_home ?? '?'}–{p.predicted_away ?? '?'}
                      </td>
                      <td className={`py-2 pr-4 text-center font-bold ${outcomeClass(p.points_awarded, unfinished)}`}>
                        {unfinished ? '—' : (
                          p.points_awarded != null ? (
                            <PointsBreakdownPopover breakdown={p.points_breakdown}>
                              <span>{p.points_awarded}</span>
                            </PointsBreakdownPopover>
                          ) : '—'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {recentPreds.length === 0 && stats.total_predictions_settled === 0 && (
        <EmptyState
          title="No settled predictions yet"
          description="Predictions show up here after each match is settled."
        />
      )}
    </div>
  );
}
