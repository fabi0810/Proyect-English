import { describe, expect, it } from 'vitest';
import type { Exercise } from '../../types/content';
import { assemble, computeQuotas } from './assemble';
import { computeGrade, isPassing, percentNeeded } from './scale';
import { review, isLearned, markKnown, cardState } from '../vocabulary/srs';
import { checkText, applySuggestions } from '../writing/checker';
import { analyzeWriting } from '../writing/analyze';

describe('escala 1.0–5.0', () => {
  it('ancla 3.0 en la exigencia y trunca', () => {
    expect(computeGrade(0)).toBe(1);
    expect(computeGrade(0.35)).toBe(2);
    expect(computeGrade(0.6)).toBe(2.7);
    expect(computeGrade(0.69)).toBe(2.9);
    expect(computeGrade(0.7)).toBe(3);
    expect(computeGrade(0.85)).toBe(4);
    expect(computeGrade(1)).toBe(5);
  });
  it('la nota mínima configurable endurece la aprobación', () => {
    expect(isPassing(computeGrade(0.75), 3.5)).toBe(false);
    expect(isPassing(computeGrade(0.775), 3.5)).toBe(true);
    expect(percentNeeded(3.5, 0.7)).toBeCloseTo(0.775);
    expect(percentNeeded(3.0, 0.6)).toBeCloseTo(0.6);
  });
});

function fakePool(n: number, lessons = 3): Exercise[] {
  const types = ['multiple_choice', 'fill_blank', 'true_false', 'error_correction'] as const;
  return Array.from({ length: n }, (_, i) => ({
    id: `x-${i}`,
    type: types[i % types.length],
    topic: `t${i % 5}`,
    skill: 'grammar',
    difficulty: ((i % 3) + 1) as 1 | 2 | 3,
    lesson: `L${i % lessons}`,
    explanation: '',
  })) as unknown as Exercise[];
}

describe('ensamblado de exámenes', () => {
  it('no repite ítems y respeta el tamaño', () => {
    const pool = fakePool(40);
    const exam = assemble(pool, { size: 15, seed: 1 });
    expect(exam).toHaveLength(15);
    expect(new Set(exam.map((e) => e.id)).size).toBe(15);
  });

  it('con pool ≥ 2× tamaño, dos intentos consecutivos no comparten preguntas', () => {
    const pool = fakePool(32);
    const first = assemble(pool, { size: 15, seed: 11 });
    const used = new Set(first.map((e) => e.id));
    const second = assemble(pool, { size: 15, seed: 12, priority: (e) => (used.has(e.id) ? 3 : 0) });
    expect(second.filter((e) => used.has(e.id))).toHaveLength(0);
  });

  it('cubre todas las lecciones y limita cada tipo al 40 %', () => {
    const pool = fakePool(36, 3);
    const exam = assemble(pool, { size: 15, seed: 5 });
    const lessons = new Set(exam.map((e) => e.lesson));
    expect(lessons.size).toBe(3);
    const byType = new Map<string, number>();
    exam.forEach((e) => byType.set(e.type, (byType.get(e.type) ?? 0) + 1));
    for (const c of byType.values()) expect(c).toBeLessThanOrEqual(6);
  });

  it('nunca incluye dos ítems del mismo grupo', () => {
    const pool = fakePool(20).map((e, i) => ({ ...e, group: `g${Math.floor(i / 2)}` })) as Exercise[];
    const exam = assemble(pool, { size: 15, seed: 3 });
    const groups = exam.map((e) => e.group);
    expect(new Set(groups).size).toBe(groups.length);
    expect(exam.length).toBe(10);
  });

  it('cuotas por resto mayor suman el total', () => {
    const q = computeQuotas(new Map([['a', 10], ['b', 7], ['c', 3]]), 15, 2);
    expect(Array.from(q.values()).reduce((s, v) => s + v, 0)).toBe(15);
    expect(q.get('c')).toBeGreaterThanOrEqual(2);
  });
});

describe('SM-2', () => {
  it('programa intervalos crecientes y reinicia al fallar', () => {
    const now = new Date('2026-01-01T10:00:00');
    let c = review(undefined, 4, now);
    expect(c.interval).toBe(1);
    c = review(c, 4, now);
    expect(c.interval).toBe(6);
    expect(isLearned(c)).toBe(true);
    c = review(c, 4, now);
    expect(c.interval).toBe(15);
    c = review(c, 1, now);
    expect(c.interval).toBe(1);
    expect(c.reps).toBe(0);
    expect(c.lapses).toBe(1);
    expect(c.ease).toBeLessThan(2.5);
  });
  it('"ya la conozco" no cuenta como aprendida hasta confirmarla', () => {
    const k = markKnown(undefined);
    expect(isLearned(k)).toBe(false);
    expect(cardState(k)).toBe('learning');
    expect(isLearned(review(k, 4))).toBe(true);
  });
});

describe('corrector de escritura', () => {
  const ids = (t: string) => checkText(t).map((i) => i.ruleId);
  it('detecta errores típicos de hispanohablantes', () => {
    expect(ids('i have 25 years.')).toContain('be-age');
    expect(ids('My friend and i are here.')).toContain('capital-i');
    expect(ids('My sister work in a hospital.')).toContain('third-person-s');
    expect(ids('He don\'t like tea.')).toContain('do-does-agreement');
    expect(ids('Does she likes pizza?')).toContain('aux-plus-inflected');
    expect(ids('I can to swim.')).toContain('modal-to');
    expect(ids('She has a orange.')).toContain('article-a-an');
    expect(ids('I study english on monday.')).toContain('capital-letters');
    expect(ids('Is very cold today.')).toContain('subject-omitted');
  });
  it('no marca oraciones correctas', () => {
    expect(checkText('Does she like pizza? She doesn\'t like coffee. I am 25 years old. He can swim. An hour, a university.')).toEqual([]);
    expect(checkText('My brother and I live in Bogotá. We have two cats. I go home at six.')).toEqual([]);
  });
  it('genera una versión corregida', () => {
    const t = 'i have 25 years and my sister work in a bank';
    expect(applySuggestions(t, checkText(t))).toBe('I am 25 years old and my sister works in a bank.');
  });
  it('puntúa un texto según requisitos, corrección, organización y extensión', () => {
    const task = { requirements: [{ label: 'Nombre', pattern: 'my name is|I\'m [A-Z]' }], minWords: 15, maxWords: 60 };
    const good = analyzeWriting('Hi! My name is Laura and I am 24 years old. I live in Cali, but I work in Bogotá. I like music.', task);
    const bad = analyzeWriting('i have 24 years', task);
    expect(good.score).toBeGreaterThan(0.85);
    expect(bad.score).toBeLessThan(0.4);
  });
});
