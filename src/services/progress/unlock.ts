/** Reglas de desbloqueo y progresión (modo estricto configurable). Ver ASSESSMENT_SYSTEM.md §5.6 */
import type { Level, Module, ModuleSummary } from '../../types/content';
import { LEVELS } from '../../types/content';
import type { UserData } from '../../types/progress';
import { getManifest } from '../content/loader';
import { percentNeeded } from '../evaluation/scale';

export type ModuleState = 'planned' | 'locked' | 'available' | 'in_progress' | 'passed';
export type LessonState = 'locked' | 'available' | 'in_progress' | 'completed';

export function levelIndex(level: Level): number {
  return LEVELS.indexOf(level);
}

export function isLevelPassed(data: UserData, level: Level): boolean {
  return data.attempts.some((a) => a.kind === 'level' && a.targetId === level && a.status === 'completed' && a.passed);
}

export function isLevelUnlocked(level: Level, data: UserData): boolean {
  if (!data.settings.strictProgression) return true;
  const idx = levelIndex(level);
  if (idx === 0) return true;
  if (levelIndex(data.profile.startLevel) >= idx) return true;
  return isLevelPassed(data, LEVELS[idx - 1]);
}

export function isModulePassed(data: UserData, moduleId: string): boolean {
  return Boolean(data.modules[moduleId]?.passedAt);
}

function moduleStarted(data: UserData, moduleId: string): boolean {
  return Object.keys(data.lessons).some((id) => id.startsWith(`${moduleId}-l`)) || (data.modules[moduleId]?.attempts ?? 0) > 0;
}

export function moduleState(summary: ModuleSummary, level: Level, data: UserData): ModuleState {
  if (summary.status === 'planned') return 'planned';
  if (isModulePassed(data, summary.id)) return 'passed';
  const started = moduleStarted(data, summary.id);
  if (!data.settings.strictProgression) return started ? 'in_progress' : 'available';
  if (!isLevelUnlocked(level, data)) return 'locked';
  // Niveles por debajo del nivel de inicio elegido: acceso libre (no cuentan como aprobados).
  if (levelIndex(level) < levelIndex(data.profile.startLevel)) return started ? 'in_progress' : 'available';
  const modules = getManifest(level).modules;
  const idx = modules.findIndex((m) => m.id === summary.id);
  const prev = idx > 0 ? modules[idx - 1] : undefined;
  if (prev && !isModulePassed(data, prev.id)) return 'locked';
  return started ? 'in_progress' : 'available';
}

export function lessonState(mod: Module, lessonIndex: number, data: UserData): LessonState {
  const lesson = mod.lessons[lessonIndex];
  const progress = data.lessons[lesson.id];
  if (progress?.status === 'completed') return 'completed';
  if (progress) return 'in_progress';
  if (!data.settings.strictProgression) return 'available';
  if (lessonIndex === 0) return 'available';
  const prev = mod.lessons[lessonIndex - 1];
  return data.lessons[prev.id]?.status === 'completed' ? 'available' : 'locked';
}

export function isLessonCompleted(data: UserData, lessonId: string): boolean {
  return data.lessons[lessonId]?.status === 'completed';
}

/** Porcentaje que exige la evaluación de una lección para darla por completada. */
export function lessonPassPercent(data: UserData): number {
  return percentNeeded(data.settings.passGrade, data.settings.exigency);
}

export function moduleEvaluationAvailability(mod: Module, data: UserData): { ok: boolean; reason?: string } {
  const summary = getManifest(mod.level).modules.find((m) => m.id === mod.id);
  if (summary && moduleState(summary, mod.level, data) === 'locked') return { ok: false, reason: 'El módulo está bloqueado: aprueba primero el módulo anterior.' };
  if (!data.settings.strictProgression) return { ok: true };
  const pending = mod.lessons.filter((l) => !isLessonCompleted(data, l.id));
  if (pending.length) return { ok: false, reason: `Completa primero ${pending.length === 1 ? 'la lección' : `las ${pending.length} lecciones`} del módulo.` };
  if (data.settings.requireReviewBeforeRetake) {
    const attempts = data.attempts.filter((a) => a.kind === 'module' && a.targetId === mod.id && a.status === 'completed');
    const last = attempts[attempts.length - 1];
    if (last && !last.passed) {
      const reviewedAfter = data.events.some((e) => e.type === 'practice' && e.ts > (last.finishedAt ?? '') && e.link === `/module/${mod.id}`);
      if (!reviewedAfter) return { ok: false, reason: 'Configuración: completa una sesión de repaso de los temas pendientes antes de reintentar.' };
    }
  }
  return { ok: true };
}

export function levelExamAvailability(level: Level, data: UserData): { ok: boolean; reason?: string } {
  const modules = getManifest(level).modules;
  if (modules.length === 0 || modules.some((m) => m.status !== 'ready'))
    return { ok: false, reason: 'El examen final estará disponible cuando todos los módulos del nivel tengan contenido.' };
  if (!isLevelUnlocked(level, data)) return { ok: false, reason: 'Nivel bloqueado.' };
  if (!data.settings.strictProgression) return { ok: true };
  const pending = modules.filter((m) => !isModulePassed(data, m.id));
  if (pending.length) return { ok: false, reason: `Aprueba los ${pending.length} módulos pendientes del nivel.` };
  return { ok: true };
}

export interface NextStep {
  kind: 'lesson' | 'module-eval' | 'level-exam' | 'done' | 'planned';
  level: Level;
  moduleId?: string;
  moduleTitle?: string;
  label: string;
  link: string;
}

/** Siguiente paso recomendado en el curso (módulo en curso o primer módulo disponible). */
export function nextStep(data: UserData): NextStep {
  for (const level of LEVELS) {
    const manifest = getManifest(level);
    if (isLevelPassed(data, level)) continue;
    if (!isLevelUnlocked(level, data)) continue;
    for (const m of manifest.modules) {
      const st = moduleState(m, level, data);
      if (st === 'passed') continue;
      if (st === 'planned')
        return { kind: 'planned', level, moduleId: m.id, moduleTitle: m.title, label: `${m.title} (en preparación)`, link: `/courses/${level}` };
      if (st === 'available' || st === 'in_progress')
        return { kind: 'lesson', level, moduleId: m.id, moduleTitle: m.title, label: m.title, link: `/module/${m.id}` };
    }
    if (levelExamAvailability(level, data).ok)
      return { kind: 'level-exam', level, label: `Examen final ${level}`, link: `/evaluations` };
  }
  return { kind: 'done', level: 'B2', label: 'Curso completado', link: '/history' };
}
