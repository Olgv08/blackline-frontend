// Service Worker de Black Line Studio — maneja las notificaciones push.
// Este archivo se sirve tal cual desde /sw.js (raíz del sitio), por eso vive
// en /public y no pasa por el bundler de Vite.

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
  event.waitUntil(self.clients.claim());
});
