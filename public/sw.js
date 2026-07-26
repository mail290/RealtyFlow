/* =====================================================================
 * Care inspection app — offline shell service worker.
 * ---------------------------------------------------------------------
 * The Fase 2 brief names Serwist; that assumes a Next.js/App-Router build
 * pipeline. This app is an importmap-based Vite SPA loading modules from
 * esm.sh, so a hand-written worker is the equivalent: precache the shell,
 * runtime-cache the esm.sh module graph (stale-while-revalidate) so a
 * second load works with no network. We deliberately do NOT cache API or
 * Supabase responses.
 * ===================================================================== */
const CACHE = 'care-shell-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

function isModuleHost(url) {
  return url.hostname.endsWith('esm.sh') || url.hostname.endsWith('fonts.gstatic.com');
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // never cache mutations / Supabase writes

  const url = new URL(req.url);

  // Never touch the Supabase / storage API — those must hit the network.
  if (url.pathname.includes('/rest/v1/') || url.pathname.includes('/storage/v1/') || url.pathname.includes('/auth/v1/')) {
    return;
  }

  // App navigations → network first, fall back to the cached shell offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('/index.html').then((r) => r || caches.match('/'))),
    );
    return;
  }

  // Same-origin assets + esm.sh modules + fonts → stale-while-revalidate.
  if (url.origin === self.location.origin || isModuleHost(url)) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res && res.status === 200) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
  }
});
