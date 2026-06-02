import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch, DEFAULT_LEAGUE_SLUG } from '@/lib/api';
import type { LeaderboardEntry, LeagueDetail } from '@/lib/types';
import { dedupedLeaderboard } from '@/lib/leaderboard';
import { buildInviteMessage, shareInvite } from '@/lib/invite';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/PageHeader';
import { useAuth } from '@/contexts/AuthContext';

export function LeagueHomePage() {
  const { slug = DEFAULT_LEAGUE_SLUG } = useParams<{ slug: string }>();
  const { player } = useAuth();
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied'>('idle');

  const { data: league, isLoading: leagueLoading } = useQuery<LeagueDetail>({
    queryKey: ['league', slug],
    queryFn: () => apiFetch<LeagueDetail>(`/api/v1/leagues/${slug}`),
  });

  const isLeagueAdmin =
    league?.members?.some((m) => m.id === player?.id && m.role === 'admin') ?? false;

  const { data: leaderboard, isLoading: lbLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ['leaderboard', slug],
    queryFn: () => apiFetch<LeaderboardEntry[]>(`/api/v1/leagues/${slug}/leaderboard`),
  });

  const displayData = dedupedLeaderboard(leaderboard ?? [], slug);
  const myEntry = displayData.find((e) => e.player_id === player?.id);

  async function handleShare() {
    if (!league?.join_code) return;
    const message = buildInviteMessage({
      leagueName: league.name,
      joinCode: league.join_code,
      origin: window.location.origin,
    });
    const url = `${window.location.origin}/join/${league.join_code}`;
    try {
      const result = await shareInvite({ message, url });
      if (result === 'copied') {
        setShareStatus('copied');
        setTimeout(() => setShareStatus('idle'), 2000);
      }
      // 'shared' and 'cancelled' both just return to idle — no state change needed
    } catch {
      toast.error('Could not share invite');
    }
  }

  if (leagueLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <PageHeader title={league?.name ?? slug} back={{ to: '/leagues', label: 'Leagues' }} />
          {league?.description && (
            <p className="text-text-secondary font-sans text-sm mt-1">{league.description}</p>
          )}
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap justify-end">
          {league?.join_code && (
            <Button size="sm" variant="accent" onClick={handleShare} className="gap-1.5">
              <Share2 className="h-3.5 w-3.5" aria-hidden />
              {shareStatus === 'copied' ? 'Copied!' : 'Invite'}
            </Button>
          )}
          <Button asChild size="sm" variant="outline">
            <Link to={`/leagues/${slug}/admin/members`}>Members</Link>
          </Button>
          {isLeagueAdmin && (
            <>
              <Button asChild size="sm" variant="outline">
                <Link to={`/leagues/${slug}/admin/invites`}>Invites</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to={`/leagues/${slug}/admin/settings`}>Settings</Link>
              </Button>
            </>
          )}
        </div>
      </div>

      {myEntry && (
        <Card className="border-primary/30">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-sans text-text-secondary">Your position</span>
              <div className="flex items-center gap-3">
                <Badge variant="muted" className="font-mono">
                  #{myEntry.rank}
                </Badge>
                <span className="font-semibold font-mono text-primary">
                  {myEntry.total_points} pts
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Standings</CardTitle>
            <Button asChild size="sm" variant="ghost" className="text-xs">
              <Link to={`/leagues/${slug}/leaderboard`}>Full table →</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {lbLoading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : (
            <table className="w-full text-sm font-sans">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2 text-text-muted font-normal text-xs">#</th>
                  <th className="text-left px-4 py-2 text-text-muted font-normal text-xs">Player</th>
                  <th className="text-right px-4 py-2 text-text-muted font-normal text-xs">Pts</th>
                </tr>
              </thead>
              <tbody>
                {displayData.slice(0, 10).map((entry) => (
                  <tr
                    key={entry.player_id}
                    className={`border-b border-border/50 last:border-0 ${
                      entry.player_id === player?.id ? 'bg-primary/5' : ''
                    }`}
                  >
                    <td className="px-4 py-2 text-text-muted font-mono text-xs">{entry.rank}</td>
                    <td className="px-4 py-2">
                      <Link
                        to={`/players/${entry.player_id}`}
                        className="hover:text-primary transition-colors"
                      >
                        {entry.player_name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-right font-mono font-semibold">
                      {entry.total_points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button asChild variant="outline" className="flex-1">
          <Link to={`/leagues/${slug}/leaderboard/history`}>History</Link>
        </Button>
        <Button asChild variant="outline" className="flex-1">
          <Link to={`/leagues/${slug}/compare`}>Compare</Link>
        </Button>
      </div>
    </div>
  );
}
