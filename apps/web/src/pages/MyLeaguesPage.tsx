import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { dedupedLeaderboard } from '@/lib/leaderboard';
import type { LeagueSummary, LeaderboardEntry } from '@/lib/types';
import { privacyLabel } from '@/lib/leagues';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/PageHeader';
import { useAuth } from '@/contexts/AuthContext';

function LeagueCard({ league }: { league: LeagueSummary }) {
  const { player } = useAuth();

  const { data: leaderboard = [], isLoading: lbLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ['leaderboard', league.slug],
    queryFn: () => apiFetch<LeaderboardEntry[]>(`/api/v1/leagues/${league.slug}/leaderboard`),
    staleTime: 30_000,
  });

  const myEntry = player
    ? dedupedLeaderboard(leaderboard, league.slug).find((e) => e.player_id === player.id)
    : undefined;

  return (
    <Link to={`/leagues/${league.slug}`} className="block h-full group">
      <Card className="flex h-full flex-col hover:border-primary/40 transition-colors group-hover:border-primary/40">
        <CardHeader className="pb-2 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base group-hover:text-primary transition-colors">
              {league.name}
            </CardTitle>
            <Badge variant="muted" className="shrink-0 text-xs">
              {privacyLabel(league.privacy)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col justify-between pt-0">
          {league.description && (
            <p className="text-sm text-text-secondary font-sans mb-3 line-clamp-2">
              {league.description}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-sans text-text-muted">
            <span>
              {league.member_count}
              {league.max_members ? ` / ${league.max_members}` : ''} members
            </span>
            {lbLoading ? (
              <Skeleton className="h-3 w-20" />
            ) : myEntry ? (
              <>
                <span className="text-border">·</span>
                <span data-testid={`rank-${league.slug}`}>
                  Rank <span className="font-semibold text-text-primary">#{myEntry.rank}</span>
                </span>
                <span className="text-border">·</span>
                <span data-testid={`points-${league.slug}`}>
                  <span className="font-semibold text-text-primary">{myEntry.total_points}</span> pts
                </span>
              </>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function MyLeaguesPage() {
  const { data: leagues, isLoading } = useQuery<LeagueSummary[]>({
    queryKey: ['leagues', 'mine'],
    queryFn: () => apiFetch<LeagueSummary[]>('/api/v1/leagues/mine'),
  });

  return (
    <div className="space-y-6 overflow-x-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <PageHeader title="My Leagues" />
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap">
          <Button asChild variant="outline" size="sm">
            <Link to="/leagues/discover">Discover</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/leagues/join">Join</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/leagues/new">+ New</Link>
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      )}

      {!isLoading && leagues && leagues.length === 0 && (
        <Card>
          <CardContent className="pt-8 pb-8 text-center">
            <p className="text-text-secondary font-sans text-sm mb-4">
              You&apos;re not in any leagues yet.
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <Button asChild size="sm">
                <Link to="/leagues/new">Create league</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/leagues/join">Join by code</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/leagues/discover">Browse leagues</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && leagues && leagues.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {leagues.map((l) => (
            <LeagueCard key={l.slug} league={l} />
          ))}
        </div>
      )}
    </div>
  );
}
