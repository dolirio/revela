// O Revela saiu de /novo/ e foi para o endereço principal. Este service worker só desliga o antigo:
// apaga o cache de /novo/, se desregistra e leva as janelas abertas para o endereço novo.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('revela-novo-')) await caches.delete(k);
  await self.registration.unregister();
  for (const c of await self.clients.matchAll({ type: 'window' })) c.navigate(new URL('../', self.registration.scope).href);
})()));
