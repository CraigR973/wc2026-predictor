import { useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from './ui/button';

export function UpdateBanner() {
  const [dismissed, setDismissed] = useState(false);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh || dismissed) return null;

  function handleUpdate() {
    void updateServiceWorker(true);
    window.location.reload();
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 inset-x-0 z-50 flex items-center justify-between gap-3 px-4 py-2 bg-surface-elevated border-b border-accent/40 text-text-primary text-sm font-sans"
    >
      <span>New version available</span>
      <div className="flex items-center gap-2 shrink-0">
        <Button variant="accent" size="sm" onClick={handleUpdate}>
          Update
        </Button>
        <button
          type="button"
          aria-label="Dismiss update banner"
          onClick={() => setDismissed(true)}
          className="text-text-muted hover:text-text-primary transition-colors text-base leading-none"
        >
          ×
        </button>
      </div>
    </div>
  );
}
