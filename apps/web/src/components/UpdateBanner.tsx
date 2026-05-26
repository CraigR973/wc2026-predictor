import { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { RefreshCw, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function UpdateBanner() {
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [updateSW, setUpdateSW] = useState<((reloadPage?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    const sw = registerSW({
      onNeedRefresh() {
        setNeedsRefresh(true);
      },
      onOfflineReady() {
        // SW cached — no UI needed
      },
    });
    setUpdateSW(() => sw);
  }, []);

  if (!needsRefresh || dismissed) return null;

  const handleRefresh = async () => {
    if (updateSW) await updateSW(true);
  };

  // Pin to the top of the viewport with `pt-safe` so the *content* lives
  // below the iOS status bar / notch — same pattern as `<TopBar>`. The
  // previous `top-safe-or-0` class did not exist as a Tailwind utility,
  // so the banner was rendering under the system status bar and the
  // buttons were not tappable in the PWA. The outer wrapper carries the
  // colour so the strip behind the notch is filled instead of see-through.
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed top-0 left-0 right-0 z-[60]',
        'pt-safe bg-primary text-white shadow-md',
      )}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <RefreshCw className="h-4 w-4 shrink-0" aria-hidden />
          <span className="text-sm font-sans font-medium truncate">
            A new version is available
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => void handleRefresh()}
            className="tap-target px-3 py-1 rounded-sm text-sm font-sans font-semibold bg-white/20 hover:bg-white/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            Refresh
          </button>
          <button
            onClick={() => setDismissed(true)}
            aria-label="Dismiss update banner"
            className="tap-target p-1 rounded-sm hover:bg-white/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
