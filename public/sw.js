/// Service Worker for Rostatbrod 2026 — offline caching for the app shell,
/// album photos and static assets.
///
/// Strategy:
///  - INSTALL: precache the app shell (/, icons, manifest)
///  - Album photos (Vercel Blob, lh3.googleusercontent.com, Mux images): cache-first
///  - Next.js static assets (/_next/static/*): cache-first (immutable hashes)
///  - HTML navigations: network-first → fall back to cached /
///  - Everything else same-origin: stale-while-revalidate

const CACHE_NAME = "rostatbrod-v1";

const VIDEO_EXT = /\.(mp4|mov|webm|mkv|m4v|m3u8|ts)(\?|$)/i;

const PRECACHE = [
  "/",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE).catch(() => {}))
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

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Cache album images (skip video/stream files — too big for offline cache).
  if (
    (url.hostname === "lh3.googleusercontent.com" ||
      url.hostname === "image.mux.com" ||
      url.hostname.endsWith(".blob.vercel-storage.com")) &&
    !VIDEO_EXT.test(url.pathname)
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request)
            .then((res) => {
              if (res.ok) {
                const clone = res.clone();
                caches.open(CACHE_NAME).then((c) => c.put(request, clone));
              }
              return res;
            })
            .catch(() => cached || new Response("", { status: 503 }))
      )
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            if (res.ok) {
              const clone = res.clone();
              caches.open(CACHE_NAME).then((c) => c.put(request, clone));
            }
            return res;
          })
      )
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match("/")))
        .then((r) => r || new Response("Offline – ladda sidan online först.", { status: 503 }))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const fresh = fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          }
          return res;
        })
        .catch(() => cached || new Response("", { status: 503 }));
      return cached || fresh;
    })
  );
});
