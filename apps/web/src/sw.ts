/// <reference lib="WebWorker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

// vite-plugin-pwa replaces self.__WB_MANIFEST with the precache manifest at build time
declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null } | string>;
};

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// SPA navigation fallback — serve cached index.html for all non-API navigations
registerRoute(
  new NavigationRoute(
    new NetworkFirst({
      cacheName: 'navigation',
      networkTimeoutSeconds: 3,
    }),
    { denylist: [/^\/api/] },
  ),
);

// ─── API caching (Phase 11.2 — offline support) ───────────────────────────────
// Match/group data is shared across players and rarely changes → stale-while-revalidate.
// Per-player data (predictions, leaderboard, stats) is dynamic → network-first with
// a 3s timeout so cached data is used when offline. Both restrict cached responses
// to GET 200s; auth-rejected (401/403) and mutating verbs are never cached.

registerRoute(
  ({ url, request }) =>
    request.method === 'GET' &&
    /^\/api\/v1\/(matches|groups)(\/|$|\?)/.test(url.pathname),
  new StaleWhileRevalidate({
    cacheName: 'api-matches',
    plugins: [
      new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 }),
      new CacheableResponsePlugin({ statuses: [200] }),
    ],
  }),
);

registerRoute(
  ({ url, request }) =>
    request.method === 'GET' &&
    /^\/api\/v1\/(predictions|leaderboard|players|stats|specials|knockout-predictions)(\/|$|\?)/.test(
      url.pathname,
    ),
  new NetworkFirst({
    cacheName: 'api-user-data',
    networkTimeoutSeconds: 3,
    plugins: [
      new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [200] }),
    ],
  }),
);

// Google Fonts stylesheets
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new CacheFirst({
    cacheName: 'google-fonts-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
);

// Google Fonts files
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'gstatic-fonts-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
);

// ─── Push notifications ───────────────────────────────────────────────────────

interface PushPayload {
  title: string;
  body: string;
  data?: { url?: string; [key: string]: unknown };
}

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload: PushPayload;
  try {
    payload = event.data.json() as PushPayload;
  } catch {
    return;
  }

  const { title, body, data } = payload;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data,
      requireInteraction: false,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url: string = (event.notification.data as { url?: string } | undefined)?.url ?? '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          void client.focus();
          if ('navigate' in client) void (client as WindowClient).navigate(url);
          return;
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
