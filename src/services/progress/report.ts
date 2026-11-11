/** Informe académico general (se muestra al terminar B2 y antes de reiniciar el curso). */
import { LEVELS } from '../../types/content';
import type { AcademicReport, UserData } from '../../types/progress';
import { nowIso } from '../../utils/dates';
import { topicLabel } from '../content/loader';
import { SKILL_LABELS } from '../content/taxonomy';
import { completedAttempts, currentGrades, daysActive, levelProgress, skillAccuracy, totalStudySeconds, wordsLearned } from './stats';
import { isLevelPassed } from './unlock';

const MODULES_WEIGHT = 0.4;
const EXAM_WEIGHT = 0.6;

export function levelFinalGrade(data: UserData, level: (typeof LEVELS)[number]): { finalGrade?: number; examGrade?: number; modulesAverage?: number } {
  const grades = currentGrades(data);
  const moduleGrades = Array.from(grades.entries())
    .filter(([k, v]) => k.startsWith('module:') && v.level === level)
    .map(([, v]) => v.grade);
  const examGrade = grades.get(`level:${level}`)?.grade;
  const modulesAverage = moduleGrades.length ? moduleGrades.reduce((s, g) => s + g, 0) / moduleGrades.length : undefined;
  let finalGrade: number | undefined;
  if (examGrade !== undefined && modulesAverage !== undefined && isLevelPassed(data, level))
    finalGrade = Math.floor((MODULES_WEIGHT * modulesAverage + EXAM_WEIGHT * examGrade) * 10 + 1e-9) / 10;
  return {
    finalGrade,
    examGrade,
    modulesAverage: modulesAverage === undefined ? undefined : Math.round(modulesAverage * 10) / 10,
  };
}

export function buildAcademicReport(data: UserData): AcademicReport {
  const levels: AcademicReport['levels'] = {};
  const finals: number[] = [];
  for (const level of LEVELS) {
    const g = levelFinalGrade(data, level);
    const p = levelProgress(data, level);
    levels[level] = { ...g, passed: isLevelPassed(data, level), modulesPassed: p.passedModules, modulesTotal: p.modules };
    if (g.finalGrade !== undefined) finals.push(g.finalGrade);
  }
  const attempts = completedAttempts(data).filter((a) => a.kind === 'module' || a.kind === 'level');
  const targets = new Set(attempts.map((a) => `${a.kind}:${a.targetId}`));

  const skills = Object.entries(skillAccuracy(data))
    .filter(([, v]) => v.total >= 10)
    .map(([k, v]) => ({ k, ratio: v.correct / v.total }))
    .sort((a, b) => b.ratio - a.ratio);
  const topicStats = new Map<string, { c: number; t: number }>();
  for (const a of attempts)
    for (const [topic, v] of Object.entries(a.topics)) {
      const s = topicStats.get(topic) ?? { c: 0, t: 0 };
      s.c += v.correct;
      s.t += v.total;
      topicStats.set(topic, s);
    }
  const topics = Array.from(topicStats, ([topic, v]) => ({ topic, ratio: v.t ? v.c / v.t : 0, t: v.t }))
    .filter((x) => x.t >= 3)
    .sort((a, b) => b.ratio - a.ratio);

  const strengths = [
    ...skills.filter((s) => s.ratio >= 0.8).slice(0, 3).map((s) => `${SKILL_LABELS[s.k as keyof typeof SKILL_LABELS] ?? s.k} (${Math.round(s.ratio * 100)} %)`),
    ...topics.filter((t) => t.ratio >= 0.85).slice(0, 4).map((t) => topicLabel(t.topic)),
  ];
  const weaknesses = [
    ...skills.filter((s) => s.ratio < 0.65).slice(-3).map((s) => `${SKILL_LABELS[s.k as keyof typeof SKILL_LABELS] ?? s.k} (${Math.round(s.ratio * 100)} %)`),
    ...topics.filter((t) => t.ratio < 0.6).slice(-4).map((t) => topicLabel(t.topic)),
  ];

  return {
    generatedAt: nowIso(),
    courseNumber: data.meta.courseNumber,
    levels,
    overallAverage: finals.length ? Math.round((finals.reduce((s, g) => s + g, 0) / finals.length) * 10) / 10 : undefined,
    evaluationsCount: targets.size,
    attemptsCount: attempts.length,
    passedCount: attempts.filter((a) => a.passed).length,
    studySeconds: totalStudySeconds(data),
    daysActive: daysActive(data),
    wordsLearned: wordsLearned(data),
    strengths,
    weaknesses,
  };
}
