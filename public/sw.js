// Self-cleaning Service Worker for Development
// Clears any old cached HTML/chunks and unregisters to prevent hydration freezes.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(names.map((name) => caches.delete(name))))
      .then(() => self.clients.claim())
      .then(() => {
        // Automatically unregister so localhost stays clean in development
        return self.registration.unregister();
      })
  );
});

// Do not intercept or cache any network requests in development
self.addEventListener("fetch", () => {
  return;
});
