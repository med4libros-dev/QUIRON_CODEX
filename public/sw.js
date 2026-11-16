/**
 * Service worker de Quirón Codex.
 *
 * Solo sirve para que la app abra sin conexión y se pueda instalar en Edge. No toca tus datos:
 * todo lo tuyo (PDFs, tinta, notas) vive en IndexedDB, que el navegador maneja aparte.
 *
 * Estrategia: la red primero y la caché como respaldo. Así una versión nueva entra en cuanto
 * hay internet y nunca te quedas con la de ayer; sin internet, se abre lo último que se vio.
 * Las peticiones a las APIs de IA nunca se cachean ni se interceptan.
 */
const CACHE = 'quiron-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // APIs de IA y todo lo de fuera: sin tocar
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          void caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((hit) => hit ?? (req.mode === 'navigate' ? caches.match('/index.html') : undefined) ?? Response.error()),
      ),
  );
});
