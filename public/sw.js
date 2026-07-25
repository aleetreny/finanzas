const CACHE = "finanzas-shell-v6";
const CORE_ROUTES = [
  "",
  "dashboard/",
  "movimientos/",
  "movimientos/nuevo/",
  "recurrentes/",
  "viajes/",
  "piso-malaga/",
  "importar-exportar/",
  "ajustes/",
  "instalar/",
].map((path) => new URL(path, self.registration.scope).toString());

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.allSettled(
        CORE_ROUTES.map(async (url) => {
          const response = await fetch(new Request(url, { cache: "reload" }));
          if (response.ok) await cache.put(url, response);
        }),
      ))
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
        // Nunca devolvemos el HTML del resumen para otra URL: hidratar una
        // página distinta bajo /movimientos/ acaba en un 404 dentro de la app.
        .catch(async () =>
          (await caches.match(request, { ignoreSearch: true })) ?? Response.error()
        ),
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
