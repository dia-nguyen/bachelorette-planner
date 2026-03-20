const CACHE_PREFIX = "bp-pwa-v3";
const STATIC_CACHE = `${CACHE_PREFIX}-static`;
const RUNTIME_CACHE = `${CACHE_PREFIX}-runtime`;
const API_CACHE = `${CACHE_PREFIX}-api`;

const PRECACHE_URLS = [
  "/",
  "/offline.html",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/favicon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await Promise.allSettled(
        PRECACHE_URLS.map(async (url) => {
          try {
            const response = await fetch(new Request(url, { cache: "reload" }));
            if (response.ok) {
              await cache.put(url, response.clone());
            }
          } catch {
            // Ignore precache misses; runtime cache will fill when online.
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const expectedCaches = new Set([STATIC_CACHE, RUNTIME_CACHE, API_CACHE]);
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => !expectedCaches.has(key))
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function canCache(response) {
  return response && (response.ok || response.type === "opaque");
}

function isRedirectLike(response) {
  if (!response) return true;
  if (response.type === "opaqueredirect") return true;
  return response.status >= 300 && response.status < 400;
}

function isLoginDocumentForDifferentPath(requestUrl, response) {
  try {
    const requestPath = new URL(requestUrl).pathname;
    const responsePath = response.url ? new URL(response.url).pathname : "";
    return requestPath !== "/login" && responsePath === "/login";
  } catch {
    return false;
  }
}

function isUsableNavigationResponse(requestUrl, response) {
  if (!response) return false;
  if (isRedirectLike(response)) return false;
  if (isLoginDocumentForDifferentPath(requestUrl, response)) return false;
  return true;
}

function htmlOfflineFallbackResponse() {
  return new Response(
    "<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>Offline</title></head><body style='font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f8f1f6;color:#3f0a25;display:grid;place-items:center;min-height:100vh;margin:0'><main style='background:#fff;border-radius:16px;padding:20px;max-width:28rem;box-shadow:0 10px 28px rgba(63,10,37,.12)'><h1 style='margin:0 0 .5rem;font-size:1.3rem'>You're offline</h1><p style='margin:0;line-height:1.45'>Reconnect to load this page. Previously visited pages should still work offline.</p></main></body></html>",
    {
      status: 503,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    },
  );
}

async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);
    if (canCache(response)) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;

    if (fallbackUrl) {
      const fallback = await caches.match(fallbackUrl);
      if (fallback) return fallback;
    }

    return new Response("Offline", {
      status: 503,
      headers: { "Content-Type": "text/plain" },
    });
  }
}

async function navigationNetworkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const url = new URL(request.url);
  const pathKey = `${url.origin}${url.pathname}`;

  try {
    const response = await fetch(request, { redirect: "follow" });
    if (canCache(response) && isUsableNavigationResponse(request.url, response)) {
      try {
        await cache.put(request, response.clone());
      } catch {
        // Ignore cache put errors and still return network response.
      }
      try {
        await cache.put(pathKey, response.clone());
      } catch {
        // Ignore cache put errors and still return network response.
      }
    }
    return response;
  } catch {
    const exact = await cache.match(request, {
      ignoreSearch: true,
      ignoreVary: true,
    });
    if (isUsableNavigationResponse(request.url, exact)) return exact;

    const byPath = await cache.match(pathKey, {
      ignoreSearch: true,
      ignoreVary: true,
    });
    if (isUsableNavigationResponse(request.url, byPath)) return byPath;

    const appShell = await caches.match("/", {
      ignoreSearch: true,
      ignoreVary: true,
    });
    if (isUsableNavigationResponse(request.url, appShell)) return appShell;

    const fallback = await caches.match("/offline.html");
    if (fallback) return fallback;

    return htmlOfflineFallbackResponse();
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const revalidate = fetch(request)
    .then(async (response) => {
      if (canCache(response)) {
        await cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    void revalidate;
    return cached;
  }

  const fresh = await revalidate;
  if (fresh) return fresh;

  return new Response("Offline", {
    status: 503,
    headers: { "Content-Type": "text/plain" },
  });
}

self.addEventListener("fetch", (event) => {
  const respondSafely = (handler) =>
    (async () => {
      try {
        return await handler();
      } catch {
        const fallback = await caches.match("/offline.html");
        if (fallback) return fallback;
        return htmlOfflineFallbackResponse();
      }
    })();

  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(respondSafely(() => navigationNetworkFirst(request)));
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(respondSafely(() => networkFirst(request, API_CACHE)));
    return;
  }

  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/_next/image") ||
    /\.(?:js|css|png|jpg|jpeg|gif|svg|webp|ico|woff2?)$/i.test(url.pathname);

  if (isStaticAsset) {
    event.respondWith(respondSafely(() => staleWhileRevalidate(request, STATIC_CACHE)));
  }
});
