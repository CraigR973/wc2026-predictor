import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import type { RoundEntry } from '../lib/types';

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
        <div className="text-text-muted text-sm font-sans text-center py-12">Loading…</div>
      ) : error ? (
        <div className="text-red-400 text-sm font-sans text-center py-12">
          Failed to load round leaderboard.
        </div>
      ) : data.length === 0 || data.every((e) => e.points === 0) ? (
        <div className="rounded-lg border border-border bg-surface px-6 py-10 text-center text-text-muted text-sm font-sans">
          No points scored in this round yet.
        </div>
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
