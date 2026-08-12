import type { AxiosInstance, AxiosError, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { matchEntity, extractId, type EntityConfig } from "./entities";
import {
  getCachedList,
  saveToCache,
  upsertOneInCache,
  removeFromCache,
  enqueueMutation,
  getQueue,
  removeFromQueue,
  updateQueueEntry,
} from "./db";

function genTempId() {
  return "temp_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function isNetworkFailure(error: any) {
  return !error.response && (error.request || error.isOfflineShortCircuit);
}

function parseBody(data: any) {
  if (!data) return {};
  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch {
      return {};
    }
  }
  return data;
}

function fakeResponse(config: any, data: any, status: number): AxiosResponse {
  return {
    data,
    status,
    statusText: "OK (offline)",
    headers: {},
    config,
    request: {},
  } as AxiosResponse;
}

async function mergeIntoPendingCreate(entity: string, tempId: string, patch: any) {
  const queue = await getQueue();
  const pending = queue.find((m) => m.entity === entity && m.type === "create" && m.tempId === tempId);
  if (pending && pending.id !== undefined) {
    await updateQueueEntry(pending.id, { body: { ...pending.body, ...patch } });
  }
}

async function dropPendingCreate(entity: string, tempId: string) {
  const queue = await getQueue();
  const pending = queue.find((m) => m.entity === entity && m.type === "create" && m.tempId === tempId);
  if (pending && pending.id !== undefined) {
    await removeFromQueue(pending.id);
  }
}

async function handleOfflineGet(cfg: EntityConfig, config: any) {
  const items = await getCachedList(cfg.plural);
  return fakeResponse(config, { [cfg.plural]: items }, 200);
}

async function handleOfflineCreate(cfg: EntityConfig, config: any) {
  const body = parseBody(config.data);
  const tempId = genTempId();
  const now = new Date().toISOString();
  const fakeRecord = { ...body, _id: tempId, createdAt: now, updatedAt: now, _pendingSync: true };

  await upsertOneInCache(cfg.plural, fakeRecord);
  await enqueueMutation({ entity: cfg.plural, type: "create", endpoint: config.url, tempId, body });

  return fakeResponse(config, { [cfg.singular]: fakeRecord }, 201);
}

async function handleOfflineUpdate(cfg: EntityConfig, config: any) {
  const id = extractId(config.url, cfg.base);
  if (!id) throw new Error("No se pudo determinar el id a actualizar");

  const body = parseBody(config.data);
  const items = await getCachedList(cfg.plural);
  const existing = items.find((it) => it._id === id) || {};
  const merged = { ...existing, ...body, _id: id, updatedAt: new Date().toISOString(), _pendingSync: true };

  await upsertOneInCache(cfg.plural, merged);

  if (id.startsWith("temp_")) {
    await mergeIntoPendingCreate(cfg.plural, id, body);
  } else {
    await enqueueMutation({ entity: cfg.plural, type: "update", endpoint: config.url, realId: id, body });
  }

  return fakeResponse(config, { [cfg.singular]: merged }, 200);
}

async function handleOfflineDelete(cfg: EntityConfig, config: any) {
  const id = extractId(config.url, cfg.base);
  if (!id) throw new Error("No se pudo determinar el id a borrar");

  await removeFromCache(cfg.plural, id);

  if (id.startsWith("temp_")) {
    await dropPendingCreate(cfg.plural, id);
  } else {
    await enqueueMutation({ entity: cfg.plural, type: "delete", endpoint: config.url, realId: id });
  }

  return fakeResponse(config, { ok: true }, 200);
}

export function attachOfflineLayer(api: AxiosInstance) {
  // Si ya sabemos que no hay internet, cortamos la petición de inmediato en
  // vez de esperar a que truene por timeout (respuesta instantánea).
  api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    if (!navigator.onLine) {
      const err: any = new Error("OFFLINE_SHORT_CIRCUIT");
      err.config = config;
      err.isOfflineShortCircuit = true;
      return Promise.reject(err);
    }
    return config;
  });

  api.interceptors.response.use(
    async (response: AxiosResponse) => {
      // Petición exitosa: si es un GET de una entidad soportada, refrescamos
      // el cache local con lo más reciente del servidor.
      const config = response.config;
      if ((config.method || "get").toLowerCase() === "get") {
        const cfg = matchEntity(config.url || "");
        const cleanUrl = (config.url || "").split("?")[0];
        if (cfg && cleanUrl === cfg.base && response.data && Array.isArray((response.data as any)[cfg.plural])) {
          saveToCache(cfg.plural, (response.data as any)[cfg.plural]).catch(() => {});
        }
      }
      return response;
    },
    async (error: AxiosError) => {
      const config: any = error.config;
      if (!config || !config.url) return Promise.reject(error);

      const method = (config.method || "get").toLowerCase();
      const cfg = matchEntity(config.url);
      const offline = !navigator.onLine || isNetworkFailure(error);
      const cleanUrl = config.url.split("?")[0];
      const isExactBase = cfg ? cleanUrl === cfg.base : false;

      // Solo intervenimos si es una falla real de conexión Y es una entidad
      // que soportamos offline. Cualquier otro error (401, 400, 500 real del
      // servidor) se deja pasar tal cual — no queremos esconder errores reales.
      if (!offline || !cfg) {
        return Promise.reject(error);
      }

      try {
        // GET y POST solo se atienden en la ruta exacta de la entidad
        // (/citas, /gastos...), no en subrutas como /gastos/stats/resumen,
        // cuya respuesta tiene una forma totalmente distinta que no podemos
        // fabricar de manera confiable sin conexión.
        if (method === "get" && isExactBase) return await handleOfflineGet(cfg, config);
        if (method === "post" && isExactBase) return await handleOfflineCreate(cfg, config);
        if (method === "put" || method === "patch") return await handleOfflineUpdate(cfg, config);
        if (method === "delete") return await handleOfflineDelete(cfg, config);
      } catch (offlineErr) {
        console.error("Error en la capa offline:", offlineErr);
      }

      return Promise.reject(error);
    }
  );
}
