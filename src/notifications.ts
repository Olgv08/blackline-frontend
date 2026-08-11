import { api } from "./api";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function pushNotificationsSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.register("/sw.js");
}

export async function getPushSubscriptionStatus(): Promise<"subscribed" | "not-subscribed" | "unsupported"> {
  if (!pushNotificationsSupported()) return "unsupported";
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return "not-subscribed";
  const sub = await registration.pushManager.getSubscription();
  return sub ? "subscribed" : "not-subscribed";
}

export async function subscribeToPush() {
  if (!pushNotificationsSupported()) {
    throw new Error(
      "Este navegador no soporta notificaciones push. En iPhone, agrega la app a tu pantalla de inicio primero (Compartir → Agregar a inicio)."
    );
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("No diste permiso para las notificaciones.");
  }

  const registration = (await navigator.serviceWorker.getRegistration()) || (await registerServiceWorker());
  if (!registration) throw new Error("No se pudo registrar el service worker.");

  const { data } = await api.get("/notificaciones/vapid-public-key");

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(data.publicKey),
  });

  await api.post("/notificaciones/suscribir", subscription.toJSON());
  return subscription;
}

export async function unsubscribeFromPush() {
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return;

  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await api.post("/notificaciones/desuscribir", { endpoint });
}
