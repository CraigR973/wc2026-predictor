import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'sss_scoring_guide_open';

function getInitialOpen(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) !== 'false'; } catch { return true; }
}

function persistOpen(open: boolean): void {
  try { localStorage.setItem(STORAGE_KEY, String(open)); } catch { /* ignore */ }
}

interface Row { label: string; note: string; pts: string; accent?: boolean }

const ROWS: Row[] = [
  { label: 'Correct combined goals', note: 'e.g. 2–1 vs 3–0: both = 3 goals', pts: '2' },
  { label: 'Correct result',         note: 'Win / Draw / Loss',                pts: '3' },
  { label: 'Exact scoreline',        note: 'Both goals right',                  pts: '5' },
  { label: 'Maximum per match',      note: 'All three stack',                   pts: '10', accent: true },
];

/**
 * Collapsible scoring quick-reference for the Predictions page.
 * Default open on first visit; toggle state persisted in localStorage.
 */
export function ScoringGuide() {
  const [open, setOpen] = useState(getInitialOpen);

  function toggle() {
    const next = !open;
    setOpen(next);
    persistOpen(next);
  }

  return (
    <div className="rounded-lg border border-border bg-surface mb-4 overflow-hidden">
      {/* Header row — always visible */}
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="scoring-guide-body"
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface-elevated transition-colors focus-visible:outline-none focus-visible:shadow-glow"
      >
        <div className="flex items-center gap-2">
          <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-text-muted">
            Scoring quick-ref
          </p>
          <span className="inline-block px-1.5 py-0.5 rounded bg-primary/15 text-primary font-mono text-[10px] font-semibold leading-4">
            max 10 / match
          </span>
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-text-muted transition-transform duration-200',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>

      {/* Collapsible body */}
      {open && (
        <div id="scoring-guide-body">
          {/* Lock reminder */}
          <div className="mx-4 mb-3 flex items-start gap-2 rounded-md bg-warning/10 border border-warning/20 px-3 py-2">
            <span className="text-warning text-xs mt-px" aria-hidden>⏱</span>
            <p className="text-xs font-sans text-text-secondary leading-snug">
              <strong className="text-text-primary font-semibold">Predictions lock at each match's kickoff</strong> — not a single deadline. Submit before the whistle.
            </p>
          </div>

          {/* Scoring table */}
          <table className="w-full text-xs font-sans border-collapse px-1 mb-1">
            <thead>
              <tr className="border-t border-b border-border">
                <th className="text-left py-1.5 pl-4 text-text-muted font-medium uppercase tracking-wider text-[10px]">
                  Criteria
                </th>
                <th className="text-right py-1.5 pr-4 text-text-muted font-medium uppercase tracking-wider text-[10px] w-12">
                  Pts
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr
                  key={r.label}
                  className={cn(
                    'border-b border-border/50',
                    r.accent && 'bg-surface-elevated/60',
                  )}
                >
                  <td className="py-2 pl-4">
                    <p className={cn('font-medium', r.accent ? 'text-text-primary' : 'text-text-secondary')}>
                      {r.label}
                    </p>
                    <p className="text-text-muted text-[11px]">{r.note}</p>
                  </td>
                  <td className="py-2 pr-4 text-right">
                    <span
                      className={cn(
                        'inline-block px-1.5 py-0.5 rounded-full font-mono font-semibold text-[11px] leading-4',
                        r.accent
                          ? 'bg-accent/15 text-accent'
                          : 'bg-primary/15 text-primary',
                      )}
                    >
                      {r.pts}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
