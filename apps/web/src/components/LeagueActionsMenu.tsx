import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { LogOut, MoreHorizontal, Settings, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface LeagueActionsMenuProps {
  slug: string;
  leagueName: string;
  isAdmin: boolean;
  className?: string;
  triggerClassName?: string;
}

export function LeagueActionsMenu({
  slug,
  leagueName,
  isAdmin,
  className,
  triggerClassName,
}: LeagueActionsMenuProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [isLeaving, setIsLeaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleLeaveLeague() {
    setIsLeaving(true);
    try {
      await apiFetch(`/api/v1/leagues/${slug}/membership`, { method: 'DELETE' });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['leagues', 'mine'] }),
        queryClient.invalidateQueries({ queryKey: ['league', slug] }),
        queryClient.invalidateQueries({ queryKey: ['league-members', slug] }),
        queryClient.invalidateQueries({ queryKey: ['leaderboard', slug] }),
      ]);
      toast.success('Left the league');
      navigate('/leagues', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to leave');
      setIsLeaving(false);
    }
  }

  async function handleDeleteLeague() {
    if (deleteConfirm !== leagueName) {
      toast.error('Type the league name exactly to confirm deletion');
      return;
    }

    setIsDeleting(true);
    try {
      await apiFetch(`/api/v1/leagues/${slug}`, { method: 'DELETE' });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['leagues', 'mine'] }),
        queryClient.invalidateQueries({ queryKey: ['league', slug] }),
      ]);
      toast.success('League deleted');
      navigate('/leagues', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
      setIsDeleting(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="outline"
            aria-label={`${leagueName} actions`}
            className={cn('h-9 w-9 shrink-0', triggerClassName)}
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className={className}>
          <DropdownMenuItem asChild>
            <Link to={`/leagues/${slug}/admin/members`}>
              <Users className="h-4 w-4" aria-hidden />
              Members
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setShowLeaveDialog(true)}>
            <LogOut className="h-4 w-4" aria-hidden />
            Leave league
          </DropdownMenuItem>
          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to={`/leagues/${slug}/admin/settings`}>
                  <Settings className="h-4 w-4" aria-hidden />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => setShowDeleteDialog(true)}
                className="text-error focus:text-error"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                Delete league
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={showLeaveDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowLeaveDialog(false);
            setLeaveConfirm('');
            setIsLeaving(false);
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Leave league</DialogTitle>
            <DialogDescription>
              Type <strong>LEAVE</strong> to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 space-y-3">
            <Input
              value={leaveConfirm}
              onChange={(e) => setLeaveConfirm(e.target.value)}
              placeholder="Type LEAVE to confirm"
            />
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowLeaveDialog(false);
                  setLeaveConfirm('');
                  setIsLeaving(false);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                className="border-error/40 text-error hover:bg-error/10"
                disabled={leaveConfirm !== 'LEAVE' || isLeaving}
                onClick={handleLeaveLeague}
              >
                {isLeaving ? 'Leaving…' : 'Leave'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showDeleteDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowDeleteDialog(false);
            setDeleteConfirm('');
            setIsDeleting(false);
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete league</DialogTitle>
            <DialogDescription>
              Type <strong>{leagueName}</strong> to confirm deletion.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 space-y-3">
            <Input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="Type league name to confirm"
            />
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowDeleteDialog(false);
                  setDeleteConfirm('');
                  setIsDeleting(false);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={deleteConfirm !== leagueName || isDeleting}
                onClick={handleDeleteLeague}
              >
                {isDeleting ? 'Deleting…' : 'Delete league'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
