import { Fragment, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import type { LeaderboardEntry } from '../lib/types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLongPress } from '../hooks/useLongPress';
import { Skeleton } from '../components/ui/skeleton';
import { EmptyState } from '../components/EmptyState';

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

function rankArrow(prev: number | undefined, curr: number): string {
  if (prev === undefined || prev === curr) return '→';
  return prev > curr ? '↑' : '↓';
}

function arrowClass(prev: number | undefined, curr: number): string {
  if (prev === undefined || prev === curr) return 'text-text-muted';
  return prev > curr ? 'text-green-400' : 'text-red-400';
}

function LeaderboardRow({
  entry,
  prevRank,
  isOpen,
  onToggle,
  onLongPress,
}: {
  entry: LeaderboardEntry;
  prevRank: number | undefined;
  isOpen: boolean;
  onToggle: () => void;
  onLongPress: () => void;
}) {
  const arrow = rankArrow(prevRank, entry.rank);
  const aClass = arrowClass(prevRank, entry.rank);
  const handlers = useLongPress({ onLongPress, onClick: onToggle });

  return (
    <tr
      data-testid={`leaderboard-row-${entry.player_id}`}
      className="border-b border-border/50 last:border-0 hover:bg-surface-elevated transition-colors cursor-pointer select-none"
      {...handlers}
    >
      <td className="py-3 pl-4">
        <span className="text-text-muted font-mono text-xs">
          {MEDAL[entry.rank] ?? entry.rank}
        </span>
      </td>
      <td className="py-3">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-mono ${aClass}`}>{arrow}</span>
          <Link
            to={`/players/${entry.player_id}`}
            className="text-text-primary font-medium hover:text-primary transition-colors"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {entry.player_name}
          </Link>
          {!entry.is_active && (
            <span className="text-[10px] text-text-muted bg-surface-elevated px-1.5 py-0.5 rounded">
              inactive
            </span>
          )}
        </div>
      </td>
      <td className="py-3 text-center font-bold text-primary pr-2">
        {entry.total_points}
      </td>
      <td className="py-3 pr-4 text-center text-text-muted text-xs">
        {isOpen ? '▲' : '▼'}
      </td>
    </tr>
  );
}

export function LeaderboardPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { player: currentUser } = useAuth();
  const prevDataRef = useRef<LeaderboardEntry[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data = [], isLoading, error } = useQuery<LeaderboardEntry[]>({
    queryKey: ['leaderboard'],
    queryFn: () => apiFetch<LeaderboardEntry[]>('/api/v1/leaderboard'),
    staleTime: 15_000,
  });

  // Track previous data for rank arrows
  useEffect(() => {
    if (data.length > 0) {
      prevDataRef.current = data;
    }
  }, [data]);

  // Realtime: invalidate when a new leaderboard snapshot arrives
  useEffect(() => {
    const channel = supabase
      .channel('leaderboard-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'leaderboard_snapshots' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  function toggleExpand(playerId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) { next.delete(playerId); } else { next.add(playerId); }
      return next;
    });
  }

  function openCompare(playerId: string) {
    if (!currentUser?.id || currentUser.id === playerId) {
      navigate(`/compare?b=${playerId}`);
      return;
    }
    navigate(`/compare?a=${currentUser.id}&b=${playerId}`);
  }

  const prevByPlayer = Object.fromEntries(
    prevDataRef.current.map((e) => [e.player_id, e.rank]),
  );

  if (isLoading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-3xl text-primary tracking-wider">Leaderboard</h1>
        </div>
        <div
          className="rounded-lg border border-border bg-surface overflow-hidden divide-y divide-border/50"
          aria-label="Loading leaderboard"
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="h-4 w-6" />
              <Skeleton className="h-4 flex-1 max-w-[160px]" />
              <Skeleton className="h-4 w-10" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        title="Couldn't load the leaderboard"
        description="Refresh the page or check your connection."
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl text-primary tracking-wider">Leaderboard</h1>
        <div className="flex gap-3">
          <Link
            to="/compare"
            className="text-sm text-text-muted hover:text-primary font-sans transition-colors"
          >
            Compare →
          </Link>
          <Link
            to="/leaderboard/history"
            className="text-sm text-text-muted hover:text-primary font-sans transition-colors"
          >
            History →
          </Link>
          <Link
            to="/leaderboard/round/group"
            className="text-sm text-text-muted hover:text-primary font-sans transition-colors"
          >
            Round →
          </Link>
        </div>
      </div>

      {data.length === 0 ? (
        <EmptyState
          title="No results entered yet"
          description="The leaderboard fills in as match results are confirmed. Check back after the first kickoff!"
        />
      ) : (
        <div className="rounded-lg border border-border bg-surface overflow-hidden">
          <table className="w-full text-sm font-sans">
            <thead>
              <tr className="border-b border-border text-text-muted text-xs">
                <th className="py-3 pl-4 text-left w-8">#</th>
                <th className="py-3 text-left">Player</th>
                <th className="py-3 text-center w-12 pr-2">Pts</th>
                <th className="py-3 pr-4 text-center w-8"></th>
              </tr>
            </thead>
            <tbody>
              {data.map((entry) => {
                const isOpen = expanded.has(entry.player_id);
                return (
                  <Fragment key={entry.player_id}>
                    <LeaderboardRow
                      entry={entry}
                      prevRank={prevByPlayer[entry.player_id]}
                      isOpen={isOpen}
                      onToggle={() => toggleExpand(entry.player_id)}
                      onLongPress={() => openCompare(entry.player_id)}
                    />
                    {isOpen && (
                      <tr className="bg-surface-elevated border-b border-border/50">
                        <td colSpan={4} className="py-3 pl-10 pr-4">
                          <div className="flex gap-6 text-xs text-text-muted">
                            <span>
                              Match{' '}
                              <span className="text-text-secondary font-medium">
                                {entry.match_points}
                              </span>
                            </span>
                            <span>
                              Knockout{' '}
                              <span className="text-text-secondary font-medium">
                                {entry.knockout_winner_points}
                              </span>
                            </span>
                            <span>
                              Special{' '}
                              <span className="text-text-secondary font-medium">
                                {entry.special_points}
                              </span>
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
