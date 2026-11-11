// Cache do app para funcionar offline. Mude a versão ao atualizar arquivos.
const CACHE = 'revela-v15';
const FILES = ['./', 'index.html', 'app.js', 'looks.js', 'looks-data.js', 'renderer.js', 'core.js', 'icons.js', 'recipes.js', 'films.js', 'film-looks.js', 'vendor/libheif-bundle.mjs', 'lab.html', 'lab.js', 'manifest.webmanifest', 'icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png'];
// cache: 'reload' / 'no-cache' passam por cima do cache HTTP do navegador, para a versão nova chegar na primeira abertura
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const same = new URL(e.request.url).origin === location.origin;
  e.respondWith(fetch(same ? new Request(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }) : e.request).then((r) => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request)));
});
