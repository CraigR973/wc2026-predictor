import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface AdminPlayer {
  id: string;
  display_name: string;
  role: string;
  timezone: string;
  is_deleted: boolean;
  created_at: string;
}

export function AdminPlayersPage() {
  const { player: currentPlayer } = useAuth();
  const [players, setPlayers] = useState<AdminPlayer[]>([]);
  const [showDeleted, setShowDeleted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Reset PIN dialog
  const [resetTarget, setResetTarget] = useState<AdminPlayer | null>(null);
  const [tempPin, setTempPin] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [pinCopied, setPinCopied] = useState(false);

  async function load(includeDeleted: boolean) {
    setIsLoading(true);
    setError('');
    try {
      const data = await apiFetch<AdminPlayer[]>(
        `/api/v1/admin/players?include_deleted=${includeDeleted}`,
      );
      setPlayers(data);
    } catch {
      setError('Failed to load players.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load(showDeleted);
  }, [showDeleted]);

  async function handleDelete(p: AdminPlayer) {
    if (!window.confirm(`Remove ${p.display_name} from the league? This cannot be undone.`)) return;
    try {
      await apiFetch(`/api/v1/admin/players/${p.id}`, { method: 'DELETE' });
      setPlayers((prev) =>
        showDeleted
          ? prev.map((pl) => (pl.id === p.id ? { ...pl, is_deleted: true } : pl))
          : prev.filter((pl) => pl.id !== p.id),
      );
    } catch {
      alert('Failed to remove player.');
    }
  }

  async function handleResetPin() {
    if (!resetTarget) return;
    setResetting(true);
    try {
      const data = await apiFetch<{ temp_pin: string }>(
        `/api/v1/admin/players/${resetTarget.id}/reset-pin`,
        { method: 'POST' },
      );
      setTempPin(data.temp_pin);
    } catch {
      alert('Failed to reset PIN.');
      setResetting(false);
    }
  }

  function copyPin() {
    if (!tempPin) return;
    navigator.clipboard.writeText(tempPin);
    setPinCopied(true);
    setTimeout(() => setPinCopied(false), 2000);
  }

  function closeResetDialog() {
    setResetTarget(null);
    setTempPin(null);
    setResetting(false);
    setPinCopied(false);
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-4xl text-primary tracking-wider">Players</h1>
            <Link to="/admin/invites" className="text-xs text-text-muted hover:text-primary font-sans mt-1 inline-block">
              → Invites
            </Link>
          </div>
          <label className="flex items-center gap-2 text-sm text-text-secondary font-sans cursor-pointer">
            <input
              type="checkbox"
              checked={showDeleted}
              onChange={(e) => setShowDeleted(e.target.checked)}
              className="accent-primary"
            />
            Show removed
          </label>
        </div>

        {isLoading && <p className="text-text-secondary font-sans text-sm">Loading…</p>}
        {error && <p className="text-error font-sans text-sm">{error}</p>}

        <div className="space-y-3">
          {players.map((p) => (
            <Card key={p.id} className={p.is_deleted ? 'opacity-50' : ''}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary font-sans">
                        {p.display_name}
                      </span>
                      {p.role === 'admin' && <Badge variant="accent">admin</Badge>}
                      {p.is_deleted && <Badge variant="error">removed</Badge>}
                    </div>
                    <p className="text-xs text-text-muted font-sans mt-0.5">
                      {p.timezone} · joined {new Date(p.created_at + 'Z').toLocaleDateString()}
                    </p>
                  </div>
                  {!p.is_deleted && p.id !== currentPlayer?.id && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setResetTarget(p)}
                      >
                        Reset PIN
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(p)}
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {!isLoading && players.length === 0 && (
            <p className="text-text-muted font-sans text-sm">No players.</p>
          )}
        </div>
      </div>

      {/* Reset PIN dialog */}
      <Dialog open={!!resetTarget} onOpenChange={(open) => !open && closeResetDialog()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset PIN</DialogTitle>
            <DialogDescription>
              {tempPin
                ? `New temporary PIN for ${resetTarget?.display_name}. Share it securely — it will only be shown once.`
                : `Generate a temporary PIN for ${resetTarget?.display_name}?`}
            </DialogDescription>
          </DialogHeader>

          {tempPin ? (
            <div className="space-y-4 mt-2">
              <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-4">
                <span className="font-mono text-2xl text-text-primary tracking-widest">
                  {tempPin}
                </span>
                <Button variant="outline" size="sm" onClick={copyPin}>
                  {pinCopied ? 'Copied!' : 'Copy'}
                </Button>
              </div>
              <DialogFooter>
                <Button onClick={closeResetDialog}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <DialogFooter className="mt-4">
              <Button variant="ghost" onClick={closeResetDialog}>
                Cancel
              </Button>
              <Button onClick={handleResetPin} disabled={resetting}>
                {resetting ? 'Resetting…' : 'Reset PIN'}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
