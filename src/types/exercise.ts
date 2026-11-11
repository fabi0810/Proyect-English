/* Tipos de ejecución del motor de ejercicios (respuestas y resultados). */

export type Response =
  | { kind: 'choice'; index: number }
  | { kind: 'bool'; value: boolean }
  | { kind: 'text'; value: string }
  | { kind: 'blanks'; values: string[] }
  | { kind: 'order'; order: number[] }
  | { kind: 'pairs'; map: (number | null)[] }
  | { kind: 'segment'; index: number | null; correction: string }
  | { kind: 'option'; value: string }
  | { kind: 'group'; answers: Record<string, Response | undefined> };

export type Verdict = 'correct' | 'accepted_with_note' | 'partial' | 'incorrect';

export interface FeedbackMessage {
  tone: 'success' | 'error' | 'info' | 'note';
  text: string;
  /** id del catálogo de errores cuando el mensaje procede de él */
  errorTag?: string;
}

export type DiffToken = { text: string; status: 'ok' | 'missing' | 'extra' | 'wrong'; expected?: string };

export interface GradeResult {
  exerciseId: string;
  score: number; // 0..1
  verdict: Verdict;
  expected: string;
  responseText: string;
  messages: FeedbackMessage[];
  errorTags: string[];
  /** Resultado por hueco / par / subpregunta según el tipo */
  parts?: { label: string; correct: boolean; given: string; expected: string }[];
  diff?: DiffToken[];
  sub?: GradeResult[];
  /** Respuestas alternativas válidas para mostrar */
  alternatives?: string[];
  /** Explicación de cada opción (selección múltiple) */
  optionNotes?: { text: string; why?: string; correct: boolean; chosen: boolean }[];
  /** Notas de traducción (literal vs natural) */
  notes?: string;
}

export function isCorrectVerdict(v: Verdict): boolean {
  return v === 'correct' || v === 'accepted_with_note';
}
