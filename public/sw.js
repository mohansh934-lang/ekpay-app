// EkApp Service Worker — offline support + install prompt + caching

const CACHE_NAME = "ekapp-v1";
const STATIC_ASSETS = [
  "/",
  "/icon.svg",
  "/manifest.json",
];

// Install: cache critical assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first for API, cache-first for static
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // API calls: always network (no caching)
  if (url.pathname.startsWith("/api/")) return;

  // Static assets: cache-first, fallback to network
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Cache successful GET responses
        if (response.ok && event.request.method === "GET") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback for navigation
        if (event.request.mode === "navigate") {
          return caches.match("/") || new Response(
            "<html><body style='font-family:system-ui;text-align:center;padding:60px 20px'><h2>📱 Offline</h2><p>Ek App needs internet to work. Please check your connection.</p></body></html>",
            { headers: { "Content-Type": "text/html" } }
          );
        }
        return new Response("", { status: 408 });
      });
    })
  );
});

