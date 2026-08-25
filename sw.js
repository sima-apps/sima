// Service worker untuk shell PWA "SIMA".
// Hanya meng-cache file shell milik halaman login ini (index.html, css, js,
// manifest, ikon). Panggilan ke Apps Script Master (fetch POST ke /exec)
// TIDAK di-cache di sini dan tetap membutuhkan koneksi internet seperti biasa.

const CACHE_NAME = 'sima-shell-v1';
const SHELL_FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './config.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Hanya tangani GET same-origin untuk file shell. Semua request lain
  // (terutama POST fetch ke Apps Script Master) dibiarkan lewat langsung
  // ke jaringan, tanpa campur tangan service worker ini.
  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isShellPath = SHELL_FILES.some((f) => req.url.endsWith(f.replace('./', '')));

  if (req.method !== 'GET' || !isSameOrigin || !isShellPath) {
    return; // pass-through
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          caches.open(CACHE_NAME).then((cache) => cache.put(req, res.clone()));
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
