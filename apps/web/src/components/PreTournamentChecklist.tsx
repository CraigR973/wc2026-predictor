import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Circle, ChevronRight } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { readChecklist } from '../lib/checklist';
import { cn } from '../lib/utils';
import type { PredictionResponse } from '../lib/types';
import { NotificationsPromptModal } from './NotificationsPromptModal';
import { usePushSubscription } from '../hooks/usePushSubscription';

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)')?.matches === true ||
    ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true)
  );
}

// ---------------------------------------------------------------------------
// PreTournamentChecklist (U20.4)
//
// A one-time setup checklist shown above the carousel. Three items:
//   1. Read the rules  → /about              (ticks once the user reaches the end)
//   2. Submit Specials → /predictions/specials (ticks when specials_submitted)
//   3. Predict a match → /predictions          (ticks when ≥1 prediction)
//
// Once all three are done the section latches `dismissed` and unmounts for
// good; a manual "Dismiss" does the same. State lives in localStorage via
// lib/checklist so it survives reloads with no server round-trip.
// ---------------------------------------------------------------------------

function ChecklistItem({
  done,
  to,
  onClick,
  children,
}: {
  done: boolean;
  to?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  const label = (
    <span
      className={cn(
        'font-sans text-sm',
        done ? 'text-text-muted line-through' : 'font-medium text-text-primary',
      )}
    >
      {children}
    </span>
  );
  const interactiveClass =
    'min-w-0 flex-1 text-left rounded focus-visible:outline-none focus-visible:shadow-glow';
  return (
    <div className="flex items-center gap-3 border-b border-border/50 px-4 py-3 last:border-b-0 sm:px-5">
      <span className="shrink-0" aria-hidden>
        {done ? (
          <CheckCircle2 className="h-5 w-5 text-success" />
        ) : (
          <Circle className="h-5 w-5 text-text-muted" />
        )}
      </span>
      {to ? (
        <Link to={to} className={interactiveClass}>
          {label}
        </Link>
      ) : (
        <button type="button" onClick={onClick} className={interactiveClass}>
          {label}
        </button>
      )}
      {!done && (
        <ChevronRight className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
      )}
    </div>
  );
}

export function PreTournamentChecklist({
  hasLeague,
  specialsSubmitted,
  tournamentStarted,
  kickoffIso,
}: {
  hasLeague: boolean;
  specialsSubmitted: boolean | undefined;
  tournamentStarted: boolean;
  kickoffIso: string | null;
}) {
  const [state] = useState(() => readChecklist());
  const [notifOpen, setNotifOpen] = useState(false);
  const { isSubscribed: notificationsOn } = usePushSubscription();
  const installed = isStandalone();

  // Shares the ['predictions','me'] key with the carousel, so React Query
  // dedupes the two onto a single request.
  const { data: predictions = [] } = useQuery<PredictionResponse[]>({
    queryKey: ['predictions', 'me'],
    queryFn: () => apiFetch<PredictionResponse[]>('/api/v1/predictions/me'),
    staleTime: 30_000,
  });

  const rulesDone = state.rulesRead;
  const specialsDone = specialsSubmitted === true;
  const predictedDone = predictions.some(
    (p) => p.predicted_home !== null && p.predicted_away !== null,
  );

  const msToKickoff = kickoffIso ? new Date(kickoffIso).getTime() - Date.now() : null;
  const countdownLabel =
    msToKickoff != null && msToKickoff > 0
      ? (() => {
          const days = Math.floor(msToKickoff / 86_400_000);
          const hours = Math.floor((msToKickoff % 86_400_000) / 3_600_000);
          const mins = Math.floor((msToKickoff % 3_600_000) / 60_000);
          return days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
        })()
      : null;

  // Hide once the first match has kicked off — no dismiss before then.
  if (tournamentStarted) return null;

  return (
    <section aria-labelledby="home-checklist-label" className="mt-3">
      <div className="mb-2 px-0.5">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <h2
              id="home-checklist-label"
              className="text-lg font-bold tracking-tight text-text-primary"
            >
              Pre-Tournament Checklist
            </h2>
            {countdownLabel && (
              <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 font-mono text-xs font-semibold text-primary">
                {countdownLabel} to kickoff
              </span>
            )}
          </div>
          <p className="text-sm font-sans leading-relaxed text-text-secondary">
            This is your only checklist — just {installed ? 5 : 4} things, all due before the opening match kicks off.
            Nothing else is required until the tournament starts.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
        <ChecklistItem done={hasLeague} to="/leagues">
          Join or create a league
        </ChecklistItem>
        <ChecklistItem done={rulesDone} to="/about">
          Read the rules
        </ChecklistItem>
        <ChecklistItem done={specialsDone} to="/predictions/specials">
          Submit your Specials picks
        </ChecklistItem>
        <ChecklistItem done={predictedDone} to="/predictions">
          Predict your first match
        </ChecklistItem>
        {installed && (
          <ChecklistItem done={notificationsOn} onClick={() => setNotifOpen(true)}>
            Turn on match alerts
          </ChecklistItem>
        )}
      </div>
      {notifOpen && <NotificationsPromptModal onClose={() => setNotifOpen(false)} />}
    </section>
  );
}
