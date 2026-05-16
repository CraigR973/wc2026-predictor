import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { formatInTimeZone } from 'date-fns-tz';
import { Lock } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { MatchResponse, GroupResponse, PredictionResponse } from '../lib/types';
import { Badge } from '../components/ui/badge';
import { useCountdown } from '../hooks/useCountdown';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LocalPrediction {
  home: string;
  away: string;
  dirty: boolean;
  saving: boolean;
}

type LocalPredictions = Record<string, LocalPrediction>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EDITABLE_STATUSES = new Set<MatchResponse['status']>(['scheduled']);

function canEdit(status: MatchResponse['status']): boolean {
  return EDITABLE_STATUSES.has(status);
}

function statusLabel(status: MatchResponse['status']): string {
  const map: Record<MatchResponse['status'], string> = {
    scheduled: 'Open',
    locked: 'Locked',
    live: 'Live',
    completed: 'FT',
    postponed: 'Postponed',
    cancelled: 'Voided',
  };
  return map[status];
}

type StatusVariant = 'default' | 'success' | 'error' | 'muted' | 'warning' | 'live';

function statusVariant(status: MatchResponse['status']): StatusVariant {
  const map: Record<MatchResponse['status'], StatusVariant> = {
    scheduled: 'muted',
    locked: 'warning',
    live: 'live',
    completed: 'success',
    postponed: 'warning',
    cancelled: 'error',
  };
  return map[status];
}

function initLocal(predictions: PredictionResponse[]): LocalPredictions {
  const result: LocalPredictions = {};
  for (const p of predictions) {
    result[p.match_id] = {
      home: p.predicted_home !== null ? String(p.predicted_home) : '',
      away: p.predicted_away !== null ? String(p.predicted_away) : '',
      dirty: false,
      saving: false,
    };
  }
  return result;
}

// ---------------------------------------------------------------------------
// Score input
// ---------------------------------------------------------------------------

