import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { formatInTimeZone } from 'date-fns-tz';
import { Lock } from 'lucide-react';
import type { MatchResponse, PredictionResponse, PointsBreakdown } from '../lib/types';
import { Badge } from './ui/badge';
import { PointsBreakdownPopover } from './PointsBreakdownPopover';
import { ScoreInput } from './ui/score-input';
import { useCountdown } from '../hooks/useCountdown';
import { canEdit, statusLabel, statusVariant } from '../lib/matchStatus';
import type { LocalPrediction } from '../hooks/usePredictionEditor';
import { cn } from '../lib/utils';

// ---------------------------------------------------------------------------
// Points badge with count-up animation
// ---------------------------------------------------------------------------

function PointsBadge({ points, breakdown }: { points: number; breakdown?: PointsBreakdown | null }) {
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
    <PointsBreakdownPopover breakdown={breakdown}>
      <Badge variant={points > 0 ? 'success' : 'muted'} data-testid="points-badge" aria-live="polite">
        {displayed} {displayed === 1 ? 'pt' : 'pts'}
      </Badge>
    </PointsBreakdownPopover>
  );
}

// ---------------------------------------------------------------------------
// Countdown formatter
// ---------------------------------------------------------------------------

function formatCountdown(parts: { days: number; hours: number; minutes: number; seconds: number; expired: boolean }): string {
  if (parts.expired) return 'Started';
  if (parts.days > 0) return `${parts.days}d ${parts.hours}h`;
  if (parts.hours > 0) return `${parts.hours}h ${parts.minutes}m`;
  return `${parts.minutes}m ${parts.seconds}s`;
}

// ---------------------------------------------------------------------------
// Prediction card — a single match with editable score inputs.
//
// Shared by the Predictions page (group panels) and the home upcoming-matches
// carousel. Presentation only: all editing behaviour lives in the parent via
// the onHomeChange / onAwayChange callbacks (see usePredictionEditor).
// ---------------------------------------------------------------------------

export interface PredictionCardProps {
  match: MatchResponse;
  prediction: PredictionResponse | undefined;
  local: LocalPrediction | undefined;
  timezone: string;
  highlighted: boolean;
  onHomeChange: (matchId: string, value: string) => void;
  onAwayChange: (matchId: string, value: string) => void;
  /**
   * Space-constrained contexts (the home carousel) render team codes — "🇲🇽 MEX"
   * — instead of full names, which truncate to 2–3 chars in a narrow card and
   * become ambiguous (South Africa vs South Korea both show "So…"). Defaults to
   * full names so the Predictions page is unchanged.
   */
  compact?: boolean;
}

export function PredictionCard({
  match,
  prediction,
  local,
  timezone,
  highlighted,
  onHomeChange,
  onAwayChange,
  compact = false,
}: PredictionCardProps) {
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
    ? `${match.home_team.flag_emoji} ${compact ? match.home_team.code : match.home_team.name}`
    : (match.home_team_placeholder ?? '?');
  const awayLabel = match.away_team
    ? `${match.away_team.flag_emoji} ${compact ? match.away_team.code : match.away_team.name}`
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
          {isCompleted && points !== null && !noSubmission && (
            <PointsBadge points={points} breakdown={prediction?.points_breakdown} />
          )}
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
