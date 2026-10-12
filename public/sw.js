const CACHE_NAME = "gcm-aracoiaba-shell-v3";
const APP_BASE = "/aracoiaba-citizen-helper/";
const APP_SHELL = [
  APP_BASE,
  APP_BASE + "manifest.webmanifest",
  APP_BASE + "android-chrome-192x192.png",
  APP_BASE + "gcm-app-icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith("gcm-aracoiaba-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Never intercept API, authentication, cross-origin, or non-GET requests.
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(APP_BASE)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(APP_BASE, copy));
        }
        return response;
      }).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(APP_BASE)) || Response.error();
      })
    );
    return;
  }

  // Network-first prevents stale JavaScript chunks from masking deployments.
  // Cache successful same-origin static responses for offline fallback only.
  if (/\.(?:js|css|png|webp|ico|svg|woff2?|ttf|webmanifest)$/i.test(url.pathname)) {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      }).catch(async () => {
        return (await caches.match(request)) || Response.error();
      })
    );
  }
});
