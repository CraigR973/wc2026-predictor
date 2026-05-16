import { useEffect, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  flushQueue,
  getQueueCount,
  subscribeQueue,
} from '../lib/offlineQueue';

/**
 * Subscribes the calling component to the offline-queue count and registers a
 * single global `online` listener that auto-flushes the queue when the network
 * returns. On a successful flush we invalidate `predictions` queries so the
 * UI re-fetches authoritative server state and clears any stale local values.
 */
export function useOfflineQueue(): number {
  const count = useSyncExternalStore(subscribeQueue, getQueueCount, getQueueCount);
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;

    async function runFlush(): Promise<void> {
      const result = await flushQueue();
      if (cancelled) return;
      if (result.succeeded.length > 0) {
        toast.success(
          `Synced ${result.succeeded.length} pending prediction${result.succeeded.length === 1 ? '' : 's'}`,
        );
        await queryClient.invalidateQueries({ queryKey: ['predictions', 'me'] });
      }
      if (result.failed.length > 0) {
        toast.error(
          `${result.failed.length} prediction${result.failed.length === 1 ? '' : 's'} still pending — will retry`,
        );
      }
    }

    function handleOnline(): void {
      void runFlush();
    }
    window.addEventListener('online', handleOnline);

    // Flush on mount if we came back from being offline with queued items.
    if (navigator.onLine && getQueueCount() > 0) {
      void runFlush();
    }

    return () => {
      cancelled = true;
      window.removeEventListener('online', handleOnline);
    };
  }, [queryClient]);

  return count;
}
