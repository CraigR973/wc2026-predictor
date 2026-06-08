import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Toggle } from '@/components/ui/toggle';
import { ScoreInput } from '@/components/ui/score-input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';

interface AdminMatchResult {
  match_id: string;
  match_number: number;
  status: string;
  stage: string | null;
  kickoff_utc: string;
  home_team: string | null;
  away_team: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  actual_home_score: number | null;
  actual_away_score: number | null;
  extra_time: boolean;
  penalties: boolean;
  result_source: 'auto' | 'manual' | 'override' | null;
  result_entered_at: string | null;
}

type SourceVariant = 'success' | 'muted' | 'warning';

function sourceVariant(source: AdminMatchResult['result_source']): SourceVariant {
  if (source === 'auto') return 'success';
  if (source === 'override') return 'warning';
  return 'muted';
}

function sourceLabel(source: AdminMatchResult['result_source']): string {
  const map: Record<string, string> = {
    auto: 'Auto',
    manual: 'Manual',
    override: 'Override',
  };
  return source ? (map[source] ?? source) : '—';
}

function fmtKickoff(iso: string): string {
  return formatInTimeZone(new Date(iso), 'UTC', 'dd MMM HH:mm');
}

function apiErrorStatus(err: unknown): number | null {
  const m = err instanceof Error ? err.message.match(/(\d{3})/) : null;
  return m ? Number(m[1]) : null;
}

type FormMode = 'enter' | 'override';

interface ResultForm {
  match: AdminMatchResult;
  mode: FormMode;
  homeScore: string;
  awayScore: string;
  extraTime: boolean;
  penalties: boolean;
  penaltyWinnerId: string | null;
}

