// Offline support: app files are network-first (updates show immediately), fonts/flags are cache-first.
const CACHE = 'lingomate-v7';
const SHELL = ['./', 'styles.css', 'app.js', 'data.js', 'coach.js', 'coach-data.js', 'manifest.json', 'icons/icon.svg', 'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png'];
const STATIC_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'flagcdn.com'];

self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
));

const put = (req, res) => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; };
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.pathname.startsWith('/api/')) return; // never cache the live AI/server responses
  if (url.origin === location.origin) {
    e.respondWith(fetch(req).then(res => put(req, res)).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./'))));
  } else if (STATIC_HOSTS.includes(url.hostname)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => put(req, res))));
  }
});
