/** Estadísticas derivadas del historial (funciones puras). */
import type { Level } from '../../types/content';
import { LEVELS } from '../../types/content';
import type { EvaluationAttempt, UserData } from '../../types/progress';
import { addDays, dayKey, lastDays, startOfDay } from '../../utils/dates';
import { allModuleSummaries, getManifest } from '../content/loader';
import { isLearned } from '../vocabulary/srs';
import { isLevelPassed } from './unlock';

export function completedAttempts(data: UserData, kind?: EvaluationAttempt['kind']): EvaluationAttempt[] {
  return data.attempts.filter((a) => a.status === 'completed' && (!kind || a.kind === kind));
}

/** Nota vigente (la más alta) de cada evaluación de módulo o de nivel. */
export function currentGrades(data: UserData): Map<string, { grade: number; kind: EvaluationAttempt['kind']; level: Level; title: string }> {
  const map = new Map<string, { grade: number; kind: EvaluationAttempt['kind']; level: Level; title: string }>();
  for (const a of data.attempts) {
    if (a.status !== 'completed' || a.grade === undefined || (a.kind !== 'module' && a.kind !== 'level')) continue;
    const key = `${a.kind}:${a.targetId}`;
    const prev = map.get(key);
    if (!prev || a.grade > prev.grade) map.set(key, { grade: a.grade, kind: a.kind, level: a.level, title: a.title });
  }
  return map;
}

export function averageGrade(data: UserData): number | undefined {
  const grades = Array.from(currentGrades(data).values()).map((g) => g.grade);
  if (!grades.length) return undefined;
  return Math.round((grades.reduce((s, g) => s + g, 0) / grades.length) * 10) / 10;
}

export function levelProgress(data: UserData, level: Level): { done: number; total: number; ratio: number; passedModules: number; modules: number } {
  const modules = getManifest(level).modules;
  const passedModules = modules.filter((m) => data.modules[m.id]?.passedAt).length;
  const examPassed = isLevelPassed(data, level) ? 1 : 0;
  const total = modules.length + 1;
  const done = passedModules + examPassed;
  return { done, total, ratio: total ? done / total : 0, passedModules, modules: modules.length };
}

export function overallProgress(data: UserData): number {
  const all = allModuleSummaries().length + LEVELS.length;
  const done = LEVELS.reduce((s, l) => s + levelProgress(data, l).done, 0);
  return all ? done / all : 0;
}

/** Nivel en el que se está trabajando (el primero sin aprobar). */
export function currentLevel(data: UserData): Level {
  const start = LEVELS.indexOf(data.profile.startLevel);
  for (let i = start; i < LEVELS.length; i++) if (!isLevelPassed(data, LEVELS[i])) return LEVELS[i];
  return 'B2';
}

export function totalStudySeconds(data: UserData): number {
  return Object.values(data.activity).reduce((s, d) => s + d.seconds, 0);
}

export function daysActive(data: UserData): number {
  return Object.values(data.activity).filter((d) => d.seconds >= 60 || d.answers > 0).length;
}

function isActiveDay(data: UserData, key: string): boolean {
  const d = data.activity[key];
  return Boolean(d && (d.seconds >= 60 || d.answers > 0 || d.reviews > 0));
}

/** Racha de días consecutivos con estudio (hoy o ayer como último día). */
export function streak(data: UserData, now: Date = new Date()): number {
  let day = startOfDay(now);
  if (!isActiveDay(data, dayKey(day))) day = addDays(day, -1);
  let n = 0;
  while (isActiveDay(data, dayKey(day))) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

export function weekActivity(data: UserData, now: Date = new Date()): { key: string; active: boolean; seconds: number }[] {
  return lastDays(7, now).map((key) => ({ key, active: isActiveDay(data, key), seconds: data.activity[key]?.seconds ?? 0 }));
}

export function wordsLearned(data: UserData): number {
  return Object.values(data.vocab.cards).filter(isLearned).length;
}

export function unresolvedMistakes(data: UserData) {
  return Object.values(data.mistakes).filter((m) => !m.resolved);
}

export function frequentErrors(data: UserData, limit = 5): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const m of unresolvedMistakes(data)) for (const t of m.errorTags) counts.set(t, (counts.get(t) ?? 0) + m.count);
  return Array.from(counts, ([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function weakTopics(data: UserData, limit = 6): { topic: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const m of unresolvedMistakes(data)) counts.set(m.topic, (counts.get(m.topic) ?? 0) + m.count);
  return Array.from(counts, ([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** Precisión por habilidad a partir del registro de respuestas. */
export function skillAccuracy(data: UserData, level?: Level): Record<string, { correct: number; total: number }> {
  const out: Record<string, { correct: number; total: number }> = {};
  for (const r of data.answerLog) {
    if (!r.skill || (level && r.level !== level)) continue;
    const s = (out[r.skill] ??= { correct: 0, total: 0 });
    s.total += 1;
    s.correct += r.score;
  }
  return out;
}

export function accuracy(data: UserData): number | undefined {
  const all = Object.values(data.itemStats);
  const seen = all.reduce((s, i) => s + i.seen, 0);
  if (!seen) return undefined;
  return all.reduce((s, i) => s + i.correct, 0) / seen;
}
