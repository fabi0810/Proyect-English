/** Calificación de un intento completo y análisis de resultados. */
import type { Exercise } from '../../types/content';
import type { GradeResult, Response } from '../../types/exercise';
import type { AttemptItem, EvaluationAttempt, Settings } from '../../types/progress';
import { exercisePoints, gradeExercise } from '../exercises/grade';
import { computeGrade, isPassing } from './scale';

export interface ScoredExam {
  items: AttemptItem[];
  results: Record<string, GradeResult>;
  score: number;
  maxScore: number;
  percent: number;
  grade: number;
  passed: boolean;
  sections?: EvaluationAttempt['sections'];
  topics: Record<string, { correct: number; total: number }>;
}

export function scoreExam(
  items: { id: string; section?: string; optionOrder?: number[] }[],
  exercises: Map<string, Exercise>,
  answers: Record<string, Response | undefined>,
  settings: Pick<Settings, 'passGrade' | 'exigency' | 'sectionMinimum'>,
  sectionsDef?: { id: string; title: string; weight: number }[],
): ScoredExam {
  const results: Record<string, GradeResult> = {};
  const attemptItems: AttemptItem[] = [];
  const topics: Record<string, { correct: number; total: number }> = {};
  const sectionAcc = new Map<string, { score: number; max: number }>();
  let score = 0;
  let maxScore = 0;

  const addTopic = (topic: string, got: number, max: number) => {
    const t = (topics[topic] ??= { correct: 0, total: 0 });
    t.correct += got;
    t.total += max;
  };

  for (const it of items) {
    const ex = exercises.get(it.id);
    if (!ex) continue;
    const r = gradeExercise(ex, answers[it.id]);
    results[it.id] = r;
    const points = exercisePoints(ex);
    const got = r.score * points;
    score += got;
    maxScore += points;
    if ((ex.type === 'reading_comprehension' || ex.type === 'listening_comprehension') && r.sub) {
      ex.questions.forEach((q, i) => addTopic(q.topic, (r.sub?.[i]?.score ?? 0) * (q.points ?? 1), q.points ?? 1));
    } else addTopic(ex.topic, got, points);
    if (it.section) {
      const s = sectionAcc.get(it.section) ?? { score: 0, max: 0 };
      s.score += got;
      s.max += points;
      sectionAcc.set(it.section, s);
    }
    attemptItems.push({
      id: it.id,
      section: it.section,
      response: answers[it.id],
      score: r.score,
      points,
      verdict: r.verdict,
      topic: ex.topic,
      optionOrder: it.optionOrder,
    });
  }

  let percent = maxScore ? score / maxScore : 0;
  let sections: ScoredExam['sections'];
  let sectionsOk = true;
  if (sectionsDef && sectionsDef.length) {
    sections = {};
    let wSum = 0;
    let wAcc = 0;
    for (const def of sectionsDef) {
      const acc = sectionAcc.get(def.id);
      if (!acc || acc.max === 0) continue;
      const p = acc.score / acc.max;
      const passedSection = p + 1e-9 >= settings.sectionMinimum;
      if (!passedSection) sectionsOk = false;
      sections[def.id] = { title: def.title, percent: p, weight: def.weight, passed: passedSection };
      wSum += def.weight;
      wAcc += def.weight * p;
    }
    if (wSum > 0) percent = wAcc / wSum;
  }
  const grade = computeGrade(percent, settings.exigency);
  return {
    items: attemptItems,
    results,
    score,
    maxScore,
    percent,
    grade,
    passed: isPassing(grade, settings.passGrade) && sectionsOk,
    sections,
    topics,
  };
}

export function topicBuckets(topics: Record<string, { correct: number; total: number }>): { mastered: string[]; pending: string[]; middle: string[] } {
  const mastered: string[] = [];
  const pending: string[] = [];
  const middle: string[] = [];
  for (const [topic, t] of Object.entries(topics)) {
    const ratio = t.total ? t.correct / t.total : 0;
    if (ratio >= 0.8) mastered.push(topic);
    else if (ratio < 0.6) pending.push(topic);
    else middle.push(topic);
  }
  const ratio = (t: string) => topics[t].correct / Math.max(topics[t].total, 1e-9);
  pending.sort((a, b) => ratio(a) - ratio(b));
  return { mastered, pending, middle };
}

export function countErrors(items: AttemptItem[]): number {
  return items.filter((i) => i.verdict !== 'correct' && i.verdict !== 'accepted_with_note').length;
}
