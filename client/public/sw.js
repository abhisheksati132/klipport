const CACHE_NAME = "klipport-cache-v4";
const PRECACHE_ASSETS = [
  "/",
  "/index.html",
  "/logo.svg",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png"
];

// Install Event - Precache critical assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
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
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event - Network-first with cache fallback (fresh deploys win; offline still works)
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
    fetch(event.request)
      .then((response) => {
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
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;

          // Serve React SPA index.html on offline navigations
          if (event.request.mode === "navigate") {
            return caches.match("/index.html");
          }
        });
      })
  );
});

// Message Event - Skip waiting when requested
self.addEventListener("message", (event) => {
  if (event.data && event.data.action === "skipWaiting") {
    self.skipWaiting();
  }
});
