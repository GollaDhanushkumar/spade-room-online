// Minimal service worker — just enough for PWA installability.
// No offline caching (the app needs Supabase realtime, so offline doesn't make sense).

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass through every request unchanged — no caching, just network
  return;
});