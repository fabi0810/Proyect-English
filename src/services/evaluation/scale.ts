/**
 * Escala académica 1.0–5.0 con nivel de exigencia E (porcentaje que equivale a 3.0).
 *   p < E:  nota = 1 + 2·p/E
 *   p ≥ E:  nota = 3 + 2·(p − E)/(1 − E)
 * Se trunca a un decimal para que nadie apruebe "por redondeo".
 * La nota mínima de aprobación P (3.0 por defecto) se compara con la nota:
 * subir P a 3.5 exige más porcentaje (con E = 70 % → 77,5 %).
 */
export const MIN_GRADE = 1.0;
export const MAX_GRADE = 5.0;
export const ANCHOR_GRADE = 3.0;

export function clampExigency(exigency: number): number {
  return Math.min(0.95, Math.max(0.5, exigency));
}

export function computeGrade(percent: number, exigency = 0.7): number {
  const p = Math.min(1, Math.max(0, percent));
  const E = clampExigency(exigency);
  const raw =
    p < E
      ? MIN_GRADE + (ANCHOR_GRADE - MIN_GRADE) * (p / E)
      : ANCHOR_GRADE + (MAX_GRADE - ANCHOR_GRADE) * ((p - E) / (1 - E));
  return Math.floor(raw * 10 + 1e-9) / 10;
}

export function isPassing(grade: number, passGrade = 3.0): boolean {
  return grade + 1e-9 >= passGrade;
}

/** Porcentaje mínimo para alcanzar la nota de aprobación con la exigencia dada. */
export function percentNeeded(passGrade = 3.0, exigency = 0.7): number {
  const E = clampExigency(exigency);
  const P = Math.min(MAX_GRADE, Math.max(MIN_GRADE, passGrade));
  if (P <= ANCHOR_GRADE) return (E * (P - MIN_GRADE)) / (ANCHOR_GRADE - MIN_GRADE);
  return E + ((1 - E) * (P - ANCHOR_GRADE)) / (MAX_GRADE - ANCHOR_GRADE);
}

export function formatGrade(grade?: number): string {
  return grade === undefined ? '—' : grade.toFixed(1);
}

export function gradeTone(grade: number | undefined, passGrade = 3.0): 'success' | 'warning' | 'danger' | 'muted' {
  if (grade === undefined) return 'muted';
  if (!isPassing(grade, passGrade)) return 'danger';
  if (grade >= 4.0) return 'success';
  return 'warning';
}
