self.addEventListener('install', function() { self.skipWaiting(); });
self.addEventListener('activate', function() {});
self.addEventListener('fetch', function(e) {
  // Solo interceptamos peticiones de nuestro propio dominio.
  // Las externas (Overpass, CIMA, etc.) pasan directo a la red sin pasar por el Service Worker,
  // así un fallo externo no genera errores "Uncaught (in promise)" en consola.
  if (new URL(e.request.url).origin !== self.location.origin) return;

  e.respondWith(
    fetch(e.request).catch(function() {
      return new Response('', { status: 503, statusText: 'Sin conexión' });
    })
  );
});