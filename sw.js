const CACHE_NAME = "song-finder-gigsuite-v5";

const APP_SHELL = [
  "./",
  "./index.html",
  "./songs.json",
  "./manifest.webmanifest",
  "./songfinder-logo.png",
  "./SBlogo.png",
  "./icon-192.png",
  "./icon-512.png"
];

const NETWORK_TIMEOUT_MS = 2500;

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // Do not interfere with Google Apps Script / CRM requests.
  if (url.origin !== self.location.origin) {
    return;
  }

  // Main app page: cache first.
  // Manual Reload App can still request a fresh version.
  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  // Keep the Reload Main JSON behaviour while falling back offline.
  if (url.pathname.endsWith("/songs.json")) {
    event.respondWith(handleSongsJson(request));
    return;
  }

  // Other local files: cache first.
  event.respondWith(handleCacheFirst(request));
});

async function handleNavigation(request) {
  const cache = await caches.open(CACHE_NAME);
  const url = new URL(request.url);

  const cached =
    await cache.match("./index.html") ||
    await cache.match("./") ||
    await cache.match(request, { ignoreSearch: true });

  const isManualAppReload = url.searchParams.has("appReload");

  if (cached && !isManualAppReload) {
    updateNavigationInBackground(request);
    return cached;
  }

  try {
    const response = await fetchWithTimeout(request, NETWORK_TIMEOUT_MS);

    if (response && response.ok) {
      const copy1 = response.clone();
      const copy2 = response.clone();

      await cache.put("./index.html", copy1);
      await cache.put("./", copy2);
    }

    return response;
  } catch (err) {
    if (cached) {
      return cached;
    }

    return new Response(
      "SongFinder is offline and no cached app was found. Open it once with internet.",
      {
        status: 503,
        headers: { "Content-Type": "text/plain" }
      }
    );
  }
}

async function handleSongsJson(request) {
  const cache = await caches.open(CACHE_NAME);
  const url = new URL(request.url);

  const cached =
    await cache.match("./songs.json") ||
    await cache.match(request, { ignoreSearch: true });

  const wantsFresh = url.searchParams.has("cacheBust");

  if (cached && !wantsFresh) {
    updateSongsInBackground(request);
    return cached;
  }

  try {
    const response = await fetchWithTimeout(request, NETWORK_TIMEOUT_MS);

    if (response && response.ok) {
      await cache.put("./songs.json", response.clone());
    }

    return response;
  } catch (err) {
    if (cached) {
      return cached;
    }

    return new Response("[]", {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }
}

async function handleCacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: true });

  if (cached) {
    return cached;
  }

  try {
    const response = await fetchWithTimeout(request, NETWORK_TIMEOUT_MS);

    if (response && response.ok) {
      await cache.put(request, response.clone());
    }

    return response;
  } catch (err) {
    return new Response("", { status: 504 });
  }
}

function fetchWithTimeout(request, timeoutMs) {
  return Promise.race([
    fetch(request),
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error("Network timed out"));
      }, timeoutMs);
    })
  ]);
}

async function updateNavigationInBackground(request) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await fetch(request);

    if (response && response.ok) {
      const copy1 = response.clone();
      const copy2 = response.clone();

      await cache.put("./index.html", copy1);
      await cache.put("./", copy2);
    }
  } catch (err) {
    // Ignore failed background updates.
  }
}

async function updateSongsInBackground(request) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await fetch(request);

    if (response && response.ok) {
      await cache.put("./songs.json", response.clone());
    }
  } catch (err) {
    // Ignore failed background updates.
  }
}
