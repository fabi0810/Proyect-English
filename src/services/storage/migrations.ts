/**
 * Migraciones del esquema de UserData. Cada función transforma la versión N en N+1.
 * También rellena slices ausentes y descarta valores con forma inválida.
 */
import type { UserData } from '../../types/progress';
import { SCHEMA_VERSION } from '../../types/progress';
import { createDefaultUserData, DEFAULT_SETTINGS } from './defaults';

type Raw = Record<string, unknown>;

const MIGRATIONS: Record<number, (d: Raw) => Raw> = {
  // 1: (d) => ({ ...d, nuevoSlice: valor }),  ← ejemplo para la versión 2
};

function isObject(v: unknown): v is Raw {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function migrateUserData(raw: unknown): UserData {
  const base = createDefaultUserData();
  if (!isObject(raw)) return base;
  let data: Raw = { ...raw };
  const meta = isObject(data.meta) ? data.meta : {};
  let version = typeof meta.schemaVersion === 'number' ? meta.schemaVersion : 1;
  if (version > SCHEMA_VERSION) throw new Error(`Los datos son de una versión más reciente de la app (esquema ${version}).`);
  while (version < SCHEMA_VERSION) {
    const fn = MIGRATIONS[version];
    if (fn) data = fn(data);
    version++;
  }

  const out = base as unknown as Raw;
  for (const key of Object.keys(base) as (keyof UserData)[]) {
    const def = (base as unknown as Raw)[key];
    const val = data[key];
    if (val === undefined) continue;
    if (key === 'activeExam') {
      out[key] = isObject(val) ? val : null;
    } else if (Array.isArray(def)) {
      if (Array.isArray(val)) out[key] = val;
    } else if (isObject(def) && isObject(val)) {
      out[key] = key === 'settings' ? { ...DEFAULT_SETTINGS, ...val } : key === 'vocab' ? { ...def, ...val } : key === 'profile' || key === 'meta' ? { ...def, ...val } : val;
    }
  }
  (out.meta as Raw).schemaVersion = SCHEMA_VERSION;
  return out as unknown as UserData;
}
