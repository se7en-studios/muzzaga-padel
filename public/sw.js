/**
 * Service Worker para Muzzaga Pádel
 * Proporciona soporte offline para el catálogo de la cantina, pase digital y herramientas.
 *
 * Las páginas se piden siempre a la red y el caché solo se usa sin conexión:
 * si se sirviera primero lo guardado, después de cada publicación se vería la
 * versión anterior (el panel sin las pestañas nuevas, la carta con precios
 * viejos, fotos reemplazadas). Lo único que se sirve directo del caché son
 * los archivos de /_next/static, que cambian de nombre en cada publicación.
 */

const CACHE_NAME = "muzzaga-cache-v2";
const STATIC_ASSETS = [
  "/",
  "/menu",
  "/torneos",
  "/herramientas/dividir-gastos",
  "/herramientas/nivel",
  "/herramientas/pizarra",
  "/herramientas/americano",
  "/img/logo_badge.png",
  "/img/logo_full.png",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  // Uno por uno: si falla alguno (red inestable), el resto igual se guarda
  // y la versión nueva del service worker se instala igual.
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.allSettled(STATIC_ASSETS.map((path) => cache.add(path)))
      )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

function saveCopy(request, response) {
  if (response && response.status === 200 && response.type === "basic") {
    const clone = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo cachear peticiones GET en el mismo origen
  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  // Peticiones de API y el panel no pasan por el service worker: el panel
  // tiene que estar siempre al día y no se guardan datos del club.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/admin")) {
    return;
  }

  // Archivos con hash en el nombre: nunca cambian, primero el caché.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches
        .match(request)
        .then((cached) => cached || fetch(request).then((res) => saveCopy(request, res)))
    );
    return;
  }

  // Todo lo demás: primero la red; sin conexión, lo último que se guardó.
  event.respondWith(
    fetch(request)
      .then((res) => saveCopy(request, res))
      .catch(() =>
        caches
          .match(request)
          // Sin red y sin copia: fallback básico si es HTML
          .then((cached) => cached || (request.mode === "navigate" && caches.match("/")))
          .then((res) => res || Response.error())
      )
  );
});
