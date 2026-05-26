import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import { formatInTimeZone } from 'date-fns-tz';
import { Lock } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '../lib/api';
import { enqueuePrediction } from '../lib/offlineQueue';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { MatchResponse, GroupResponse, PredictionResponse } from '../lib/types';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { ScoreInput } from '../components/ui/score-input';
import { Skeleton } from '../components/ui/skeleton';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { PredictionsSubNav } from '../components/PredictionsSubNav';
import { ScoringGuide } from '../components/ScoringGuide';
import { useCountdown } from '../hooks/useCountdown';
import { cn } from '../lib/utils';

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
// Points badge with count-up animation
// ---------------------------------------------------------------------------

function PointsBadge({ points }: { points: number }) {
  const prefersReducedMotion = useReducedMotion();
  const [displayed, setDisplayed] = useState(prefersReducedMotion ? points : 0);

  useEffect(() => {
    if (prefersReducedMotion) { setDisplayed(points); return; }
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
  }, [points, prefersReducedMotion]);

  return (
    <Badge variant={points > 0 ? 'success' : 'muted'} data-testid="points-badge" aria-live="polite">
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
  const prefersReducedMotion = useReducedMotion();

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
      className={cn(
        'rounded-lg border bg-surface p-4 transition-all',
        isVoided && 'opacity-50',
        isDeadlineWarning
          ? 'border-warning/60'
          : highlighted
            ? 'border-primary shadow-glow'
            : 'border-border',
      )}
      data-testid={`prediction-card-${match.id}`}
      animate={highlighted && !prefersReducedMotion ? { scale: [1, 1.02, 1] } : {}}
      transition={{ duration: 0.4 }}
    >
      {/* Eyebrow row: caps-mono kickoff time + status pills */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <span
          className={cn(
            'font-mono text-[10px] uppercase tracking-[0.25em]',
            isDeadlineWarning ? 'text-warning font-semibold' : 'text-text-muted',
          )}
        >
          {kickoffLocal}
          {isDeadlineWarning && (
            <span className="ml-2 normal-case tracking-normal" data-testid="deadline-warning">
              · {formatCountdown(countdown)} left
            </span>
          )}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {isCompleted && points !== null && !noSubmission && <PointsBadge points={points} />}
          {isCompleted && noSubmission && <Badge variant="muted">No entry</Badge>}
          <Badge variant={statusVariant(match.status)}>{statusLabel(match.status)}</Badge>
        </div>
      </div>

      {/* Teams + score inputs */}
      <div className="flex items-center gap-3">
        <div className="flex-1 text-sm font-sans text-text-primary truncate text-right">
          {homeLabel}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ScoreInput
            value={homeVal}
            onChange={(v) => onHomeChange(match.id, v)}
            disabled={!editable}
            aria-label={`Home score for match ${match.match_number}`}
          />
          <span className="text-text-muted font-mono text-base self-center pt-1">–</span>
          <ScoreInput
            value={awayVal}
            onChange={(v) => onAwayChange(match.id, v)}
            disabled={!editable}
            aria-label={`Away score for match ${match.match_number}`}
          />
        </div>
        <div className="flex-1 text-sm font-sans text-text-primary truncate">{awayLabel}</div>
      </div>

      {/* Footer states */}
      {isLocked && (
        <div
          className="mt-3 flex items-center justify-center gap-1.5 text-xs font-sans text-warning"
          data-testid="lock-indicator"
        >
          <Lock size={12} aria-hidden="true" />
          <span>Kicks off in {formatCountdown(countdown)}</span>
        </div>
      )}

      {notPredicted && (
        <div
          className="mt-3 text-center text-xs font-mono uppercase tracking-[0.2em] text-warning"
          data-testid="not-predicted-warning"
        >
          Not predicted yet
        </div>
      )}

      {isCompleted && match.actual_home_score !== null && match.actual_away_score !== null && (
        <div className="mt-3 text-center text-xs font-mono text-text-muted tabular-nums">
          Result: {match.actual_home_score} – {match.actual_away_score}
          {match.penalties && ' (pens)'}
          {match.extra_time && !match.penalties && ' (aet)'}
        </div>
      )}

      {match.status === 'postponed' && match.postponed_reason && (
        <p className="mt-3 text-xs font-sans text-text-muted text-center">
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
        <div className="mt-5 flex items-center justify-end gap-3">
          {dirtyCount > 0 && (
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
              {dirtyCount} unsaved {dirtyCount === 1 ? 'change' : 'changes'}
            </span>
          )}
          <Button
            size="sm"
            onClick={() => onSaveAll(editableMatches)}
            disabled={savingAny || dirtyCount === 0}
          >
            {savingAny ? 'Saving…' : `Save Group ${group.name}`}
          </Button>
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

      // Offline: persist to the write queue, keep the optimistic local value,
      // and let `useOfflineQueue` replay on the next `online` event.
      if (!navigator.onLine) {
        enqueuePrediction({ matchId, home: Number(home), away: Number(away) });
        setLocal((prev) => ({
          ...prev,
          [matchId]: { ...prev[matchId], dirty: false, saving: false },
        }));
        toast.success('Saved offline — will sync when you’re back online');
        return;
      }

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
        // If the fetch failed because we went offline mid-request, enqueue rather
        // than roll back. Otherwise (server error while online) roll back to last
        // server-confirmed values and notify the user to retry.
        if (!navigator.onLine) {
          enqueuePrediction({ matchId, home: Number(home), away: Number(away) });
          setLocal((prev) => ({
            ...prev,
            [matchId]: { ...prev[matchId], dirty: false, saving: false },
          }));
          toast.success('Saved offline — will sync when you’re back online');
          return;
        }
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
      <PageHeader title="My Predictions" eyebrow="Group stage" />
      <PredictionsSubNav />
      <ScoringGuide />

      {isLoading && (
        <div className="space-y-4" aria-label="Loading predictions">
          <div className="flex flex-wrap gap-1.5 pb-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-20 rounded-full" />
            ))}
          </div>
          <Skeleton className="h-[260px] w-full rounded-lg" />
        </div>
      )}

      {!isLoading && sortedGroups.length === 0 && (
        <EmptyState
          title="No groups available yet"
          description="Predictions open once the group draw is finalised and matches are scheduled."
        />
      )}

      {!isLoading && sortedGroups.length > 0 && (
        <>
          {/* Horizontal pill scroller for groups A–L */}
          <nav
            className="-mx-4 sm:-mx-0 mb-5 overflow-x-auto"
            role="tablist"
            aria-label="Tournament groups"
          >
            <div className="flex gap-1.5 px-4 sm:px-0 min-w-max">
              {sortedGroups.map((g, i) => {
                const active = activeGroup === i;
                return (
                  <button
                    key={g.id}
                    role="tab"
                    aria-selected={active}
                    aria-label={`Group ${g.name}`}
                    onClick={() => setActiveGroup(i)}
                    className={cn(
                      'inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-medium font-sans whitespace-nowrap transition-colors press-down focus-visible:outline-none focus-visible:shadow-glow',
                      active
                        ? 'bg-primary/15 text-primary border border-primary/30'
                        : 'bg-surface text-text-secondary hover:bg-surface-elevated border border-border',
                    )}
                  >
                    Group {g.name}
                  </button>
                );
              })}
            </div>
          </nav>

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
