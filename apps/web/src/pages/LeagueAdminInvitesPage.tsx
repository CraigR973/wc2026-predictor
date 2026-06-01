import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch, DEFAULT_LEAGUE_SLUG } from '@/lib/api';
import type { LeagueInvite } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/PageHeader';

export function LeagueAdminInvitesPage() {
  const { slug = DEFAULT_LEAGUE_SLUG } = useParams<{ slug: string }>();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const { data: invites, isLoading } = useQuery<LeagueInvite[]>({
    queryKey: ['league-invites', slug],
    queryFn: () => apiFetch<LeagueInvite[]>(`/api/v1/leagues/${slug}/invites`),
  });

  async function createInvite(e: React.FormEvent) {
    e.preventDefault();
    setIsCreating(true);
    try {
      const invite = await apiFetch<LeagueInvite>(`/api/v1/leagues/${slug}/invites`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      toast.success('Invite created');
      queryClient.invalidateQueries({ queryKey: ['league-invites', slug] });
      const joinUrl = `${window.location.origin}/join/${invite.token}`;
      await navigator.clipboard.writeText(joinUrl).catch(() => {});
      toast.info('Join link copied to clipboard');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create invite');
    } finally {
      setIsCreating(false);
    }
  }

  async function revokeInvite(id: string) {
    setRevokingId(id);
    try {
      await apiFetch(`/api/v1/leagues/${slug}/invites/${id}`, { method: 'DELETE' });
      toast.success('Invite revoked');
      queryClient.invalidateQueries({ queryKey: ['league-invites', slug] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke');
    } finally {
      setRevokingId(null);
    }
  }

  function copyLink(token: string) {
    const url = `${window.location.origin}/join/${token}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success('Link copied'),
      () => toast.info(url),
    );
  }

  const activeInvites = invites?.filter((i) => !i.used_at) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Invites" />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create invite</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={createInvite}>
            <Button type="submit" disabled={isCreating} className="w-full">
              {isCreating ? 'Creating…' : 'Generate invite link'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      )}

      {!isLoading && activeInvites.length === 0 && (
        <p className="text-text-muted font-sans text-sm text-center py-4">No active invites.</p>
      )}

      {activeInvites.length > 0 && (
        <div className="space-y-2">
          {activeInvites.map((invite) => (
            <Card key={invite.id}>
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-mono truncate text-text-secondary">
                      {`${window.location.origin}/join/${invite.token}`}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyLink(invite.token)}
                    >
                      Copy
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-error hover:bg-error/10"
                      disabled={revokingId === invite.id}
                      onClick={() => revokeInvite(invite.id)}
                    >
                      Revoke
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
