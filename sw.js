/* =========================================================
   Service Worker für DEC Inzell Material Manager
   - Speichert App-Dateien für Offline-Nutzung
   - Beim App-Update bitte CACHE_VERSION hochzählen
   ========================================================= */
const CACHE_VERSION = 'dec-inzell-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './apple-touch-icon-120.png',
  './apple-touch-icon-152.png',
  './apple-touch-icon-167.png'
];

// Externe Firebase-URLs werden NICHT gecacht (Live-Sync erfordert Online-Verbindung)
const FIREBASE_HOSTS = ['gstatic.com', 'googleapis.com', 'firebaseio.com', 'firebase.com'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Firebase/Google — immer live, keine Cache-Logik
  if (FIREBASE_HOSTS.some((h) => url.hostname.includes(h))) {
    return; // Browser behandelt die Anfrage normal
  }

  // Navigationsanfragen (HTML-Dokumente) — Network First, dann Cache, dann index.html
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          const clone = resp.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, clone));
          return resp;
        })
        .catch(() =>
          caches.match(req).then((hit) => hit || caches.match('./index.html'))
        )
    );
    return;
  }

  // Statische Assets — Cache First, dann Network
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((resp) => {
        // Nur erfolgreiche Same-Origin-Antworten cachen
        if (resp.ok && url.origin === self.location.origin) {
          const clone = resp.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, clone));
        }
        return resp;
      }).catch(() => hit);
    })
  );
});
