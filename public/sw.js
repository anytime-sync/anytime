// Minimal app-shell service worker.
// Bump CACHE version on visual/theme changes to force-flush stale clients.
const CACHE = "firstlight-shell-v8";
const ASSETS = ["/", "/login", "/signup", "/manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // ALWAYS bypass the cache for the photo background and any other
  // image — these change as the user iterates on the theme, and a
  // cached image is the single biggest cause of "I don't see the
  // change". Network-first; fall back to cache only if offline.
  if (
    req.destination === "image" ||
    url.pathname.startsWith("/light-bg") ||
    url.pathname.startsWith("/icons/")
  ) {
    event.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }

  // Network-first for navigations.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match(req).then((r) => r ?? caches.match("/")))
    );
    return;
  }

  // Cache-first for everything else (JS/CSS/fonts).
  if (url.origin === self.location.origin) {
    event.respondWith(caches.match(req).then((cached) => cached ?? fetch(req)));
  }
});
