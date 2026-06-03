import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Trophy, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'sss_howitworks_collapsed';

function isCollapsed(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
}

function persistCollapsed(v: boolean): void {
  try { localStorage.setItem(STORAGE_KEY, v ? '1' : '0'); } catch { /* ignore */ }
}

interface Fact {
  Icon: React.ElementType;
  text: React.ReactNode;
}

const FACTS: Fact[] = [
  {
    Icon: Lock,
    text: <>Predictions <strong className="text-text-primary font-semibold">lock at each match's kickoff</strong> — there's no single tournament deadline. Submit before the whistle or miss the points.</>,
  },
  {
    Icon: Trophy,
    text: <>Scoring stacks: correct result = 3 pts, correct goals total = 2 pts, exact score = 5 pts. <strong className="text-text-primary font-semibold">Max 10 per match.</strong></>,
  },
  {
    Icon: RefreshCw,
    text: <>Knockout winner picks <strong className="text-text-primary font-semibold">open round-by-round</strong> as teams qualify — you don't fill in a full bracket upfront.</>,
  },
];

export function WelcomeCard() {
  const [collapsed, setCollapsedState] = useState<boolean>(() => isCollapsed());

  function toggle() {
    const next = !collapsed;
    setCollapsedState(next);
    persistCollapsed(next);
  }

  return (
    <div className={cn('rounded-lg border border-primary/30 bg-primary/5')}>
      <button
        id="how-it-works-btn"
        onClick={toggle}
        aria-expanded={!collapsed}
        aria-controls="how-it-works-content"
        className="flex w-full items-center gap-2 rounded-lg px-4 py-3 text-left transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:shadow-glow"
      >
        <span className="flex-1 font-mono text-[10px] uppercase tracking-[0.25em] text-primary">
          How it works
        </span>
        {collapsed ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        ) : (
          <ChevronUp className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        )}
      </button>

      {!collapsed && (
        <div
          id="how-it-works-content"
          role="region"
          aria-labelledby="how-it-works-btn"
          className="border-t border-primary/20 px-4 pb-4 pt-3"
        >
          <ul className="mb-4 space-y-2.5">
            {FACTS.map(({ Icon, text }, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <Icon className="mt-[1px] h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span className="font-sans text-sm leading-snug text-text-secondary">{text}</span>
              </li>
            ))}
          </ul>

          <Link
            to="/about"
            className="font-sans text-xs text-primary underline-offset-2 hover:underline focus-visible:outline-none"
          >
            Full rules &amp; how it works →
          </Link>
        </div>
      )}
    </div>
  );
}
