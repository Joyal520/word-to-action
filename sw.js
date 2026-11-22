const CACHE_VERSION = 'v1';
const SHELL_CACHE = `bp-shell-${CACHE_VERSION}`;
const FONT_CACHE = `bp-fonts-${CACHE_VERSION}`;
const API_CACHE = `bp-api-${CACHE_VERSION}`;
const VALID_CACHES = new Set([SHELL_CACHE, FONT_CACHE, API_CACHE]);

const SHELL_ASSETS = [
  './bible-promises.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => {
      if (!self.registration.active) {
        return self.skipWaiting();
      }
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('bp-') && !VALID_CACHES.has(k)).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

async function networkWithTimeout(request, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const resp = await fetch(request, { signal: ctrl.signal });
    clearTimeout(timer);
    return resp;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Fonts: cache-first with background refresh
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONT_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const netPromise = fetch(req).then((resp) => {
          if (resp && resp.ok) cache.put(req, resp.clone());
          return resp;
        }).catch(() => cached);
        return cached || netPromise;
      })
    );
    return;
  }

  // HelloAO Bible API: network-first, cache valid JSON responses
  if (url.hostname === 'bible.helloao.org') {
    event.respondWith(
      caches.open(API_CACHE).then(async (cache) => {
        try {
          const resp = await networkWithTimeout(req, 5000);
          const ct = resp.headers.get('content-type') || '';
          if (resp.ok && ct.includes('json')) {
            cache.put(req, resp.clone());
          }
          return resp;
        } catch {
          const cached = await cache.match(req);
          if (cached) return cached;
          return new Response(JSON.stringify({ error: 'offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      })
    );
    return;
  }

  // Same-origin app shell and navigation
  if (url.origin === self.location.origin) {
    const isAppShell = url.pathname.endsWith('/bible-promises.html') || url.pathname.endsWith('/');
    if (req.mode === 'navigate' || isAppShell) {
      event.respondWith(
        caches.open(SHELL_CACHE).then(async (cache) => {
          try {
            const resp = await networkWithTimeout(req, 3000);
            const ct = resp.headers.get('content-type') || '';
            if (resp && resp.ok && isAppShell && ct.includes('text/html')) {
              cache.put('./bible-promises.html', resp.clone());
            }
            return resp;
          } catch {
            return (await cache.match(req)) || (await cache.match('./bible-promises.html'));
          }
        })
      );
      return;
    }

    // Static assets (icons, manifest)
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const resp = await fetch(req);
          if (resp && resp.ok) cache.put(req, resp.clone());
          return resp;
        } catch {
          return new Response('', { status: 504 });
        }
      })
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('./bible-promises.html');
      }
    })
  );
});
