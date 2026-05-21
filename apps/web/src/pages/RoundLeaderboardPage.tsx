import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import type { RoundEntry } from '../lib/types';
import { Skeleton } from '../components/ui/skeleton';
import { Button } from '../components/ui/button';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { cn } from '../lib/utils';

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

  const { data = [], isLoading, error, refetch, isRefetching } = useQuery<RoundEntry[]>({
    queryKey: ['leaderboard-round', stage],
    queryFn: () => apiFetch<RoundEntry[]>(`/api/v1/leaderboard/round/${stage}`),
    staleTime: 30_000,
  });

  return (
    <div>
      <PageHeader
        title="Round Leaderboard"
        eyebrow="Standings"
        action={
          <Link
            to="/leaderboard"
            className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium font-sans bg-surface text-text-secondary hover:bg-surface-elevated border border-border transition-colors press-down focus-visible:outline-none focus-visible:shadow-glow"
          >
            ← Overall
          </Link>
        }
      />

      {/* Stage pill scroller */}
      <nav className="-mx-4 sm:-mx-0 mb-5 overflow-x-auto" aria-label="Tournament stage">
        <div className="flex gap-1.5 px-4 sm:px-0 min-w-max">
          {STAGES.map((s) => {
            const active = stage === s.value;
            return (
              <button
                key={s.value}
                onClick={() => navigate(`/leaderboard/round/${s.value}`)}
                className={cn(
                  'inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-medium font-sans whitespace-nowrap transition-colors press-down focus-visible:outline-none focus-visible:shadow-glow',
                  active
                    ? 'bg-primary/15 text-primary border border-primary/30'
                    : 'bg-surface text-text-secondary hover:bg-surface-elevated border border-border',
                )}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </nav>

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
          action={
            <Button variant="outline" size="sm" disabled={isRefetching} onClick={() => refetch()}>
              {isRefetching ? 'Retrying…' : 'Try again'}
            </Button>
          }
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
