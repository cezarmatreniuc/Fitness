// My Workout — Service Worker
// Caches the app shell so it loads offline.
// Data (weights, reps) lives in localStorage and syncs to
// Supabase when online — unaffected by this file.

const CACHE = 'my-workout-v3';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;700;900&family=Inter:wght@400;500;600&display=swap',
];

// Install: cache all assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// Activate: remove old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: serve from cache, fall back to network
// For Supabase API calls — always go to network (no caching)
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Never cache Supabase or external API calls
  if (url.includes('supabase.co') || url.includes('googleapis.com/')) {
    e.respondWith(fetch(e.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // Cache-first for app shell
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        // Cache successful responses for app assets
        if (resp && resp.status === 200 && resp.type !== 'opaque') {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => caches.match('./index.html')); // fallback to app
    })
  );
});
