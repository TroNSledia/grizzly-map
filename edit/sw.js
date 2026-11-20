/* Service worker: сеть без HTTP-кэша, чтобы телефон не оставлял старые вкладки языков. */
const CACHE = "grizzly-edit-pages-v22";
const BUILD = "22";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(Promise.resolve());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
    await self.clients.claim();
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    await Promise.all(windows.map((client) => {
      try {
        const url = new URL(client.url);
        if (url.searchParams.get("b") === BUILD) return null;
        url.searchParams.set("b", BUILD);
        return client.navigate(url.toString());
      } catch (e) {
        return null;
      }
    }));
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetch(req, { cache: "no-store" });
      if (res && res.ok) {
        try { await cache.put(req, res.clone()); } catch (err) {}
      }
      return res;
    } catch (e) {
      const hit = await cache.match(req);
      if (hit) return hit;
      if (req.mode === "navigate") {
        const shell = await cache.match("./index.html");
        if (shell) return shell;
      }
      throw e;
    }
  })());
});
