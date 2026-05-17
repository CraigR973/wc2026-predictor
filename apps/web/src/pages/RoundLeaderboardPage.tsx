import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import type { RoundEntry } from '../lib/types';
import { Skeleton } from '../components/ui/skeleton';
import { EmptyState } from '../components/EmptyState';

const STAGES = [
  { value: 'group', label: 'Group Stage' },
  { value: 'r32', label: 'Round of 32' },
  { value: 'r16', label: 'Round of 16' },
  { value: 'qf', label: 'Quarter-finals' },
  { value: 'sf', label: 'Semi-finals' },
  { value: 'third_place', label: 'Third Place' },
  { value: 'final', label: 'Final' },
];

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export function RoundLeaderboardPage() {
  const { stage = 'group' } = useParams<{ stage: string }>();
  const navigate = useNavigate();

  const { data = [], isLoading, error } = useQuery<RoundEntry[]>({
    queryKey: ['leaderboard-round', stage],
    queryFn: () => apiFetch<RoundEntry[]>(`/api/v1/leaderboard/round/${stage}`),
    staleTime: 30_000,
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl text-primary tracking-wider">Round Leaderboard</h1>
        <Link
          to="/leaderboard"
          className="text-sm text-text-muted hover:text-primary font-sans transition-colors"
        >
          ← Overall
        </Link>
      </div>

      {/* Stage selector */}
      <div className="flex flex-wrap gap-2 mb-6">
        {STAGES.map((s) => (
          <button
            key={s.value}
            onClick={() => navigate(`/leaderboard/round/${s.value}`)}
            className={`px-3 py-1.5 rounded-full text-xs font-sans font-medium border transition-colors ${
              stage === s.value
                ? 'border-primary bg-primary/20 text-primary'
                : 'border-border text-text-muted hover:text-text-primary hover:border-border/80'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div
          className="rounded-lg border border-border bg-surface overflow-hidden divide-y divide-border/50"
          aria-label="Loading round leaderboard"
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="h-4 w-6" />
              <Skeleton className="h-4 flex-1 max-w-[160px]" />
              <Skeleton className="h-4 w-10" />
            </div>
          ))}
        </div>
      ) : error ? (
        <EmptyState
          title="Couldn't load round leaderboard"
          description="Refresh the page or check your connection."
        />
      ) : data.length === 0 || data.every((e) => e.points === 0) ? (
        <EmptyState
          title="No points scored in this round yet"
          description="Once results are entered for this round, the per-round standings will appear here."
        />
      ) : (
        <div className="rounded-lg border border-border bg-surface overflow-hidden">
          <table className="w-full text-sm font-sans">
            <thead>
              <tr className="border-b border-border text-text-muted text-xs">
                <th className="py-3 pl-4 text-left w-8">#</th>
                <th className="py-3 text-left">Player</th>
                <th className="py-3 pr-4 text-center w-16 font-semibold">Pts</th>
              </tr>
            </thead>
            <tbody>
              {data.map((entry) => (
                <tr
                  key={entry.player_id}
                  className="border-b border-border/50 last:border-0 hover:bg-surface-elevated transition-colors"
                >
                  <td className="py-3 pl-4 text-text-muted font-mono text-xs">
                    {MEDAL[entry.rank] ?? entry.rank}
                  </td>
                  <td className="py-3 text-text-primary font-medium">{entry.player_name}</td>
                  <td className="py-3 pr-4 text-center font-bold text-primary">{entry.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
