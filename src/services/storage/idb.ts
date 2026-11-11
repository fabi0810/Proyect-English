/** Envoltorio mínimo de IndexedDB: almacenes "kv" (slices) y "archives" (cursos archivados). */

const DB_NAME = 'english-learning-platform';
const DB_VERSION = 1;
export const KV_STORE = 'kv';
export const ARCHIVE_STORE = 'archives';

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB no disponible'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(KV_STORE)) db.createObjectStore(KV_STORE);
      if (!db.objectStoreNames.contains(ARCHIVE_STORE)) db.createObjectStore(ARCHIVE_STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('No se pudo abrir IndexedDB'));
    req.onblocked = () => reject(new Error('IndexedDB bloqueada por otra pestaña'));
  });
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transacción abortada'));
  });
}

export async function kvGetAll(): Promise<Record<string, unknown>> {
  const db = await openDatabase();
  const tx = db.transaction(KV_STORE, 'readonly');
  const store = tx.objectStore(KV_STORE);
  const [keys, values] = await Promise.all([promisify(store.getAllKeys()), promisify(store.getAll())]);
  const out: Record<string, unknown> = {};
  keys.forEach((k, i) => {
    out[String(k)] = values[i];
  });
  return out;
}

export async function kvPutMany(entries: [string, unknown][]): Promise<void> {
  if (!entries.length) return;
  const db = await openDatabase();
  const tx = db.transaction(KV_STORE, 'readwrite');
  const store = tx.objectStore(KV_STORE);
  for (const [k, v] of entries) store.put(v, k);
  await txDone(tx);
}

export async function kvClear(): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(KV_STORE, 'readwrite');
  tx.objectStore(KV_STORE).clear();
  await txDone(tx);
}

export async function archivesGetAll<T>(): Promise<T[]> {
  const db = await openDatabase();
  const tx = db.transaction(ARCHIVE_STORE, 'readonly');
  return promisify(tx.objectStore(ARCHIVE_STORE).getAll()) as Promise<T[]>;
}

export async function archivesPut(value: unknown): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(ARCHIVE_STORE, 'readwrite');
  tx.objectStore(ARCHIVE_STORE).put(value);
  await txDone(tx);
}

export async function archivesDelete(id: string): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(ARCHIVE_STORE, 'readwrite');
  tx.objectStore(ARCHIVE_STORE).delete(id);
  await txDone(tx);
}
