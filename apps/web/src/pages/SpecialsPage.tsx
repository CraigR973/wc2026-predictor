import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trophy, Star, Zap, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { formatInTimeZone } from 'date-fns-tz';
import { apiFetch } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useCountdown } from '../hooks/useCountdown';
import type {
  MySpecialsResponse,
  PlayerSpecialsItem,
  SpecialPredictionItem,
  SpecialType,
  GroupResponse,
} from '../lib/types';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SPECIAL_META: Record<SpecialType, { label: string; description: string; icon: React.ReactNode }> = {
  tournament_winner: {
    label: 'Tournament Winner',
    description: 'Which team lifts the trophy?',
    icon: <Trophy size={18} />,
  },
  golden_boot: {
    label: 'Golden Boot',
    description: 'Which player scores the most goals?',
    icon: <Star size={18} />,
  },
  top_scoring_team: {
    label: 'Top Scoring Team',
    description: 'Which team scores the most goals overall?',
    icon: <Zap size={18} />,
  },
};

const SPECIAL_POINTS: Record<SpecialType, number> = {
  tournament_winner: 20,
  golden_boot: 15,
  top_scoring_team: 10,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCountdown(parts: {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
}): string {
  if (parts.expired) return 'Started';
  if (parts.days > 0) return `${parts.days}d ${parts.hours}h`;
  if (parts.hours > 0) return `${parts.hours}h ${parts.minutes}m`;
  return `${parts.minutes}m ${parts.seconds}s`;
}

interface TeamOption {
  id: string;
  name: string;
  code: string;
  flag_emoji: string;
}

function teamsFromGroups(groups: GroupResponse[]): TeamOption[] {
  const seen = new Set<string>();
  const teams: TeamOption[] = [];
  for (const g of groups) {
    for (const s of g.standings) {
      if (!seen.has(s.team_id)) {
        seen.add(s.team_id);
        teams.push({ id: s.team_id, name: s.team_name, code: s.team_code, flag_emoji: s.flag_emoji });
      }
    }
  }
  return teams.sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// Lock countdown banner
// ---------------------------------------------------------------------------

function LockBanner({ lockAt, isLocked }: { lockAt: string | null; isLocked: boolean }) {
  const countdown = useCountdown(lockAt ?? new Date(0).toISOString());

  if (isLocked) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-warning/10 border border-warning/30 text-warning text-sm font-sans mb-6">
        <Lock size={14} aria-hidden="true" />
        <span>Tournament has started — special predictions are locked.</span>
      </div>
    );
  }

  if (!lockAt) return null;

  const isDeadlineSoon = !countdown.expired && countdown.days === 0 && countdown.hours === 0;

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-sans mb-6 ${
        isDeadlineSoon
          ? 'bg-warning/10 border-warning/30 text-warning'
          : 'bg-surface border-border text-text-muted'
      }`}
    >
      <Lock size={14} aria-hidden="true" />
      <span>
        Locks in <span className="font-medium">{formatCountdown(countdown)}</span> — at the opening
        match kickoff.
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single special card (pre-lock form)
// ---------------------------------------------------------------------------

function SpecialCard({
  ptype,
  prediction,
  teams,
  isLocked,
  onSave,
}: {
  ptype: SpecialType;
  prediction: SpecialPredictionItem | null;
  teams: TeamOption[];
  isLocked: boolean;
  onSave: (ptype: SpecialType, teamId: string | null, playerName: string | null) => Promise<void>;
}) {
  const meta = SPECIAL_META[ptype];
  const isTeamPick = ptype !== 'golden_boot';

  const [teamId, setTeamId] = useState<string>(prediction?.predicted_team_id ?? '');
  const [playerName, setPlayerName] = useState<string>(prediction?.predicted_player_name ?? '');
  const [saving, setSaving] = useState(false);

  const isDirty = isTeamPick
    ? teamId !== (prediction?.predicted_team_id ?? '')
    : playerName !== (prediction?.predicted_player_name ?? '');

  const isSubmitted = prediction?.submitted_at != null;

  async function handleSave() {
    if (isTeamPick && !teamId) {
      toast.error('Please select a team.');
      return;
    }
    if (!isTeamPick && !playerName.trim()) {
      toast.error('Please enter a player name.');
      return;
    }
    setSaving(true);
    try {
      await onSave(ptype, isTeamPick ? teamId : null, isTeamPick ? null : playerName.trim());
      toast.success(`${meta.label} saved!`);
    } catch {
      toast.error('Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  }

  const selectedTeam = teams.find((t) => t.id === teamId);

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="flex items-center gap-2.5 mb-1 text-primary">
        {meta.icon}
        <h3 className="font-sans font-semibold text-base tracking-tight text-text-primary">{meta.label}</h3>
        <span className="ml-auto">
          <Badge variant="muted">{SPECIAL_POINTS[ptype]} pts</Badge>
        </span>
      </div>
      <p className="text-text-muted text-sm font-sans mb-4">{meta.description}</p>

      {isLocked ? (
        <div className="font-sans text-sm text-text-primary">
          {isSubmitted ? (
            <span>
              {isTeamPick ? (
                selectedTeam ? (
                  <span>
                    {selectedTeam.flag_emoji} {selectedTeam.name}
                  </span>
                ) : (
                  <span className="text-text-muted">—</span>
                )
              ) : playerName ? (
                <span>{playerName}</span>
              ) : (
                <span className="text-text-muted">—</span>
              )}
              {prediction?.points_awarded != null && (
                <Badge
                  variant={prediction.points_awarded > 0 ? 'success' : 'muted'}
                  className="ml-2"
                >
                  {prediction.points_awarded} pts
                </Badge>
              )}
            </span>
          ) : (
            <span className="text-text-muted">No prediction submitted.</span>
          )}
        </div>
      ) : isTeamPick ? (
        <div className="flex gap-2 items-end flex-wrap">
          <div className="flex-1 min-w-0">
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              disabled={saving}
              className="w-full rounded-md border border-border bg-background text-text-primary font-sans text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
              aria-label={`Select team for ${meta.label}`}
            >
              <option value="">— Select a team —</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.flag_emoji} {t.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="px-4 py-2 rounded-md bg-primary text-background font-sans text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors whitespace-nowrap"
          >
            {saving ? 'Saving…' : isSubmitted ? 'Update' : 'Save'}
          </button>
        </div>
      ) : (
        <div className="flex gap-2 items-end flex-wrap">
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="e.g. Kylian Mbappé"
            disabled={saving}
            maxLength={100}
            className="flex-1 min-w-0 rounded-md border border-border bg-background text-text-primary font-sans text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
            aria-label="Golden Boot player name"
          />
          <button
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="px-4 py-2 rounded-md bg-primary text-background font-sans text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors whitespace-nowrap"
          >
            {saving ? 'Saving…' : isSubmitted ? 'Update' : 'Save'}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Post-lock comparison table
// ---------------------------------------------------------------------------

function ComparisonView({
  allPicks,
  teams,
  timezone,
}: {
  allPicks: PlayerSpecialsItem[];
  teams: TeamOption[];
  timezone: string;
}) {
  const teamMap = new Map(teams.map((t) => [t.id, t]));

  function pickLabel(pred: SpecialPredictionItem): string {
    if (pred.prediction_type === 'golden_boot') {
      return pred.predicted_player_name ?? '—';
    }
    const t = pred.predicted_team_id ? teamMap.get(pred.predicted_team_id) : null;
    return t ? `${t.flag_emoji} ${t.name}` : '—';
  }

  const ptypes: SpecialType[] = ['tournament_winner', 'golden_boot', 'top_scoring_team'];

  return (
    <div className="mt-8">
      <h2 className="font-sans font-semibold text-lg text-text-primary tracking-tight mb-4">All Picks</h2>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full font-sans text-sm">
          <thead>
            <tr className="bg-surface-elevated border-b border-border">
              <th className="text-left px-4 py-2 text-text-muted font-medium">Player</th>
              {ptypes.map((pt) => (
                <th key={pt} className="text-left px-4 py-2 text-text-muted font-medium">
                  {SPECIAL_META[pt].label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allPicks.map((row) => {
              const predMap = new Map(row.predictions.map((p) => [p.prediction_type, p]));
              return (
                <tr key={row.player_id} className="border-b border-border last:border-0 hover:bg-surface-elevated/50">
                  <td className="px-4 py-3 text-text-primary font-medium">{row.player_name}</td>
                  {ptypes.map((pt) => {
                    const pred = predMap.get(pt);
                    return (
                      <td key={pt} className="px-4 py-3 text-text-primary">
                        {pred ? (
                          <span>
                            {pickLabel(pred)}
                            {pred.points_awarded != null && (
                              <Badge
                                variant={pred.points_awarded > 0 ? 'success' : 'muted'}
                                className="ml-2"
                              >
                                {pred.points_awarded} pts
                              </Badge>
                            )}
                          </span>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-text-muted text-xs font-sans mt-2">
        Locked at{' '}
        {allPicks.length > 0 && allPicks[0].predictions[0]?.submitted_at
          ? formatInTimeZone(
              new Date(allPicks[0].predictions[0].submitted_at),
              timezone,
              'EEE d MMM, HH:mm',
            )
          : 'tournament start'}
        .
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SpecialsPage
// ---------------------------------------------------------------------------

const ORDER: SpecialType[] = ['tournament_winner', 'golden_boot', 'top_scoring_team'];

export function SpecialsPage() {
  const { player } = useAuth();
  const queryClient = useQueryClient();
  const timezone = player?.timezone ?? 'UTC';

  const { data: mySpecials, isLoading: loadingSpecials, isError: errSpecials } = useQuery({
    queryKey: ['specials', 'me'],
    queryFn: () => apiFetch<MySpecialsResponse>('/api/v1/specials'),
  });

  const { data: groups } = useQuery({
    queryKey: ['groups'],
    queryFn: () => apiFetch<GroupResponse[]>('/api/v1/groups'),
  });

  const { data: allPicks } = useQuery({
    queryKey: ['specials', 'all'],
    queryFn: () => apiFetch<PlayerSpecialsItem[]>('/api/v1/specials/all'),
    enabled: mySpecials?.is_locked === true,
  });

  const saveMutation = useMutation({
    mutationFn: ({
      ptype,
      teamId,
      playerName,
    }: {
      ptype: SpecialType;
      teamId: string | null;
      playerName: string | null;
    }) =>
      apiFetch(`/api/v1/specials/${ptype}`, {
        method: 'PUT',
        body: JSON.stringify({
          predicted_team_id: teamId ?? undefined,
          predicted_player_name: playerName ?? undefined,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['specials', 'me'] });
    },
  });

  const teams = groups ? teamsFromGroups(groups) : [];

  async function handleSave(
    ptype: SpecialType,
    teamId: string | null,
    playerName: string | null,
  ): Promise<void> {
    await saveMutation.mutateAsync({ ptype, teamId, playerName });
  }

  if (loadingSpecials) {
    return (
      <div className="space-y-4" aria-label="Loading specials">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-12 w-full" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[140px] w-full" />
        ))}
      </div>
    );
  }

  if (errSpecials || !mySpecials) {
    return (
      <EmptyState
        title="Couldn't load specials"
        description="Refresh the page or check your connection."
      />
    );
  }

  const predMap = new Map(mySpecials.predictions.map((p) => [p.prediction_type, p]));
  const submittedCount = mySpecials.predictions.filter((p) => p.submitted_at != null).length;

  return (
    <div>
      <PageHeader
        title="Tournament Specials"
        eyebrow="Pre-tournament bonus"
        action={
          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-surface-elevated border border-border font-mono text-[10px] uppercase tracking-[0.2em] text-text-secondary tabular-nums">
            {submittedCount}/3
          </span>
        }
      />
      <p className="text-text-secondary font-sans text-sm mb-5 -mt-2">
        Pre-tournament bonus predictions. Worth up to 45 extra points.
      </p>

      <LockBanner lockAt={mySpecials.lock_at} isLocked={mySpecials.is_locked} />

      <div className="flex flex-col gap-4">
        {ORDER.map((ptype) => {
          const pred = predMap.get(ptype) ?? null;
          const hasValue = pred?.submitted_at != null;
          return (
            <SpecialCard
              key={ptype}
              ptype={ptype}
              prediction={hasValue ? pred : null}
              teams={teams}
              isLocked={mySpecials.is_locked}
              onSave={handleSave}
            />
          );
        })}
      </div>

      {mySpecials.is_locked && allPicks && allPicks.length > 0 && (
        <ComparisonView allPicks={allPicks} teams={teams} timezone={timezone} />
      )}
    </div>
  );
}
