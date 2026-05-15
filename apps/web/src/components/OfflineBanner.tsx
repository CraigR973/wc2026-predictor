import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-amber-900/80 border-b border-amber-700 text-amber-100 text-sm font-sans text-center py-2 px-4"
    >
      You're offline — some content may be outdated
    </div>
  );
}
