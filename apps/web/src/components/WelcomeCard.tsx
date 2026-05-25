import { useState } from 'react';
import { Link } from 'react-router-dom';
import { X, Lock, Trophy, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'sss_welcome_dismissed';

function isDismissed(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
}

function dismiss(): void {
  try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
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
  const [visible, setVisible] = useState(() => !isDismissed());

  if (!visible) return null;

  function handleDismiss() {
    dismiss();
    setVisible(false);
  }

  return (
    <div
      role="region"
      aria-label="Quick guide"
      className={cn(
        'relative rounded-lg border border-primary/30 bg-primary/5 px-4 py-4',
        'animate-in fade-in slide-in-from-top-2 duration-300',
      )}
    >
      {/* Dismiss */}
      <button
        onClick={handleDismiss}
        aria-label="Dismiss quick guide"
        className="absolute top-3 right-3 p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors focus-visible:outline-none focus-visible:shadow-glow"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>

      <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-primary mb-2">
        Before you start
      </p>
      <h2 className="text-sm font-semibold text-text-primary font-sans mb-3">
        Three things worth knowing
      </h2>

      <ul className="space-y-2.5 mb-4">
        {FACTS.map(({ Icon, text }, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <Icon className="h-4 w-4 text-primary shrink-0 mt-[1px]" aria-hidden />
            <span className="text-sm font-sans text-text-secondary leading-snug">{text}</span>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-3">
        <Link
          to="/about"
          className="text-xs font-sans text-primary hover:underline underline-offset-2 focus-visible:outline-none"
        >
          Full rules &amp; how it works →
        </Link>
        <button
          onClick={handleDismiss}
          className="ml-auto px-3 py-1.5 rounded-md bg-primary text-white text-xs font-sans font-semibold hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:shadow-glow"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
