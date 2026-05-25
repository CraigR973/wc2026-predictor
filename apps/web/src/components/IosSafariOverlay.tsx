import { useEffect, useRef } from 'react';
import { Share, X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface IosSafariOverlayProps {
  onDismiss: () => void;
}

/**
 * Tutorial overlay for iOS Safari — shown on first visit to explain how to
 * add the PWA to the home screen, since iOS blocks programmatic install prompts.
 */
export function IosSafariOverlay({ onDismiss }: IosSafariOverlayProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  // Trap focus inside the overlay
  useEffect(() => {
    closeRef.current?.focus();
    const prev = document.activeElement as HTMLElement | null;
    return () => {
      prev?.focus();
    };
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onDismiss]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add to Home Screen instructions"
      className="fixed inset-0 z-[70] flex flex-col items-center justify-end"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-hidden="true"
        onClick={onDismiss}
      />

      {/* Sheet */}
      <div className="relative w-full max-w-sm mx-auto mb-safe-or-4 mx-4 rounded-2xl bg-surface border border-border shadow-sheet px-6 pt-5 pb-8 animate-in slide-in-from-bottom-4 duration-300">
        {/* Dismiss */}
        <button
          ref={closeRef}
          onClick={onDismiss}
          aria-label="Close"
          className="absolute top-4 right-4 p-1.5 rounded-full text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors focus-visible:outline-none focus-visible:shadow-glow"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>

        {/* Heading */}
        <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-text-muted mb-1">
          Install
        </p>
        <h2 className="text-lg font-semibold text-text-primary font-sans mb-4">
          Add to Home Screen
        </h2>

        {/* Steps */}
        <ol className="space-y-4">
          <li className="flex items-start gap-3">
            <span className="shrink-0 w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-semibold font-mono flex items-center justify-center mt-0.5">
              1
            </span>
            <div className="flex-1">
              <p className="text-sm font-sans text-text-primary">
                Tap the{' '}
                <span className="inline-flex items-center gap-1 font-semibold">
                  <Share className="h-4 w-4 text-[#007AFF]" aria-label="Share" />
                  Share
                </span>{' '}
                button
              </p>
              <p className="text-xs text-text-muted mt-0.5">
                In the Safari toolbar — bottom of the screen on iPhone, top on iPad.
              </p>
            </div>
          </li>

          <li className="flex items-start gap-3">
            <span className="shrink-0 w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-semibold font-mono flex items-center justify-center mt-0.5">
              2
            </span>
            <div className="flex-1">
              <p className="text-sm font-sans text-text-primary">
                Scroll down and tap{' '}
                <span className="inline-flex items-center gap-1 font-semibold">
                  <Plus className="h-4 w-4" aria-hidden />
                  Add to Home Screen
                </span>
              </p>
              <p className="text-xs text-text-muted mt-0.5">
                Then tap <strong className="font-semibold text-text-secondary">Add</strong> in the top-right corner.
              </p>
            </div>
          </li>
        </ol>

        {/* Arrow hint pointing down toward the Safari toolbar (iPhone) */}
        <div className="mt-6 flex flex-col items-center gap-1.5">
          <div
            className={cn(
              'w-px h-8 rounded-full',
              'bg-gradient-to-b from-primary/60 to-transparent',
            )}
            aria-hidden="true"
          />
          <div
            className="w-2 h-2 border-b-2 border-r-2 border-primary/60 rotate-45 -mt-2"
            aria-hidden="true"
          />
        </div>

        <button
          onClick={onDismiss}
          className="mt-5 w-full py-2.5 rounded-xl border border-border text-sm font-sans text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors focus-visible:outline-none focus-visible:shadow-glow"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
