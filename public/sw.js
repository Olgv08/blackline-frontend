// Service Worker de Black Line Studio — maneja las notificaciones push Y el
// cacheo de la app para que funcione sin conexión (modo offline).
// Este archivo se sirve tal cual desde /sw.js (raíz del sitio), por eso vive
// en /public y no pasa por el bundler de Vite.

const RUNTIME_CACHE = "blackline-runtime-v1";

self.addEventListener("push", (event) => {
  let data = { title: "Black Line Studio", body: "Tienes una notificación nueva", url: "/citas" };

  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch (err) {
    // Si el payload no viene en JSON, se usa el mensaje por default de arriba.
  }

  const options = {
    body: data.body,
    icon: "/icons.svg",
    badge: "/icons.svg",
    data: { url: data.url || "/citas" },
    vibrate: [120, 60, 120],
    tag: "cita-recordatorio",
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Al tocar la notificación, abre (o enfoca) la app en la pantalla de citas.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/citas";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      const existing = clientsArr.find((c) => c.url.includes(self.location.origin));
      if (existing) {
        existing.focus();
        existing.navigate(targetUrl);
        return;
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("blackline-runtime-") && k !== RUNTIME_CACHE)
            .map((k) => caches.delete(k))
        )
      ),
    ])
  );
});

// Estrategia "red primero, caché de respaldo": mientras hay internet, siempre
// se usa la versión más nueva (y se guarda copia). Sin internet, se sirve lo
// último que sí cargó. Las llamadas a la API (/api/...) NO se tocan aquí —
// esas las maneja la capa offline de la propia app (src/offline), que sabe
// guardar cambios y sincronizarlos cuando vuelve la conexión.
self.addEventListener("fetch", (event) => {
  const req = event.request;

  if (req.method !== "GET") return;
  if (!req.url.startsWith(self.location.origin)) return;
  if (req.url.includes("/api/")) return;

  event.respondWith(
    caches.open(RUNTIME_CACHE).then(async (cache) => {
      try {
        const networkResponse = await fetch(req);
        if (networkResponse && networkResponse.ok) {
          cache.put(req, networkResponse.clone());
        }
        return networkResponse;
      } catch (err) {
        const cached = await cache.match(req);
        if (cached) return cached;

        // Si es una navegación (el usuario abrió la app / recargó una ruta
        // como /dashboard) y no hay nada en caché para esa URL exacta,
        // regresamos el shell de la app para que React Router tome el control.
        if (req.mode === "navigate") {
          const shell = await cache.match("/index.html");
          if (shell) return shell;
        }

        throw err;
      }
    })
  );
});
