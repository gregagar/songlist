const CACHE_NAME = "song-finder-app-v2";

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
  );const CACHE_NAME = "song-finder-app-v2";

const APP_SHELL = [
  "./",
  "./index.html",
  "./songs.json"
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

  if(request.method !== "GET"){
    return;
  }

  const url = new URL(request.url);

  // Do not interfere with Google Apps Script / CRM requests.
  if(url.origin !== self.location.origin){
    return;
  }

  // Main app page: cache first.
  // This is the crucial XR16 fix.
  if(request.mode === "navigate"){
    event.respondWith(handleNavigation(request));
    return;
  }

  // songs.json: keep your reload-main-json behaviour working,
  // but still fall back to cache if the network hangs.
  if(url.pathname.endsWith("/songs.json")){
    event.respondWith(handleSongsJson(request));
    return;
  }

  // Other local files: cache first.
  event.respondWith(handleCacheFirst(request));
});

async function handleNavigation(request){
  const cache = await caches.open(CACHE_NAME);
  const url = new URL(request.url);

  const cached =
    await cache.match("./index.html") ||
    await cache.match("./") ||
    await cache.match(request, { ignoreSearch:true });

  const isManualAppReload =
    url.searchParams.has("appReload");

  // Normal use: return the cached app immediately.
  // Manual Reload App can still try the network first.
  if(cached && !isManualAppReload){
    updateNavigationInBackground(request);
    return cached;
  }

  try{
    const response =
      await fetchWithTimeout(request, NETWORK_TIMEOUT_MS);

    if(response && response.ok){
      const copy1 = response.clone();
      const copy2 = response.clone();

      await cache.put("./index.html", copy1);
      await cache.put("./", copy2);
    }

    return response;

  }catch(err){

    if(cached){
      return cached;
    }

    return new Response(
      "Song Finder is offline and no cached app was found. Open it once with internet.",
      {
        status:503,
        headers:{
          "Content-Type":"text/plain"
        }
      }
    );
  }
}

async function handleSongsJson(request){
  const cache = await caches.open(CACHE_NAME);
  const url = new URL(request.url);

  const cached =
    await cache.match("./songs.json") ||
    await cache.match(request, { ignoreSearch:true });

  const wantsFresh =
    url.searchParams.has("cacheBust");

  // Normal songs.json requests: use cache immediately.
  if(cached && !wantsFresh){
    updateSongsInBackground(request);
    return cached;
  }

  // Your Reload Main JSON button uses cacheBust, so let that try the network,
  // but don't let it hang forever on the XR16 router.
  try{
    const response =
      await fetchWithTimeout(request, NETWORK_TIMEOUT_MS);

    if(response && response.ok){
      await cache.put("./songs.json", response.clone());
    }

    return response;

  }catch(err){

    if(cached){
      return cached;
    }

    return new Response("[]", {
      status:200,
      headers:{
        "Content-Type":"application/json"
      }
    });
  }
}

async function handleCacheFirst(request){
  const cache = await caches.open(CACHE_NAME);

  const cached =
    await cache.match(request, { ignoreSearch:true });

  if(cached){
    return cached;
  }

  try{
    const response =
      await fetchWithTimeout(request, NETWORK_TIMEOUT_MS);

    if(response && response.ok){
      await cache.put(request, response.clone());
    }

    return response;

  }catch(err){
    return new Response("", { status:504 });
  }
}

function fetchWithTimeout(request, timeoutMs){
  return Promise.race([
    fetch(request),
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error("Network timed out"));
      }, timeoutMs);
    })
  ]);
}

async function updateNavigationInBackground(request){
  try{
    const cache = await caches.open(CACHE_NAME);
    const response = await fetch(request);

    if(response && response.ok){
      const copy1 = response.clone();
      const copy2 = response.clone();

      await cache.put("./index.html", copy1);
      await cache.put("./", copy2);
    }
  }catch(err){
    // Ignore failed background updates.
  }
}

async function updateSongsInBackground(request){
  try{
    const cache = await caches.open(CACHE_NAME);
    const response = await fetch(request);

    if(response && response.ok){
      await cache.put("./songs.json", response.clone());
    }
  }catch(err){
    // Ignore failed background updates.
  }
}
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
