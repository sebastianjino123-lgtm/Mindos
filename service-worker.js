const CACHE_NAME = "mindos-v2"; // bumped — forces old cache to be discarded
const ASSETS = [
  "./",
  "./index.html",
  "./app.jsx",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
];

// Install: pre-cache the app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting(); // activate new SW immediately, don't wait for old tabs to close
});

// Activate: clean up old caches from previous versions
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim(); // take control of open tabs immediately
});

// Fetch strategy:
// - App shell (index.html, app.jsx, manifest, icons): NETWORK-FIRST.
//   Always try to get the latest version from the server first.
//   Only fall back to the cached copy if the network request fails (offline).
//   This means updates you push to GitHub show up on next load automatically —
//   no manual cache-clearing needed.
// - CDN libraries (React, Babel from jsdelivr/unpkg): CACHE-FIRST.
//   These rarely change and loading them fresh every time would be slow
//   and waste data, so we keep serving the cached version once downloaded.
self.addEventListener("fetch", (event) => {
  const url = event.request.url;
  const isAppShell = ASSETS.some((a) => url.endsWith(a.replace("./", "")));

  if (isAppShell) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
          return res;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
  } else {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
          return res;
        }).catch(() => cached);
      })
    );
  }
});