function ScoreInput({
  value,
  onChange,
  disabled,
  'aria-label': ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  'aria-label': string;
}) {
  const num = value === '' ? null : Number(value);

  function step(delta: number) {
    const next = Math.max(0, Math.min(99, (num ?? 0) + delta));
    onChange(String(next));
  }

  return (
    <div className="flex flex-col items-center gap-0.5">
      {!disabled && (
        <button
          type="button"
          onClick={() => step(1)}
          aria-label={`Increment ${ariaLabel}`}
          className="w-8 h-5 text-text-muted hover:text-primary leading-none text-xs select-none"
        >
          ▲
        </button>
      )}
      <input
        type="number"
        min={0}
        max={99}
        value={value}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '' || /^\d{1,2}$/.test(raw)) onChange(raw);
        }}
        disabled={disabled}
        aria-label={ariaLabel}
        className={`w-12 h-12 text-center font-display text-3xl rounded-md border bg-surface focus:outline-none focus:ring-1 focus:ring-primary tabular-nums
          ${disabled
            ? 'text-text-muted border-border cursor-not-allowed opacity-50'
            : 'text-text-primary border-border hover:border-primary/50'
          }`}
      />
      {!disabled && (
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label={`Decrement ${ariaLabel}`}
          className="w-8 h-5 text-text-muted hover:text-primary leading-none text-xs select-none"
        >
          ▼
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Points badge with count-up animation
// ---------------------------------------------------------------------------

function PointsBadge({ points }: { points: number }) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    if (points === 0) { setDisplayed(0); return; }
    setDisplayed(0);
    const steps = points;
    const intervalMs = Math.max(30, Math.min(120, 600 / steps));
    let current = 0;
    const id = setInterval(() => {
      current++;
      setDisplayed(current);
      if (current >= steps) clearInterval(id);
    }, intervalMs);
    return () => clearInterval(id);
  }, [points]);

  return (
    <Badge variant={points > 0 ? 'success' : 'muted'} data-testid="points-badge">
      {displayed} {displayed === 1 ? 'pt' : 'pts'}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Countdown helpers
// ---------------------------------------------------------------------------

function formatCountdown(parts: { days: number; hours: number; minutes: number; seconds: number; expired: boolean }): string {
  if (parts.expired) return 'Started';
  if (parts.days > 0) return `${parts.days}d ${parts.hours}h`;
  if (parts.hours > 0) return `${parts.hours}h ${parts.minutes}m`;
  return `${parts.minutes}m ${parts.seconds}s`;
}

// ---------------------------------------------------------------------------
// Prediction card
// ---------------------------------------------------------------------------

function PredictionCard({
  match,
  prediction,
  local,
  timezone,
  highlighted,
  onHomeChange,
  onAwayChange,
}: {
  match: MatchResponse;
  prediction: PredictionResponse | undefined;
  local: LocalPrediction | undefined;
  timezone: string;
  highlighted: boolean;
  onHomeChange: (matchId: string, value: string) => void;
  onAwayChange: (matchId: string, value: string) => void;
}) {
  const kickoffLocal = formatInTimeZone(
    new Date(match.kickoff_utc),
    timezone,
    'EEE d MMM, HH:mm',
  );

  const countdown = useCountdown(match.kickoff_utc);

  const editable = canEdit(match.status);
  const isVoided = match.status === 'cancelled' || match.status === 'postponed';
  const isCompleted = match.status === 'completed';
  const isLocked = match.status === 'locked';

  // Deadline warning: scheduled + < 1hr remaining
  const isDeadlineWarning =
    match.status === 'scheduled' &&
    !countdown.expired &&
    countdown.days === 0 &&
    countdown.hours === 0;

  const homeLabel = match.home_team
    ? `${match.home_team.flag_emoji} ${match.home_team.name}`
    : (match.home_team_placeholder ?? '?');
  const awayLabel = match.away_team
    ? `${match.away_team.flag_emoji} ${match.away_team.name}`
    : (match.away_team_placeholder ?? '?');

  const homeVal = local?.home ?? (prediction?.predicted_home !== null && prediction?.predicted_home !== undefined ? String(prediction.predicted_home) : '');
  const awayVal = local?.away ?? (prediction?.predicted_away !== null && prediction?.predicted_away !== undefined ? String(prediction.predicted_away) : '');

  const points = prediction?.points_awarded ?? null;
  const noSubmission = isCompleted && !prediction;

  // Not-predicted warning: editable match with no saved or local values
  const notPredicted =
    editable &&
    homeVal === '' &&
    awayVal === '';

  return (
    <motion.div
      className={`rounded-lg border bg-surface p-3 transition-all ${
        isVoided ? 'opacity-50' : ''
      } ${isDeadlineWarning ? 'border-warning/60' : highlighted ? 'border-primary' : 'border-border'}`}
      data-testid={`prediction-card-${match.id}`}
      animate={highlighted ? { scale: [1, 1.02, 1] } : {}}
      transition={{ duration: 0.4 }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <span
          className={`text-xs font-mono ${
            isDeadlineWarning ? 'text-warning font-semibold' : 'text-text-muted'
          }`}
        >
          {kickoffLocal}
          {isDeadlineWarning && (
            <span className="ml-1.5" data-testid="deadline-warning">
              · {formatCountdown(countdown)} left
            </span>
          )}
        </span>
        <div className="flex items-center gap-2">
            {isCompleted && points !== null && !noSubmission && (
            <PointsBadge points={points} />
          )}
          {isCompleted && noSubmission && (
            <Badge variant="muted">No entry</Badge>
          )}
          <Badge variant={statusVariant(match.status)}>{statusLabel(match.status)}</Badge>
        </div>
      </div>

      {/* Teams + inputs */}
      <div className="flex items-center gap-2">
        {/* Home team */}
        <div className="flex-1 text-sm font-sans text-text-primary truncate text-right">
          {homeLabel}
        </div>

        {/* Score inputs */}
        <div className="flex items-center gap-1.5 shrink-0">
          <ScoreInput
            value={homeVal}
            onChange={(v) => onHomeChange(match.id, v)}
            disabled={!editable}
            aria-label={`Home score for match ${match.match_number}`}
          />
          <span className="text-text-muted font-mono text-sm">–</span>
          <ScoreInput
            value={awayVal}
            onChange={(v) => onAwayChange(match.id, v)}
            disabled={!editable}
            aria-label={`Away score for match ${match.match_number}`}
          />
        </div>

        {/* Away team */}
        <div className="flex-1 text-sm font-sans text-text-primary truncate">
          {awayLabel}
        </div>
      </div>

      {/* Lock indicator */}
      {isLocked && (
        <div className="mt-2 flex items-center justify-center gap-1.5 text-xs font-sans text-warning" data-testid="lock-indicator">
          <Lock size={12} aria-hidden="true" />
          <span>Kicks off in {formatCountdown(countdown)}</span>
        </div>
      )}

      {/* Not-predicted warning */}
      {notPredicted && (
        <div className="mt-2 text-center text-xs font-sans text-warning" data-testid="not-predicted-warning">
          Not predicted yet
        </div>
      )}

      {/* Actual result (when completed) */}
      {isCompleted && match.actual_home_score !== null && match.actual_away_score !== null && (
        <div className="mt-2 text-center text-xs font-mono text-text-muted">
          Result: {match.actual_home_score} – {match.actual_away_score}
          {match.penalties && ' (pens)'}
          {match.extra_time && !match.penalties && ' (aet)'}
        </div>
      )}

      {/* Postponed reason */}
      {match.status === 'postponed' && match.postponed_reason && (
        <p className="mt-2 text-xs font-sans text-text-muted text-center">
          {match.postponed_reason}
        </p>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Group panel
// ---------------------------------------------------------------------------

function GroupPanel({
  group,
  matches,
  predictions,
  local,
  timezone,
  highlightedMatchIds,
  onHomeChange,
  onAwayChange,
  onSaveAll,
}: {
  group: GroupResponse;
  matches: MatchResponse[];
  predictions: PredictionResponse[];
  local: LocalPredictions;
  timezone: string;
  highlightedMatchIds: Set<string>;
  onHomeChange: (matchId: string, value: string) => void;
  onAwayChange: (matchId: string, value: string) => void;
  onSaveAll: (groupMatches: MatchResponse[]) => void;
}) {
  const predByMatch = Object.fromEntries(predictions.map((p) => [p.match_id, p]));
  const groupMatches = matches.filter((m) => m.group_id === group.id);
  const dirtyCount = groupMatches.filter((m) => local[m.id]?.dirty).length;
  const savingAny = groupMatches.some((m) => local[m.id]?.saving);
  const editableMatches = groupMatches.filter((m) => canEdit(m.status));

  return (
    <div>
      <div className="flex flex-col gap-3">
        {groupMatches.length === 0 ? (
          <p className="text-text-muted font-sans text-sm">No matches for this group.</p>
        ) : (
          groupMatches.map((m) => (
            <PredictionCard
              key={m.id}
              match={m}
              prediction={predByMatch[m.id]}
              local={local[m.id]}
              timezone={timezone}
              highlighted={highlightedMatchIds.has(m.id)}
              onHomeChange={onHomeChange}
              onAwayChange={onAwayChange}
            />
          ))
        )}
      </div>

      {editableMatches.length > 0 && (
        <div className="mt-4 flex items-center justify-end gap-3">
          {dirtyCount > 0 && (
            <span className="text-xs text-text-muted font-sans">
              {dirtyCount} unsaved {dirtyCount === 1 ? 'change' : 'changes'}
            </span>
          )}
          <button
            onClick={() => onSaveAll(editableMatches)}
            disabled={savingAny || dirtyCount === 0}
            className="px-4 py-1.5 rounded-md text-sm font-sans bg-primary text-surface font-medium
              hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {savingAny ? 'Saving…' : 'Save Group ' + group.name}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Predictions page
// ---------------------------------------------------------------------------

const DEBOUNCE_MS = 800;

export function PredictionsPage() {
  const { player } = useAuth();
  const timezone = player?.timezone ?? 'UTC';
  const queryClient = useQueryClient();

  const [activeGroup, setActiveGroup] = useState(0);
  const [local, setLocal] = useState<LocalPredictions>({});
  const [highlightedMatchIds, setHighlightedMatchIds] = useState<Set<string>>(new Set());
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // Track which match IDs had a null score before the last Realtime update
  const prevScoresRef = useRef<Record<string, boolean>>({});

  // Fetch groups A–L
  const { data: groups = [], isLoading: groupsLoading } = useQuery<GroupResponse[]>({
    queryKey: ['groups'],
    queryFn: () => apiFetch<GroupResponse[]>('/api/v1/groups'),
    staleTime: 60_000,
  });

  // Fetch all group-stage matches
  const { data: matches = [], isLoading: matchesLoading } = useQuery<MatchResponse[]>({
    queryKey: ['matches', 'group'],
    queryFn: () => apiFetch<MatchResponse[]>('/api/v1/matches?stage=group'),
    staleTime: 30_000,
  });

  // Fetch my predictions
  const { data: predictions = [], isLoading: predsLoading } = useQuery<PredictionResponse[]>({
    queryKey: ['predictions', 'me'],
    queryFn: () => apiFetch<PredictionResponse[]>('/api/v1/predictions/me'),
    staleTime: 30_000,
  });

  // Init local state from server predictions (once loaded)
  useEffect(() => {
    if (predictions.length > 0) {
      setLocal((prev) => {
        const next = initLocal(predictions);
        // Preserve any dirty local state the user has already typed
        for (const matchId of Object.keys(prev)) {
          if (prev[matchId].dirty || prev[matchId].saving) {
            next[matchId] = prev[matchId];
          }
        }
        return next;
      });
    }
  }, [predictions]);

  // Keep a shadow of which matches had null scores so we can detect result arrival
  useEffect(() => {
    for (const m of matches) {
      prevScoresRef.current[m.id] = m.actual_home_score === null;
    }
  }, [matches]);

  // Realtime: subscribe to matches table — when a result is set, refetch and animate
  useEffect(() => {
    const channel = supabase
      .channel('predictions-match-results')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'matches' },
        async (payload) => {
          const updated = payload.new as { id: string; actual_home_score: number | null; actual_away_score: number | null };
          const wasNull = prevScoresRef.current[updated.id] ?? true;
          const nowSet = updated.actual_home_score !== null && updated.actual_away_score !== null;

          // Invalidate matches so the card shows the new score
          await queryClient.invalidateQueries({ queryKey: ['matches', 'group'] });

          if (wasNull && nowSet) {
            // Result just arrived — refetch predictions to get updated points, then toast
            const fresh = await queryClient.fetchQuery<PredictionResponse[]>({
              queryKey: ['predictions', 'me'],
              queryFn: () => apiFetch<PredictionResponse[]>('/api/v1/predictions/me'),
            });
            const pred = fresh.find((p) => p.match_id === updated.id);
            const pts = pred?.points_awarded ?? null;

            if (pts !== null) {
              toast.success(
                `Result: ${updated.actual_home_score}–${updated.actual_away_score} · You scored ${pts} pt${pts !== 1 ? 's' : ''}`,
                { duration: 6000 },
              );
            }

            // Flash the card for 2.5 s
            setHighlightedMatchIds((prev) => new Set([...prev, updated.id]));
            setTimeout(() => {
              setHighlightedMatchIds((prev) => {
                const next = new Set(prev);
                next.delete(updated.id);
                return next;
              });
            }, 2500);
          }
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const savePrediction = useCallback(
    async (matchId: string, home: string, away: string) => {
      if (home === '' || away === '') return;
      setLocal((prev) => ({
        ...prev,
        [matchId]: { ...prev[matchId], saving: true },
      }));
      try {
        await apiFetch(`/api/v1/predictions/${matchId}`, {
          method: 'PUT',
          body: JSON.stringify({ predicted_home: Number(home), predicted_away: Number(away) }),
        });
        setLocal((prev) => ({
          ...prev,
          [matchId]: { ...prev[matchId], dirty: false, saving: false },
        }));
      } catch {
        // Rollback to last server-confirmed values and notify
        const serverPreds =
          queryClient.getQueryData<PredictionResponse[]>(['predictions', 'me']) ?? [];
        const sp = serverPreds.find((p) => p.match_id === matchId);
        setLocal((prev) => ({
          ...prev,
          [matchId]: {
            home: sp?.predicted_home != null ? String(sp.predicted_home) : '',
            away: sp?.predicted_away != null ? String(sp.predicted_away) : '',
            dirty: false,
            saving: false,
            error: false,
          },
        }));
        toast.error('Prediction not saved — check your connection and try again');
      }
    },
    [queryClient],
  );

  const scheduleDebounce = useCallback(
    (matchId: string, home: string, away: string) => {
      clearTimeout(debounceTimers.current[matchId]);
      debounceTimers.current[matchId] = setTimeout(() => {
        savePrediction(matchId, home, away);
      }, DEBOUNCE_MS);
    },
    [savePrediction],
  );

  const handleHomeChange = useCallback(
    (matchId: string, value: string) => {
      setLocal((prev) => {
        const cur = prev[matchId] ?? { home: '', away: '', dirty: false, saving: false };
        const next = { ...cur, home: value, dirty: true };
        scheduleDebounce(matchId, value, cur.away);
        return { ...prev, [matchId]: next };
      });
    },
    [scheduleDebounce],
  );

  const handleAwayChange = useCallback(
    (matchId: string, value: string) => {
      setLocal((prev) => {
        const cur = prev[matchId] ?? { home: '', away: '', dirty: false, saving: false };
        const next = { ...cur, away: value, dirty: true };
        scheduleDebounce(matchId, cur.home, value);
        return { ...prev, [matchId]: next };
      });
    },
    [scheduleDebounce],
  );

  const handleSaveAll = useCallback(
    (groupMatches: MatchResponse[]) => {
      for (const match of groupMatches) {
        if (!canEdit(match.status)) continue;
        const l = local[match.id];
        if (!l || l.home === '' || l.away === '') continue;
        clearTimeout(debounceTimers.current[match.id]);
        savePrediction(match.id, l.home, l.away);
      }
    },
    [local, savePrediction],
  );

  const isLoading = groupsLoading || matchesLoading || predsLoading;

  const sortedGroups = [...groups].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      <h1 className="font-display text-3xl text-primary tracking-wider mb-4">My Predictions</h1>

      {isLoading && (
        <p className="text-text-muted font-sans text-sm">Loading…</p>
      )}

      {!isLoading && sortedGroups.length === 0 && (
        <p className="text-text-muted font-sans text-sm">No groups available yet.</p>
      )}

      {!isLoading && sortedGroups.length > 0 && (
        <>
          {/* Group tabs */}
          <div
            className="flex flex-wrap gap-1 mb-6 border-b border-border pb-3"
            role="tablist"
            aria-label="Tournament groups"
          >
            {sortedGroups.map((g, i) => (
              <button
                key={g.id}
                role="tab"
                aria-selected={activeGroup === i}
                onClick={() => setActiveGroup(i)}
                className={`px-3 py-1.5 rounded-md text-sm font-mono transition-colors ${
                  activeGroup === i
                    ? 'bg-primary text-surface font-semibold'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
                }`}
              >
                Group {g.name}
              </button>
            ))}
          </div>

          {/* Active group panel */}
          {sortedGroups[activeGroup] && (
            <GroupPanel
              group={sortedGroups[activeGroup]}
              matches={matches}
              predictions={predictions}
              local={local}
              timezone={timezone}
              highlightedMatchIds={highlightedMatchIds}
              onHomeChange={handleHomeChange}
              onAwayChange={handleAwayChange}
              onSaveAll={handleSaveAll}
            />
          )}
        </>
      )}
    </div>
  );
}
