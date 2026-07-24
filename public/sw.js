const CACHE = "finanzas-shell-v3";
const APP_HOME = new URL("dashboard/", self.registration.scope).toString();

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.add(APP_HOME))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok) {
            await caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) ?? caches.match(APP_HOME)),
    );
    return;
  }

  if (!["style", "script", "font", "image"].includes(request.destination)) return;

  const network = fetch(request).then(async (response) => {
    if (response.ok) {
      await caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
    }
    return response;
  });

  event.waitUntil(network.then(() => undefined).catch(() => undefined));
  event.respondWith(
    caches.match(request).then((cached) => cached ?? network),
  );
});
