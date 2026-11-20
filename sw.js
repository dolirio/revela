// Revela: funciona sem internet. Rede primeiro (a versão nova chega na hora), cache quando estiver sem rede.
// Mude a versão a cada publicação.
const CACHE = 'revela-49a';
const BASE = ['./', 'index.html', 'app.js', 'render.js', 'manifest.webmanifest', 'icone.svg', 'icone-192.png', 'icone-512.png',
  'core.js', 'icons.js', 'vendor/libheif-bundle.mjs', 'filmes/indice.json'];
self.addEventListener('install', (e) => e.waitUntil((async () => {
  const c = await caches.open(CACHE);
  await c.addAll(BASE.map((f) => new Request(f, { cache: 'reload' })));
  const ids = await (await fetch('filmes/indice.json', { cache: 'reload' })).json();
  await c.addAll(ids.flatMap((id) => [`filmes/${id}.json`, `filmes/${id}.bin`]).map((f) => new Request(f, { cache: 'reload' })));
  await self.skipWaiting();
})()));
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  // apaga os caches das versões anteriores (inclusive o do app antigo que ficava na raiz); o do Clássico fica
  for (const k of await caches.keys()) if (k !== CACHE && !k.startsWith('revela-classico')) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith((async () => {
    try {
      const r = await fetch(e.request);
      if (r.ok && new URL(e.request.url).origin === location.origin) (await caches.open(CACHE)).put(e.request, r.clone());
      return r;
    } catch { return (await caches.match(e.request, { ignoreSearch: true })) || Response.error(); }
  })());
});
