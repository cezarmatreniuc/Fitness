// My Workout — Service Worker
// VERSION is bumped on every deploy so the phone always fetches fresh HTML.
// Strategy: network-first for index.html (always get latest app code),
//            cache-first for fonts and other static assets.

const VERSION = 'my-workout-v11';
const CACHE   = VERSION;

const ALWAYS_FRESH = ['./', './index.html']; // always try network first

self.addEventListener('install', e => {
  // Install immediately — don't wait for old SW to die
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll([
      './index.html',
      'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;700;900&family=Inter:wght@400;500;600&display=swap',
    ])).catch(() => {}) // don't block install if font fetch fails offline
  );
});

self.addEventListener('activate', e => {
  // Delete ALL old caches so stale code never lingers
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()) // take control of all open tabs immediately
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Never intercept Supabase API calls or external requests
  if (url.includes('supabase.co') || url.includes('googleapis.com/')) {
    e.respondWith(fetch(e.request).catch(() => new Response('', {status: 503})));
    return;
  }

  const isAppShell = ALWAYS_FRESH.some(p => url.endsWith(p) || url.endsWith(p + '?'));

  if (isAppShell) {
    // Network-first for the app HTML: always try to get the latest version.
    // Falls back to cache only when truly offline.
    e.respondWith(
      fetch(e.request)
        .then(resp => {
          // Update the cache with the fresh version
          if (resp && resp.status === 200) {
            const clone = resp.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return resp;
        })
        .catch(() => caches.match('./index.html'))
    );
  } else {
    // Cache-first for everything else (fonts, etc.)
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(resp => {
          if (resp && resp.status === 200) {
            const clone = resp.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return resp;
        }).catch(() => new Response('', {status: 503}));
      })
    );
  }
});

// Listen for a "skip waiting" message so the app can force an update
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
