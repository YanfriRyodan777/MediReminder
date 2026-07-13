self.addEventListener('install', function() { self.skipWaiting(); });
self.addEventListener('activate', function() {});
self.addEventListener('fetch', function(e) {
  e.respondWith(fetch(e.request));
});