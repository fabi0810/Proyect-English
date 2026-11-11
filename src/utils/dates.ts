export const DAY_MS = 86_400_000;

export function nowIso(): string {
  return new Date().toISOString();
}

/** Clave local AAAA-MM-DD (zona horaria del usuario). */
export function dayKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function startOfDay(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

const dateFmt = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function formatDate(iso?: string): string {
  if (!iso) return '—';
  return dateFmt.format(new Date(iso));
}

export function formatDateTime(iso?: string): string {
  if (!iso) return '—';
  return dateTimeFmt.format(new Date(iso));
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return `${m} min`;
  return `${s} s`;
}

export function relativeDay(iso: string): string {
  const diff = Math.round((startOfDay(new Date()).getTime() - startOfDay(new Date(iso)).getTime()) / DAY_MS);
  if (diff <= 0) return 'hoy';
  if (diff === 1) return 'ayer';
  if (diff < 7) return `hace ${diff} días`;
  return formatDate(iso);
}

/** Últimos n días (incluido hoy) como claves AAAA-MM-DD, del más antiguo al más reciente. */
export function lastDays(n: number, from: Date = new Date()): string[] {
  return Array.from({ length: n }, (_, i) => dayKey(addDays(startOfDay(from), i - (n - 1))));
}
