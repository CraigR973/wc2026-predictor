import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Circle, ChevronRight } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { readChecklist, writeChecklist, markRulesRead } from '../lib/checklist';
import { cn } from '../lib/utils';
import type { PredictionResponse } from '../lib/types';

// ---------------------------------------------------------------------------
// PreTournamentChecklist (U20.4)
//
// A one-time setup checklist shown above the carousel. Three items:
//   1. Read the rules  → /about              (auto-ticks on visit, or manual)
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
  children,
  onLinkClick,
}: {
  done: boolean;
  to: string;
  children: ReactNode;
  /** Called when the row link is clicked (e.g. to auto-tick on navigation). */
  onLinkClick?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border/50 px-4 py-3 last:border-b-0 sm:px-5">
      <span className="shrink-0" aria-hidden>
        {done ? (
          <CheckCircle2 className="h-5 w-5 text-success" />
        ) : (
          <Circle className="h-5 w-5 text-text-muted" />
        )}
      </span>
      <Link
        to={to}
        onClick={onLinkClick}
        className="min-w-0 flex-1 rounded focus-visible:outline-none focus-visible:shadow-glow"
      >
        <span
          className={cn(
            'font-sans text-sm',
            done ? 'text-text-muted line-through' : 'font-medium text-text-primary',
          )}
        >
          {children}
        </span>
      </Link>
      {!done && (
        <ChevronRight className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
      )}
    </div>
  );
}

export function PreTournamentChecklist({
  specialsSubmitted,
  isLoading,
}: {
  specialsSubmitted: boolean | undefined;
  isLoading: boolean;
}) {
  const [state, setState] = useState(() => readChecklist());

  // Shares the ['predictions','me'] key with the carousel, so React Query
  // dedupes the two onto a single request.
  const { data: predictions = [], isLoading: predsLoading } = useQuery<PredictionResponse[]>({
    queryKey: ['predictions', 'me'],
    queryFn: () => apiFetch<PredictionResponse[]>('/api/v1/predictions/me'),
    staleTime: 30_000,
  });

  const rulesDone = state.rulesRead;
  const specialsDone = specialsSubmitted === true;
  const predictedDone = predictions.some(
    (p) => p.predicted_home !== null && p.predicted_away !== null,
  );

  // Only latch "all complete" once the server-derived items have actually
  // loaded — otherwise a returning, fully-set-up user would flash the list.
  const dataReady = !isLoading && !predsLoading && specialsSubmitted !== undefined;
  const allComplete = rulesDone && specialsDone && predictedDone;

  useEffect(() => {
    if (dataReady && allComplete && !state.dismissed) {
      writeChecklist({ dismissed: true });
      setState((s) => ({ ...s, dismissed: true }));
    }
  }, [dataReady, allComplete, state.dismissed]);

  if (state.dismissed) return null;

  function tickRules() {
    markRulesRead();
    setState((s) => ({ ...s, rulesRead: true }));
  }

  function dismiss() {
    writeChecklist({ dismissed: true });
    setState((s) => ({ ...s, dismissed: true }));
  }

  return (
    <section aria-labelledby="home-checklist-label">
      <div className="mb-2 flex items-center justify-between px-0.5">
        <h2
          id="home-checklist-label"
          className="text-lg font-bold tracking-tight text-text-primary"
        >
          Pre-Tournament Checklist
        </h2>
        <button
          type="button"
          onClick={dismiss}
          className="rounded font-sans text-xs text-text-muted transition-colors hover:text-text-secondary focus-visible:outline-none focus-visible:shadow-glow"
        >
          Dismiss
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
        <ChecklistItem done={rulesDone} to="/about" onLinkClick={tickRules}>
          Read the rules
        </ChecklistItem>
        <ChecklistItem done={specialsDone} to="/predictions/specials">
          Submit your Specials picks
        </ChecklistItem>
        <ChecklistItem done={predictedDone} to="/predictions">
          Predict your first match
        </ChecklistItem>
      </div>
    </section>
  );
}
