/**
 * Adaptadores de almacenamiento: IndexedDB → localStorage → memoria.
 * Cada slice de UserData se guarda como un registro independiente.
 */
import type { ArchivedCourse } from '../../types/progress';
import { archivesDelete, archivesGetAll, archivesPut, kvClear, kvGetAll, kvPutMany, openDatabase } from './idb';

export type StorageKind = 'indexeddb' | 'localstorage' | 'memory';

export interface StorageAdapter {
  kind: StorageKind;
  loadAll(): Promise<Record<string, unknown>>;
  save(entries: [string, unknown][]): Promise<void>;
  clear(): Promise<void>;
  getArchives(): Promise<ArchivedCourse[]>;
  putArchive(a: ArchivedCourse): Promise<void>;
  deleteArchive(id: string): Promise<void>;
}

const LS_PREFIX = 'elp:slice:';
const LS_ARCHIVES = 'elp:archives';

const idbAdapter: StorageAdapter = {
  kind: 'indexeddb',
  loadAll: kvGetAll,
  save: kvPutMany,
  clear: kvClear,
  getArchives: () => archivesGetAll<ArchivedCourse>(),
  putArchive: archivesPut,
  deleteArchive: archivesDelete,
};

function lsReadArchives(): ArchivedCourse[] {
  try {
    return JSON.parse(localStorage.getItem(LS_ARCHIVES) ?? '[]') as ArchivedCourse[];
  } catch {
    return [];
  }
}

const lsAdapter: StorageAdapter = {
  kind: 'localstorage',
  async loadAll() {
    const out: Record<string, unknown> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(LS_PREFIX)) continue;
      try {
        out[k.slice(LS_PREFIX.length)] = JSON.parse(localStorage.getItem(k) ?? 'null');
      } catch {
        /* slice corrupto: se ignora */
      }
    }
    return out;
  },
  async save(entries) {
    for (const [k, v] of entries) localStorage.setItem(LS_PREFIX + k, JSON.stringify(v));
  },
  async clear() {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(LS_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  },
  async getArchives() {
    return lsReadArchives();
  },
  async putArchive(a) {
    const list = lsReadArchives().filter((x) => x.id !== a.id);
    localStorage.setItem(LS_ARCHIVES, JSON.stringify([...list, a]));
  },
  async deleteArchive(id) {
    localStorage.setItem(LS_ARCHIVES, JSON.stringify(lsReadArchives().filter((x) => x.id !== id)));
  },
};

export function createMemoryAdapter(): StorageAdapter {
  const kv = new Map<string, unknown>();
  const archives = new Map<string, ArchivedCourse>();
  return {
    kind: 'memory',
    async loadAll() {
      return Object.fromEntries(kv);
    },
    async save(entries) {
      for (const [k, v] of entries) kv.set(k, structuredClone(v));
    },
    async clear() {
      kv.clear();
    },
    async getArchives() {
      return Array.from(archives.values());
    },
    async putArchive(a) {
      archives.set(a.id, a);
    },
    async deleteArchive(id) {
      archives.delete(id);
    },
  };
}

export async function createStorage(): Promise<StorageAdapter> {
  try {
    await openDatabase();
    await kvGetAll();
    return idbAdapter;
  } catch {
    /* sigue con localStorage */
  }
  try {
    const probe = '__elp_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return lsAdapter;
  } catch {
    return createMemoryAdapter();
  }
}
