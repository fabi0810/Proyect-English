/**
 * Repetición espaciada SM-2 (variante con cuatro respuestas).
 *   Otra vez = 1 · Difícil = 3 · Bien = 4 · Fácil = 5
 * Ver docs/ASSESSMENT_SYSTEM.md §9.
 */
import type { SrsCard } from '../../types/progress';
import { addDays, DAY_MS, startOfDay } from '../../utils/dates';

export type ReviewQuality = 1 | 3 | 4 | 5;
export const INITIAL_EASE = 2.5;
export const MIN_EASE = 1.3;

export type CardState = 'new' | 'learning' | 'reviewing' | 'mastered';

export function newCard(now: Date = new Date()): SrsCard {
  return { ease: INITIAL_EASE, interval: 0, reps: 0, lapses: 0, due: now.toISOString(), history: [] };
}

export function nextEase(ease: number, q: number): number {
  const e = ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  return Math.max(MIN_EASE, Math.round(e * 100) / 100);
}

export function review(card: SrsCard | undefined, q: ReviewQuality, now: Date = new Date()): SrsCard {
  const c: SrsCard = card ? { ...card, history: [...card.history] } : newCard(now);
  let interval: number;
  if (q < 3) {
    c.reps = 0;
    c.lapses += 1;
    interval = 1;
  } else if (q === 3) {
    interval = c.reps === 0 ? 1 : Math.max(1, Math.round(c.interval * 1.2));
    c.reps += 1;
  } else if (q === 4) {
    interval = c.reps === 0 ? 1 : c.reps === 1 ? Math.max(6, c.interval) : Math.max(1, Math.round(c.interval * c.ease));
    c.reps += 1;
  } else {
    interval = c.reps === 0 ? 4 : c.reps === 1 ? Math.max(8, Math.round(c.interval * 1.3)) : Math.max(1, Math.round(c.interval * c.ease * 1.3));
    c.reps += 1;
  }
  c.ease = nextEase(c.ease, q);
  c.interval = interval;
  c.due = addDays(startOfDay(now), interval).toISOString();
  c.lastReview = now.toISOString();
  c.history = [...c.history.slice(-19), q];
  c.known = false;
  return c;
}

/** "Ya la conozco": se programa a 4 días; solo cuenta como aprendida tras confirmarla. */
export function markKnown(card: SrsCard | undefined, now: Date = new Date()): SrsCard {
  const c = card ? { ...card } : newCard(now);
  return { ...c, reps: Math.max(c.reps, 1), interval: Math.max(c.interval, 4), due: addDays(startOfDay(now), 4).toISOString(), known: true, history: [...c.history] };
}

export function cardState(card?: SrsCard): CardState {
  if (!card || (card.reps === 0 && card.history.length === 0)) return 'new';
  if (card.interval > 21) return 'mastered';
  if (card.interval >= 6 && card.reps >= 2) return 'reviewing';
  return 'learning';
}

/** Palabra aprendida: ≥ 2 recuerdos correctos consecutivos e intervalo ≥ 6 días. */
export function isLearned(card?: SrsCard): boolean {
  return Boolean(card && !card.known && card.reps >= 2 && card.interval >= 6);
}

export function isDue(card: SrsCard | undefined, now: Date = new Date()): boolean {
  if (!card) return false;
  return new Date(card.due).getTime() <= now.getTime();
}

/** Urgencia para ordenar la cola: más vencidas y con intervalos cortos primero. */
export function urgency(card: SrsCard, now: Date = new Date()): number {
  const overdueDays = (now.getTime() - new Date(card.due).getTime()) / DAY_MS;
  return overdueDays / Math.max(1, card.interval) + card.lapses * 0.3;
}
