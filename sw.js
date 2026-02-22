// Turret Card Reference — Service Worker
// Caches all assets for full offline functionality
// Bump version to force cache refresh on updates
const CACHE_NAME = 'turret-ref-v3';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './favicon.png'
];

// Install: cache all core assets immediately
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(APP_SHELL).then(() => {
        // Cache fonts separately (may fail, that's OK)
        return cache.add('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;600&display=swap').catch(() => {});
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean up ALL old caches, take control immediately
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch handler with smart strategies per resource type
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // HTML pages: network-first (so updates show quickly, but works offline)
  if (url.origin === self.location.origin && (event.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/'))) {
    event.respondWith(
      fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        return caches.match(event.request).then(cached => {
          return cached || caches.match('./index.html');
        });
      })
    );
    return;
  }

  // Static assets (images, manifest): cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => new Response('', { status: 404 }));
      })
    );
    return;
  }

  // Google Fonts: stale-while-revalidate
  if (url.hostname.includes('fonts.g') || url.hostname.includes('gstatic')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const fetching = fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        }).catch(() => cached);
        return cached || fetching;
      })
    );
    return;
  }

  // Default: network with cache fallback
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
