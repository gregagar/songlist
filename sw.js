const CACHE_NAME = "song-finder-app-v1";

const APP_SHELL = [
  "./",
  "./index.html",
  "./songs.json"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  // Do not interfere with Google Apps Script / CRM requests.
  if (url.origin !== self.location.origin) {
    return;
  }

  // If the app itself is opened/reloaded, try network first,
  // but fall back to cached app shell when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();

          caches.open(CACHE_NAME).then(cache => {
            cache.put("./index.html", copy);
            cache.put("./", response.clone());
          });

          return response;
        })
        .catch(() =>
          caches.match("./index.html")
            .then(cached => cached || caches.match("./"))
        )
    );

    return;
  }

  // songs.json: try to get latest when online,
  // but use cached version when offline.
  if (url.pathname.endsWith("/songs.json")) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();

          caches.open(CACHE_NAME).then(cache => {
            cache.put("./songs.json", copy);
          });

          return response;
        })
        .catch(() => caches.match("./songs.json"))
    );

    return;
  }

  // Other local files: cache first, then network.
  event.respondWith(
    caches.match(request)
      .then(cached => cached || fetch(request))
  );
});
