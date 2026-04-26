// Minimal app-shell service worker. Use a tool like next-pwa or workbox for fancier strategies.
// Bump CACHE version on visual/theme changes to force-flush stale clients.
const CACHE = "firstlight-shell-v6";
const ASSETS = ["/", "/login", "/signup", "/manifest.webmanifest", "/light-bg.jpg"];

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
  // Network-first for navigation, cache-first for static
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match(req).then((r) => r ?? caches.match("/")))
    );
  } else if (req.url.startsWith(self.location.origin)) {
    ev