export function AdminResultsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ResultForm | null>(null);
  const [advanceOpen, setAdvanceOpen] = useState(false);

  const completed = useQuery<AdminMatchResult[]>({
    queryKey: ['admin', 'results'],
    queryFn: () => apiFetch<AdminMatchResult[]>('/api/v1/admin/results'),
    staleTime: 30_000,
  });

  const pending = useQuery<AdminMatchResult[]>({
    queryKey: ['admin', 'results', 'pending'],
    queryFn: () => apiFetch<AdminMatchResult[]>('/api/v1/admin/results/pending'),
    staleTime: 30_000,
  });

  function openEnter(m: AdminMatchResult) {
    setForm({
      match: m,
      mode: 'enter',
      homeScore: '0',
      awayScore: '0',
      extraTime: false,
      penalties: false,
      penaltyWinnerId: null,
    });
  }

  function openOverride(m: AdminMatchResult) {
    setForm({
      match: m,
      mode: 'override',
      homeScore: String(m.actual_home_score ?? 0),
      awayScore: String(m.actual_away_score ?? 0),
      extraTime: m.extra_time,
      penalties: m.penalties,
      penaltyWinnerId: null,
    });
  }

  const isKnockout = !!form && !!form.match.stage && form.match.stage !== 'group';
  const needsWinner = !!form && form.penalties && isKnockout;

  const submit = useMutation({
    mutationFn: async (f: ResultForm) => {
      const body = {
        actual_home_score: Number(f.homeScore),
        actual_away_score: Number(f.awayScore),
        extra_time: f.extraTime,
        penalties: f.penalties,
        penalty_winner_id: f.penalties ? f.penaltyWinnerId : null,
      };
      return apiFetch(`/api/v1/admin/results/${f.match.match_id}`, {
        method: f.mode === 'enter' ? 'POST' : 'PUT',
        body: JSON.stringify(body),
      });
    },
    onSuccess: (_data, f) => {
      toast.success(f.mode === 'enter' ? 'Result entered' : 'Result overridden');
      queryClient.invalidateQueries({ queryKey: ['admin', 'results'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'results', 'pending'] });
      setForm(null);
    },
    onError: (err, f) => {
      const status = apiErrorStatus(err);
      if (f.mode === 'enter' && status === 409) {
        toast.error('This match already has a result — use Override instead.');
      } else if (status === 422) {
        toast.error('This match can’t take a result in its current state.');
      } else {
        toast.error('Failed to save result.');
      }
    },
  });

  const advance = useMutation({
    mutationFn: async () =>
      apiFetch<{ to_stage: string; matches: unknown[] }>('/api/v1/admin/knockout/advance', {
        method: 'POST',
        body: JSON.stringify({ from_stage: 'group' }),
      }),
    onSuccess: (data) => {
      toast.success(`Created ${data.matches.length} ${data.to_stage.toUpperCase()} matches`);
      queryClient.invalidateQueries({ queryKey: ['admin', 'results'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'results', 'pending'] });
      setAdvanceOpen(false);
    },
    onError: (err) => {
      const status = apiErrorStatus(err);
      if (status === 409) {
        toast.error('The knockout bracket has already been advanced.');
      } else if (status === 422) {
        toast.error('The group stage is not complete yet.');
      } else if (status === 502) {
        toast.error('Couldn’t reach football-data.org for kickoff times. Try again shortly.');
      } else {
        toast.error('Failed to advance the bracket.');
      }
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    if (form.homeScore === '' || form.awayScore === '') {
      toast.error('Enter both scores.');
      return;
    }
    if (needsWinner && !form.penaltyWinnerId) {
      toast.error('Pick the penalty-shootout winner.');
      return;
    }
    submit.mutate(form);
  }

  const pendingList = pending.data ?? [];
  const completedList = completed.data ?? [];

  return (
    <div>
      <PageHeader
        title="Results"
        eyebrow="Admin"
        back={{ to: '/admin', label: 'Admin' }}
      />

      {/* GAP-03 — advance the knockout bracket */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Knockout bracket</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-text-secondary font-sans">
            Once every group match is complete, build the Round of 32 from the
            final standings. Kickoff times are pulled from football-data.org.
            Auto-fetch resolves later rounds as results land; this only seeds R32.
          </p>
          <Button
            variant="accent"
            size="sm"
            onClick={() => setAdvanceOpen(true)}
            disabled={advance.isPending}
          >
            Advance to knockouts
          </Button>
        </CardContent>
      </Card>

      {/* GAP-02 — matches awaiting a result (manual-entry fallback) */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold font-sans text-text-primary mb-2">
          Awaiting result
        </h2>
        {pending.isLoading && (
          <div className="space-y-2" aria-label="Loading pending matches">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-[64px]" />
            ))}
          </div>
        )}
        {!pending.isLoading && pendingList.length === 0 && (
          <p className="text-sm text-text-muted font-sans py-2">
            No matches are awaiting a result.
          </p>
        )}
        <div className="space-y-2">
          {pendingList.map((m) => (
            <Card key={m.match_id}>
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-text-muted w-10 shrink-0">
                    #{m.match_number}
                  </span>
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <span className="text-sm font-sans text-text-primary truncate">
                      {m.home_team ?? '?'}
                    </span>
                    <span className="text-xs text-text-muted shrink-0">vs</span>
                    <span className="text-sm font-sans text-text-primary truncate">
                      {m.away_team ?? '?'}
                    </span>
                  </div>
                  <Badge variant="warning">{m.status}</Badge>
                  <span className="text-xs font-mono text-text-muted shrink-0 hidden sm:block">
                    {fmtKickoff(m.kickoff_utc)}
                  </span>
                  <Button size="sm" onClick={() => openEnter(m)}>
                    Enter result
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Completed matches — overridable */}
      <section>
        <h2 className="text-sm font-semibold font-sans text-text-primary mb-2">
          Completed
        </h2>
        {completed.error && (
          <EmptyState title="Couldn't load results" description="Try refreshing the page." />
        )}

        {completed.isLoading && (
          <div className="space-y-2" aria-label="Loading results">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-[64px]" />
            ))}
          </div>
        )}

        {completed.data && completedList.length === 0 && (
          <EmptyState
            title="No completed matches yet"
            description="Results show up once matches finish and are confirmed."
          />
        )}

        {completedList.length > 0 && (
          <div className="space-y-2">
            {completedList.map((m) => (
              <Card key={m.match_id}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-text-muted w-10 shrink-0">
                      #{m.match_number}
                    </span>

                    <div className="flex-1 flex items-center gap-2 min-w-0">
                      <span className="text-sm font-sans text-text-primary truncate">
                        {m.home_team ?? '?'}
                      </span>
                      <span className="font-mono text-base font-semibold text-primary tabular-nums shrink-0">
                        {m.actual_home_score ?? '?'} – {m.actual_away_score ?? '?'}
                      </span>
                      <span className="text-sm font-sans text-text-primary truncate">
                        {m.away_team ?? '?'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {m.extra_time && !m.penalties && (
                        <Badge variant="muted">AET</Badge>
                      )}
                      {m.penalties && (
                        <Badge variant="muted">Pens</Badge>
                      )}
                      <Badge variant={sourceVariant(m.result_source)}>
                        {sourceLabel(m.result_source)}
                      </Badge>
                    </div>

                    <span className="text-xs font-mono text-text-muted shrink-0 hidden sm:block">
                      {fmtKickoff(m.kickoff_utc)}
                    </span>
                    <Button variant="outline" size="sm" onClick={() => openOverride(m)}>
                      Edit
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Result entry / override form */}
      <Dialog open={!!form} onOpenChange={(open) => { if (!open) setForm(null); }}>
        <DialogContent className="max-w-sm">
          {form && (
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>
                  {form.mode === 'enter' ? 'Enter result' : 'Override result'}
                </DialogTitle>
                <DialogDescription>
                  #{form.match.match_number} · {form.match.home_team ?? '?'} vs{' '}
                  {form.match.away_team ?? '?'}
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4 space-y-5">
                <div className="flex items-center justify-center gap-4">
                  <div className="flex flex-col items-center gap-1">
                    <ScoreInput
                      value={form.homeScore}
                      onChange={(v) => setForm({ ...form, homeScore: v })}
                      aria-label={`${form.match.home_team ?? 'Home'} score`}
                    />
                    <span className="text-xs font-sans text-text-muted max-w-[6rem] truncate text-center">
                      {form.match.home_team ?? 'Home'}
                    </span>
                  </div>
                  <span className="text-text-muted font-mono pb-6">–</span>
                  <div className="flex flex-col items-center gap-1">
                    <ScoreInput
                      value={form.awayScore}
                      onChange={(v) => setForm({ ...form, awayScore: v })}
                      aria-label={`${form.match.away_team ?? 'Away'} score`}
                    />
                    <span className="text-xs font-sans text-text-muted max-w-[6rem] truncate text-center">
                      {form.match.away_team ?? 'Away'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="et-toggle">After extra time</Label>
                  <Toggle
                    checked={form.extraTime}
                    onCheckedChange={(v) => setForm({ ...form, extraTime: v })}
                    label="After extra time"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="pens-toggle">Decided on penalties</Label>
                  <Toggle
                    checked={form.penalties}
                    onCheckedChange={(v) =>
                      setForm({
                        ...form,
                        penalties: v,
                        extraTime: v ? true : form.extraTime,
                        penaltyWinnerId: v ? form.penaltyWinnerId : null,
                      })
                    }
                    label="Decided on penalties"
                  />
                </div>

                {needsWinner && (
                  <div className="space-y-2">
                    <Label>Penalty-shootout winner</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['home', 'away'] as const).map((side) => {
                        const teamId =
                          side === 'home' ? form.match.home_team_id : form.match.away_team_id;
                        const teamName =
                          side === 'home' ? form.match.home_team : form.match.away_team;
                        const selected = !!teamId && form.penaltyWinnerId === teamId;
                        return (
                          <Button
                            key={side}
                            type="button"
                            variant={selected ? 'default' : 'outline'}
                            size="sm"
                            disabled={!teamId}
                            onClick={() => setForm({ ...form, penaltyWinnerId: teamId })}
                          >
                            {teamName ?? side}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="mt-6">
                <Button type="button" variant="ghost" onClick={() => setForm(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submit.isPending}>
                  {submit.isPending ? 'Saving…' : 'Save result'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Advance-bracket confirmation */}
      <Dialog open={advanceOpen} onOpenChange={setAdvanceOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Advance to knockouts</DialogTitle>
            <DialogDescription>
              This creates the Round of 32 from the final group standings. It can
              only run once, after every group match is complete.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setAdvanceOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => advance.mutate()} disabled={advance.isPending}>
              {advance.isPending ? 'Advancing…' : 'Advance'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
