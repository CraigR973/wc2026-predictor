import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
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
    <div className="rounded-lg border border-border bg-surface p-4 flex flex-col gap-1">
      <span className="text-xs text-text-muted font-sans uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-primary font-display">{value}</span>
    </div>
  );
}

function outcomeClass(pts: number | null): string {
  if (pts === null) return 'text-text-muted';
  if (pts === 0) return 'text-red-400';
  return 'text-green-400';
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
      <div className="text-text-muted text-sm font-sans text-center py-16">Loading profile…</div>
    );
  }

  if (error || !stats) {
    return (
      <div className="text-red-400 text-sm font-sans text-center py-16">
        Player not found.{' '}
        <Link to="/leaderboard" className="underline hover:text-primary">
          Back to leaderboard
        </Link>
      </div>
    );
  }

  const h2hTarget = isSelf ? null : myStats ?? null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-primary tracking-wider">
            {stats.player_name}
          </h1>
          <p className="text-text-muted text-sm font-sans mt-1">
            {stats.total_predictions_settled} predictions settled
          </p>
        </div>
        <Link
          to="/leaderboard"
          className="text-sm text-text-muted hover:text-primary font-sans transition-colors"
        >
          ← Leaderboard
        </Link>
      </div>

      {/* Stat cards */}
      <div>
        <h2 className="font-display text-lg text-text-secondary tracking-wider mb-3">Stats</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard label="Total Points" value={stats.total_points} />
          <StatCard label="Accuracy" value={`${stats.accuracy_pct}%`} />
          <StatCard label="Exact Score" value={`${stats.exact_rate_pct}%`} />
          <StatCard label="Avg Pts / Match" value={stats.avg_pts_per_prediction} />
          <StatCard label="Current Streak" value={`${stats.current_streak}🔥`} />
          <StatCard
            label="Avg Submit Time"
            value={
              stats.avg_prediction_timing_mins !== null
                ? `${Math.round(stats.avg_prediction_timing_mins / 60)}h before`
                : '—'
            }
          />
        </div>
      </div>

      {/* Best / worst round */}
      {(stats.best_round || stats.worst_round) && (
        <div>
          <h2 className="font-display text-lg text-text-secondary tracking-wider mb-3">
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
      )}

      {/* Head-to-head mini table (only shown when viewing another player) */}
      {h2hTarget && (
        <div>
          <h2 className="font-display text-lg text-text-secondary tracking-wider mb-3">
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
          <h2 className="font-display text-lg text-text-secondary tracking-wider mb-3">
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
                {recentPreds.map((p) => (
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
                    <td className={`py-2 pr-4 text-center font-bold ${outcomeClass(p.points_awarded)}`}>
                      {p.points_awarded ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {recentPreds.length === 0 && stats.total_predictions_settled === 0 && (
        <div className="rounded-lg border border-border bg-surface px-6 py-8 text-center text-text-muted text-sm font-sans">
          No settled predictions yet — check back after the first match!
        </div>
      )}
    </div>
  );
}
