/** Exportación e importación de copias de seguridad (JSON). */
import type { ArchivedCourse, UserData } from '../../types/progress';
import { SCHEMA_VERSION } from '../../types/progress';
import { dayKey, nowIso } from '../../utils/dates';
import { migrateUserData } from './migrations';

export const BACKUP_APP_ID = 'english-learning-platform';

export interface BackupFile {
  app: string;
  schemaVersion: number;
  exportedAt: string;
  data: UserData;
  archives: ArchivedCourse[];
}

export interface DataSummary {
  lessonsCompleted: number;
  attempts: number;
  modulesPassed: number;
  words: number;
  writings: number;
  readings: number;
  daysActive: number;
}

export function summarizeData(d: UserData): DataSummary {
  return {
    lessonsCompleted: Object.values(d.lessons).filter((l) => l.status === 'completed').length,
    attempts: d.attempts.length,
    modulesPassed: Object.values(d.modules).filter((m) => m.passedAt).length,
    words: Object.keys(d.vocab.cards).length,
    writings: d.writings.length,
    readings: Object.values(d.readings).filter((r) => r.completed).length,
    daysActive: Object.keys(d.activity).length,
  };
}

export function createBackup(data: UserData, archives: ArchivedCourse[]): BackupFile {
  return { app: BACKUP_APP_ID, schemaVersion: SCHEMA_VERSION, exportedAt: nowIso(), data, archives };
}

export function backupFileName(): string {
  return `english-platform-backup-${dayKey()}.json`;
}

export function downloadJson(obj: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function parseBackup(text: string): { data: UserData; archives: ArchivedCourse[]; exportedAt?: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('El archivo no es un JSON válido.');
  }
  if (typeof raw !== 'object' || raw === null) throw new Error('El archivo no tiene el formato esperado.');
  const obj = raw as Partial<BackupFile>;
  if (obj.app !== BACKUP_APP_ID) throw new Error('Este archivo no es una copia de seguridad de English Learning Platform.');
  if (typeof obj.data !== 'object' || obj.data === null) throw new Error('La copia no contiene datos de progreso.');
  const data = migrateUserData(obj.data);
  const archives = Array.isArray(obj.archives)
    ? obj.archives.filter((a): a is ArchivedCourse => typeof a === 'object' && a !== null && typeof (a as ArchivedCourse).id === 'string').map((a) => ({ ...a, data: migrateUserData(a.data) }))
    : [];
  return { data, archives, exportedAt: obj.exportedAt };
}
