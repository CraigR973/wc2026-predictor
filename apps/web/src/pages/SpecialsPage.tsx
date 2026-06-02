import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trophy, Star, Zap, Lock, Award, UserCheck, Handshake } from 'lucide-react';
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
import { SaveButton, type SaveButtonState } from '../components/ui/save-button';
import { Skeleton } from '../components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { PlayerCombobox } from '../components/PlayerCombobox';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { PredictionsSubNav } from '../components/PredictionsSubNav';

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
  player_of_tournament: {
    label: 'Player of the Tournament',
    description: 'Which player wins the Golden Ball?',
    icon: <Award size={18} />,
  },
  young_player_of_tournament: {
    label: 'Young Player of the Tournament',
    description: 'Which U21 player wins the Best Young Player award?',
    icon: <UserCheck size={18} />,
  },
  golden_glove: {
    label: 'Golden Glove',
    description: 'Which goalkeeper wins the best goalkeeper award?',
    icon: <Handshake size={18} />,
  },
};

const SPECIAL_POINTS: Record<SpecialType, number> = {
  tournament_winner: 20,
  golden_boot: 15,
  top_scoring_team: 10,
  player_of_tournament: 15,
  young_player_of_tournament: 10,
  golden_glove: 10,
};

// Types where the pick is a squad player (not a team).
const PLAYER_SPECIALS: ReadonlySet<SpecialType> = new Set<SpecialType>([
  'golden_boot',
  'player_of_tournament',
  'young_player_of_tournament',
  'golden_glove',
]);

