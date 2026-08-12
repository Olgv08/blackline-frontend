// Capa de almacenamiento local (IndexedDB) para el modo offline.
// Dos "tablas":
//  - records: el último dato conocido de cada entidad (citas, gastos, etc.),
//    para poder mostrarlo aunque no haya internet.
//  - queue: los cambios (crear/editar/borrar) que se hicieron sin conexión y
//    todavía no se le mandaron al servidor.

const DB_NAME = "blackline-offline";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("records")) {
        const store = db.createObjectStore("records", { keyPath: "_localKey" });
        store.createIndex("entity", "entity", { unique: false });
      }
      if (!db.objectStoreNames.contains("queue")) {
        db.createObjectStore("queue", { keyPath: "id", autoIncrement: true });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  return dbPromise;
}

function tx(db: IDBDatabase, store: string, mode: IDBTransactionMode) {
  return db.transaction(store, mode).objectStore(store);
}

// --- Records (cache de lectura por entidad) ---

export async function getCachedList(entity: string): Promise<any[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, "records", "readonly");
    const index = store.index("entity");
    const req = index.getAll(entity);
    req.onsuccess = () => resolve(req.result.map((r) => r.data));
    req.onerror = () => reject(req.error);
  });
}

export async function saveToCache(entity: string, items: any[]): Promise<void> {
  if (!Array.isArray(items) || items.length === 0) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, "records", "readwrite");
    for (const item of items) {
      if (!item || !item._id) continue;
      store.put({ _localKey: `${entity}:${item._id}`, entity, data: item });
    }
    const t = store.transaction;
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function upsertOneInCache(entity: string, item: any): Promise<void> {
  return saveToCache(entity, [item]);
}

export async function removeFromCache(entity: string, id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, "records", "readwrite");
    const req = store.delete(`${entity}:${id}`);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// --- Queue (cambios pendientes de subir) ---

export interface QueuedMutation {
  id?: number;
  entity: string;
  type: "create" | "update" | "delete";
  endpoint: string;
  tempId?: string;
  realId?: string;
  body?: any;
  createdAt: number;
}

export async function enqueueMutation(m: Omit<QueuedMutation, "id" | "createdAt">): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, "queue", "readwrite");
    const req = store.add({ ...m, createdAt: Date.now() });
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

export async function getQueue(): Promise<QueuedMutation[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, "queue", "readonly");
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function removeFromQueue(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, "queue", "readwrite");
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function updateQueueEntry(id: number, patch: Partial<QueuedMutation>): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, "queue", "readwrite");
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const existing = getReq.result;
      if (existing) store.put({ ...existing, ...patch });
    };
    const t = store.transaction;
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

// Cuando una creación (con id temporal) por fin se sincroniza, hay que
// actualizar cualquier otra mutación en cola que todavía apunte al id viejo
// (por ejemplo si editaste dos veces seguidas el mismo registro sin conexión).
export async function replaceTempIdInQueue(entity: string, tempId: string, realId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, "queue", "readwrite");
    const req = store.getAll();
    req.onsuccess = () => {
      const all: QueuedMutation[] = req.result;
      for (const m of all) {
        if (m.entity === entity && m.tempId === tempId) {
          m.endpoint = m.endpoint.replace(tempId, realId);
          m.tempId = realId;
          store.put(m);
        }
      }
    };
    const t = store.transaction;
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}
