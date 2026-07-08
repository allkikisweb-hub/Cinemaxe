// Minimal service worker — enables PWA installability.
// Intentionally does not cache app content, so users always get the latest
// build; it only needs to exist and control the page for installability.
const CACHE_NAME = "cinemax-shell-v1";
const SHELL_ASSETS = ["/", "/manifest.json", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first, falling back to cache only for navigation requests so the
// app still opens if the user is briefly offline. Everything else (API
// calls, TMDB, etc.) always goes to the network.
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match("/"))
  );
});
