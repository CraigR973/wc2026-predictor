import { Download, X } from 'lucide-react';

interface AndroidInstallBannerProps {
  onInstall: () => Promise<void>;
  onDismiss: () => void;
}

export function AndroidInstallBanner({ onInstall, onDismiss }: AndroidInstallBannerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-safe-or-4 left-4 right-4 z-[60] flex items-center gap-3 rounded-xl bg-surface-elevated border border-border shadow-lg px-4 py-3 animate-in slide-in-from-bottom-4 duration-300"
    >
      <div className="shrink-0 w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
        <Download className="h-5 w-5 text-primary" aria-hidden />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-sans font-semibold text-text-primary leading-tight">
          Install the app
        </p>
        <p className="text-xs font-sans text-text-muted leading-tight">
          For the best experience, add SSS to your home screen.
        </p>
      </div>
      <button
        onClick={() => void onInstall()}
        className="shrink-0 px-3 py-1.5 rounded-md bg-primary text-white text-sm font-sans font-semibold hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:shadow-glow"
      >
        Install
      </button>
      <button
        onClick={onDismiss}
        aria-label="Dismiss install banner"
        className="shrink-0 p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-surface transition-colors focus-visible:outline-none focus-visible:shadow-glow"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
