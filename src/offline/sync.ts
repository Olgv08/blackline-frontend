import { api } from "../api";
import { getQueue, removeFromQueue, replaceTempIdInQueue, removeFromCache, upsertOneInCache } from "./db";

// Pequeño bus de eventos para que cualquier componente se entere del estado
// de la sincronización sin necesidad de Context/Redux.
export const offlineEvents = new EventTarget();

let syncing = false;

export async function getPendingCount(): Promise<number> {
  const queue = await getQueue();
  return queue.length;
}

function notify(type: string, detail?: any) {
  offlineEvents.dispatchEvent(new CustomEvent(type, { detail }));
}

export async function flushQueue(): Promise<{ synced: number; failed: number }> {
  if (syncing) return { synced: 0, failed: 0 };
  if (!navigator.onLine) return { synced: 0, failed: 0 };

  syncing = true;
  notify("sync-start");

  let synced = 0;
  let failed = 0;

  try {
    const queue = await getQueue();
    // Se procesan en el orden en que se crearon, para respetar dependencias
    // (ej. una edición sobre algo que se creó offline debe ir después de esa creación).
    for (const mutation of queue) {
      try {
        if (mutation.type === "create") {
          const { data } = await api.post(mutation.endpoint, mutation.body);
          const wrapperKey = Object.keys(data).find((k) => k !== "ok");
          const realRecord = wrapperKey ? data[wrapperKey] : data;

          if (mutation.tempId && realRecord?._id) {
            await replaceTempIdInQueue(mutation.entity, mutation.tempId, realRecord._id);
            await removeFromCache(mutation.entity, mutation.tempId);
            await upsertOneInCache(mutation.entity, realRecord);
          }
        } else if (mutation.type === "update") {
          const { data } = await api.put(mutation.endpoint, mutation.body);
          const wrapperKey = Object.keys(data).find((k) => k !== "ok");
          const realRecord = wrapperKey ? data[wrapperKey] : data;
          if (realRecord?._id) {
            await upsertOneInCache(mutation.entity, realRecord);
          }
        } else if (mutation.type === "delete") {
          await api.delete(mutation.endpoint);
        }

        if (mutation.id !== undefined) await removeFromQueue(mutation.id);
        synced++;
      } catch (err: any) {
        if (!err.response) {
          // Se cayó la conexión otra vez a media sincronización — paramos
          // aquí, lo que falte se reintenta la próxima vez que haya internet.
          break;
        }
        // El servidor respondió con un error real (ej. datos inválidos).
        // No lo dejamos atorado en la cola para siempre: se descarta y se
        // reporta como fallido para que el usuario lo sepa.
        console.error("No se pudo sincronizar un cambio pendiente:", mutation, err.response?.data);
        if (mutation.id !== undefined) await removeFromQueue(mutation.id);
        failed++;
      }
    }
  } finally {
    syncing = false;
    const pending = await getPendingCount();
    notify("sync-end", { synced, failed });
    notify("pending-changed", { count: pending });
  }

  return { synced, failed };
}

export function initSyncEngine() {
  window.addEventListener("online", () => {
    flushQueue();
  });

  // Respaldo por si el evento 'online' no dispara confiable (pasa en iOS a veces)
  setInterval(() => {
    if (navigator.onLine) flushQueue();
  }, 30000);

  if (navigator.onLine) {
    flushQueue();
  }

  getPendingCount().then((count) => notify("pending-changed", { count }));
}
