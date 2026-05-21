import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import type { GroupResponse } from '../lib/types';
import { supabase } from '../lib/supabase';
import { Skeleton } from '../components/ui/skeleton';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';

function StandingsTable({ group }: { group: GroupResponse }) {
  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      <div className="px-4 py-2 border-b border-border flex items-center justify-between">
        <h2 className="text-base font-semibold text-text-primary font-sans tracking-tight">
          Group {group.name}
        </h2>
        <Link
          to={`/groups/${group.name}`}
          className="text-xs text-text-muted hover:text-primary font-sans transition-colors"
        >
          Details →
        </Link>
      </div>
      <table className="w-full text-sm font-sans">
        <thead>
          <tr className="border-b border-border text-text-muted text-xs">
            <th className="py-2 pl-4 text-left w-6">#</th>
            <th className="py-2 text-left">Team</th>
            <th className="py-2 text-center w-8">P</th>
            <th className="py-2 text-center w-8">W</th>
            <th className="py-2 text-center w-8">D</th>
            <th className="py-2 text-center w-8">L</th>
            <th className="py-2 text-center w-10">GD</th>
            <th className="py-2 pr-4 text-center w-10 font-semibold">Pts</th>
          </tr>
        </thead>
        <tbody>
          {group.standings.map((s) => (
            <tr
              key={s.team_id}
              className="border-b border-border/50 last:border-0 hover:bg-surface-elevated transition-colors"
            >
              <td className="py-2 pl-4 text-text-muted">{s.position}</td>
              <td className="py-2">
                <span className="mr-1.5">{s.flag_emoji}</span>
                <span className="text-text-primary">{s.team_code}</span>
                <span className="text-text-muted ml-1 hidden sm:inline">{s.team_name}</span>
              </td>
              <td className="py-2 text-center text-text-secondary">{s.played}</td>
              <td className="py-2 text-center text-text-secondary">{s.won}</td>
              <td className="py-2 text-center text-text-secondary">{s.drawn}</td>
              <td className="py-2 text-center text-text-secondary">{s.lost}</td>
              <td className="py-2 text-center text-text-secondary">
                {s.gd > 0 ? `+${s.gd}` : s.gd}
              </td>
              <td className="py-2 pr-4 text-center font-semibold text-text-primary">
                {s.points}
              </td>
            </tr>
          ))}
          {group.standings.length === 0 && (
            <tr>
              <td colSpan={8} className="py-4 text-center text-text-muted text-xs">
                No results yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function GroupsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<GroupResponse[]>({
    queryKey: ['groups'],
    queryFn: () => apiFetch<GroupResponse[]>('/api/v1/groups'),
    staleTime: 30_000,
  });

  // Supabase Realtime: invalidate groups query when any match is updated
  useEffect(() => {
    const channel = supabase
      .channel('matches-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['groups'] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return (
    <div>
      <PageHeader title="Groups" eyebrow="Standings" />

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" aria-label="Loading group standings">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[260px] w-full" />
          ))}
        </div>
      )}
      {error && (
        <EmptyState
          title="Couldn't load groups"
          description="There was a problem reaching the server. Try again in a moment."
        />
      )}

      {!isLoading && !error && (data ?? []).length === 0 && (
        <EmptyState
          title="No groups configured"
          description="Group standings will appear once the draw is finalised."
        />
      )}

      {!isLoading && (data ?? []).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(data ?? []).map((group) => (
            <StandingsTable key={group.id} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}
