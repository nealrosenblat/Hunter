// Offline support. Network first (so you always get the newest version when online),
// falling back to the cached copy when there's no connection.
const CACHE = 'hammer-delgado-v3';
const CORE = [
  './', 'index.html', 'style.css', 'manifest.webmanifest', 'vendor/three.module.min.js',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'src/main.js', 'src/input.js', 'src/audio.js', 'src/ui.js', 'src/touch.js', 'src/stats.js', 'src/scene.js',
  'src/util.js', 'src/textures.js', 'src/models.js', 'src/env.js', 'src/fx.js', 'src/save.js', 'src/nozoom.js',
  'src/scenes/title.js', 'src/scenes/credits.js', 'src/scenes/office.js', 'src/scenes/chase.js',
  'src/scenes/warehouse.js', 'src/scenes/ending.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await Promise.race([
        fetch(req),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000)),
      ]);
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    } catch (err) {
      const hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
      if (hit) return hit;
      if (req.mode === 'navigate') return cache.match('index.html');
      throw err;
    }
  })());
});
