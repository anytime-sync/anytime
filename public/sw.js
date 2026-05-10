/* eslint-env serviceworker */
/**
 * First Light service worker.
 * Round G: offline shell + push notifications + share-target relay.
 *
 * Caching strategy:
 *   - App shell (HTML, CSS, JS): stale-while-revalidate
 *   - API calls: network-first with 4s timeout, fallback to cache
 *   - Static assets (images, icons): cache-first
 *
 * Increment SW_VERSION when shipping changes so old caches get evicted.
 */
const SW_VERSION = "fl-v49-2026-05-10-quick-add-events";
const SHELL_CACHE = `shell-${SW_VERSION}`;
const RUNTIME_CACHE = `runtime-${SW_VERSION}`;

const SHELL_URLS = [
  "/",
  "/app/today",
  "/app/calendar",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Use addAll with a fallback so a single 404 doesn't kill the install.
      await Promise.all(
        SHELL_URLS.map((url) =>
          cache.add(url).catch(() => {
            /* skip */
          })
        )
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => !k.endsWith(SW_VERSION))
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Don't intercept Supabase/Google/Anthropic — let them pass through.
  if (
    url.host.endsWith("supabase.co") ||
    url.host.endsWith("googleapis.com") ||
    url.host.endsWith("anthropic.com")
  ) {
    return;
  }

  // API calls: network-first with 4s timeout.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(req));
    return;
  }

  // Same-origin static + HTML: stale-while-revalidate.
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(req));
  }
});

async function networkFirst(req) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const fresh = await Promise.race([
      fetch(req),
      new Promise((_, rej) => setTimeout(() => rej("timeout"), 4000)),
    ]);
    if (fresh && fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match(req);
    if (cached) return cached;
    return new Response(JSON.stringify({ offline: true }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(req);
  const fetchAndUpdate = fetch(req)
    .then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => cached);
  return cached || fetchAndUpdate;
}

/* -------- push handlers -------- */
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "First Light", body: event.data ? event.data.text() : "" };
  }
  const title = payload.title || "First Light";
  const body = payload.body || "";
  const tag = payload.tag || undefined;
  const url = payload.url || "/app/today";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/app/today";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const c of all) {
        if (c.url.endsWith(targetUrl) && "focus" in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })()
  );
});