// Position filter for the squad search (GK-only for Golden Glove).
const SPECIAL_POSITION_FILTER: Partial<Record<SpecialType, string>> = {
  golden_glove: 'GK',
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
  onSave: (
    ptype: SpecialType,
    teamId: string | null,
    playerId: string | null,
    playerName: string | null,
  ) => Promise<void>;
}) {
  const meta = SPECIAL_META[ptype];
  const isTeamPick = !PLAYER_SPECIALS.has(ptype);
  const positionFilter = SPECIAL_POSITION_FILTER[ptype];

  const [teamId, setTeamId] = useState<string>(prediction?.predicted_team_id ?? '');
  // Golden Boot: track both the squad player id and display name
  const [playerId, setPlayerId] = useState<string>(prediction?.predicted_player_id ?? '');
  const [playerDisplayName, setPlayerDisplayName] = useState<string>(
    prediction?.predicted_player_name ?? '',
  );
  const [saveState, setSaveState] = useState<SaveButtonState>('idle');

  const isDirty = isTeamPick
    ? teamId !== (prediction?.predicted_team_id ?? '')
    : playerId !== (prediction?.predicted_player_id ?? '');

  const isSubmitted = prediction?.submitted_at != null;

  // Auto-reset `saved` → `idle` after the 1.2 s hold.
  useEffect(() => {
    if (saveState !== 'saved') return;
    const id = setTimeout(() => setSaveState('idle'), 1200);
    return () => clearTimeout(id);
  }, [saveState]);

  function handlePlayerSelect(id: string, name: string) {
    setPlayerId(id);
    setPlayerDisplayName(name);
  }

  async function handleSave() {
    if (isTeamPick && !teamId) {
      toast.error('Please select a team.');
      return;
    }
    if (!isTeamPick && !playerId) {
      toast.error('Please select a player.');
      return;
    }
    setSaveState('saving');
    try {
      await onSave(
        ptype,
        isTeamPick ? teamId : null,
        isTeamPick ? null : playerId,
        isTeamPick ? null : playerDisplayName,
      );
      toast.success(`${meta.label} saved!`);
      setSaveState('saved');
    } catch {
      toast.error('Failed to save. Try again.');
      setSaveState('idle');
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
              ) : playerDisplayName ? (
                <span>{playerDisplayName}</span>
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
            <Select value={teamId} onValueChange={setTeamId} disabled={saveState === 'saving'}>
              <SelectTrigger aria-label={`Select team for ${meta.label}`}>
                <SelectValue placeholder="— Select a team —" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.flag_emoji} {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <SaveButton
            type="button"
            onClick={handleSave}
            state={saveState}
            idleLabel={isSubmitted ? 'Update' : 'Save'}
            savedLabel="Saved"
            disabled={!isDirty}
            className="whitespace-nowrap"
          />
        </div>
      ) : (
        <div className="flex gap-2 items-end flex-wrap">
          <div className="flex-1 min-w-0">
            <PlayerCombobox
              value={playerId}
              onChange={handlePlayerSelect}
              displayName={playerDisplayName}
              disabled={saveState === 'saving'}
              placeholder="Search for a player…"
              aria-label={`${meta.label} player`}
              position={positionFilter}
            />
          </div>
          <SaveButton
            type="button"
            onClick={handleSave}
            state={saveState}
            idleLabel={isSubmitted ? 'Update' : 'Save'}
            savedLabel="Saved"
            disabled={!isDirty}
            className="whitespace-nowrap"
          />
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
    if (PLAYER_SPECIALS.has(pred.prediction_type)) {
      return pred.predicted_player_name ?? '—';
    }
    const t = pred.predicted_team_id ? teamMap.get(pred.predicted_team_id) : null;
    return t ? `${t.flag_emoji} ${t.name}` : '—';
  }

  const ptypes: SpecialType[] = [
    'tournament_winner',
    'golden_boot',
    'top_scoring_team',
    'player_of_tournament',
    'young_player_of_tournament',
    'golden_glove',
  ];

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

const ORDER: SpecialType[] = [
  'tournament_winner',
  'golden_boot',
  'top_scoring_team',
  'player_of_tournament',
  'young_player_of_tournament',
  'golden_glove',
];

// ---------------------------------------------------------------------------
// Admin award panel (visible to admin role only, post-lock)
// ---------------------------------------------------------------------------

const TEAM_SPECIALS: ReadonlySet<SpecialType> = new Set<SpecialType>([
  'tournament_winner',
  'top_scoring_team',
]);

function AdminAwardPanel({ teams }: { teams: TeamOption[] }) {
  const [awardingType, setAwardingType] = useState<SpecialType | null>(null);
  const [winnerTeamId, setWinnerTeamId] = useState<string>('');
  const [winnerPlayerId, setWinnerPlayerId] = useState<string>('');
  const [winnerPlayerName, setWinnerPlayerName] = useState<string>('');
  const queryClient = useQueryClient();

  const awardMutation = useMutation({
    mutationFn: ({
      ptype,
      teamId,
      playerId,
    }: {
      ptype: SpecialType;
      teamId: string | null;
      playerId: string | null;
    }) =>
      apiFetch('/api/v1/admin/specials/award', {
        method: 'POST',
        body: JSON.stringify({
          prediction_type: ptype,
          winner_team_id: teamId ?? undefined,
          winner_player_id: playerId ?? undefined,
        }),
      }),
    onSuccess: (_data, vars) => {
      toast.success(`${SPECIAL_META[vars.ptype].label} awarded!`);
      queryClient.invalidateQueries({ queryKey: ['specials'] });
      setAwardingType(null);
      setWinnerTeamId('');
      setWinnerPlayerId('');
      setWinnerPlayerName('');
    },
    onError: () => {
      toast.error('Award failed. Check the console.');
    },
  });

  async function handleAward(ptype: SpecialType) {
    const isTeam = TEAM_SPECIALS.has(ptype);
    if (isTeam && !winnerTeamId) {
      toast.error('Select a winning team first.');
      return;
    }
    if (!isTeam && !winnerPlayerId) {
      toast.error('Select a winning player first.');
      return;
    }
    await awardMutation.mutateAsync({
      ptype,
      teamId: isTeam ? winnerTeamId : null,
      playerId: isTeam ? null : winnerPlayerId,
    });
  }

  return (
    <div className="mt-10 border-t border-border pt-6">
      <h2 className="font-sans font-semibold text-lg text-text-primary tracking-tight mb-1">Award Specials</h2>
      <p className="text-text-muted text-sm font-sans mb-4">Admin only — award points at tournament end.</p>
      <div className="flex flex-col gap-3">
        {ORDER.map((ptype) => {
          const isTeam = TEAM_SPECIALS.has(ptype);
          const isActive = awardingType === ptype;
          const positionFilter = SPECIAL_POSITION_FILTER[ptype];
          return (
            <div key={ptype} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-primary">{SPECIAL_META[ptype].icon}</span>
                <span className="font-sans font-semibold text-sm text-text-primary">{SPECIAL_META[ptype].label}</span>
                <Badge variant="muted" className="ml-auto">{SPECIAL_POINTS[ptype]} pts</Badge>
              </div>
              {isActive ? (
                <div className="flex gap-2 items-end flex-wrap">
                  <div className="flex-1 min-w-0">
                    {isTeam ? (
                      <Select value={winnerTeamId} onValueChange={setWinnerTeamId} disabled={awardMutation.isPending}>
                        <SelectTrigger aria-label={`Winning team for ${SPECIAL_META[ptype].label}`}>
                          <SelectValue placeholder="— Select winning team —" />
                        </SelectTrigger>
                        <SelectContent>
                          {teams.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.flag_emoji} {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <PlayerCombobox
                        value={winnerPlayerId}
                        onChange={(id, name) => { setWinnerPlayerId(id); setWinnerPlayerName(name); }}
                        displayName={winnerPlayerName}
                        disabled={awardMutation.isPending}
                        placeholder="Search for the winner…"
                        aria-label={`Winner for ${SPECIAL_META[ptype].label}`}
                        position={positionFilter}
                      />
                    )}
                  </div>
                  <SaveButton
                    type="button"
                    onClick={() => handleAward(ptype)}
                    state={awardMutation.isPending ? 'saving' : 'idle'}
                    idleLabel="Award"
                    savedLabel="Awarded"
                    className="whitespace-nowrap"
                  />
                  <button
                    type="button"
                    onClick={() => { setAwardingType(null); setWinnerTeamId(''); setWinnerPlayerId(''); setWinnerPlayerName(''); }}
                    className="text-sm text-text-muted underline"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => { setAwardingType(ptype); setWinnerTeamId(''); setWinnerPlayerId(''); setWinnerPlayerName(''); }}
                  className="text-sm font-sans text-primary underline"
                >
                  Set winner & award
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

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
      playerId,
    }: {
      ptype: SpecialType;
      teamId: string | null;
      playerId: string | null;
    }) =>
      apiFetch(`/api/v1/specials/${ptype}`, {
        method: 'PUT',
        body: JSON.stringify({
          predicted_team_id: teamId ?? undefined,
          predicted_player_id: playerId ?? undefined,
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
    playerId: string | null,
    _playerName: string | null,
  ): Promise<void> {
    await saveMutation.mutateAsync({ ptype, teamId, playerId });
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
            {submittedCount}/{ORDER.length}
          </span>
        }
      />
      <PredictionsSubNav />
      <p className="text-text-secondary font-sans text-sm mb-5">
        Pre-tournament bonus predictions. Worth up to 80 extra points.
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

      {player?.role === 'admin' && (
        <AdminAwardPanel teams={teams} />
      )}
    </div>
  );
}
