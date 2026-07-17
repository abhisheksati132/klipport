const CACHE_NAME = "clipsync-cache-v2";
const PRECACHE_ASSETS = [
  "/",
  "/index.html",
  "/logo.svg",
  "/manifest.json"
];

// Install Event - Precache critical assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Precaching critical assets");
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate Event - Clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log("[Service Worker] Clearing old cache:", cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event - Cache-first with Network-fallback for assets, bypass dynamic APIs
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Bypass caching for dynamic APIs (Supabase database/auth and Socket.io server)
  if (
    url.hostname.includes("supabase.co") ||
    url.port === "5000" ||
    url.pathname.includes("socket.io") ||
    event.request.method !== "GET"
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((response) => {
          // Verify response is valid to cache
          if (!response || response.status !== 200 || response.type !== "basic") {
            return response;
          }

          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return response;
        })
        .catch(() => {
          // Serve React SPA index.html on offline navigations
          if (event.request.mode === "navigate") {
            return caches.match("/index.html");
          }
        });
    })
  );
});
