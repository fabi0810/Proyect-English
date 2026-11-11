/** Carga el contenido necesario y construye / resuelve evaluaciones. */
import type { Exercise, Level } from '../../types/content';
import type { AttemptKind, UserData } from '../../types/progress';
import { randomSeed } from '../../utils/random';
import { findExercises, getManifest, loadExamPools, loadLevelModules, loadModule, loadVocabulary, moduleIdOfLesson } from '../content/loader';
import { buildLessonQuiz, buildLevelExam, buildModuleEvaluation, type BuiltExam } from './builders';

export async function prepareExam(kind: AttemptKind, targetId: string, data: UserData): Promise<BuiltExam> {
  const seed = randomSeed();
  if (kind === 'lesson') {
    const mod = await loadModule(moduleIdOfLesson(targetId));
    const lesson = mod.lessons.find((l) => l.id === targetId);
    if (!lesson) throw new Error(`Lección desconocida: ${targetId}`);
    return buildLessonQuiz(lesson, mod.level, data, seed);
  }
  if (kind === 'module') return buildModuleEvaluation(await loadModule(targetId), data, seed);
  if (kind === 'level') {
    const level = targetId as Level;
    const [modules, vocabulary, pools] = await Promise.all([loadLevelModules(level), loadVocabulary(level), loadExamPools(level)]);
    return buildLevelExam(level, getManifest(level).finalExam, { modules, vocabulary, pools }, data, seed);
  }
  throw new Error('Tipo de evaluación no soportado');
}

export async function resolveExercises(ids: string[], generated?: Exercise[]): Promise<Map<string, Exercise>> {
  const map = await findExercises(ids);
  for (const g of generated ?? []) map.set(g.id, g);
  return map;
}

export function evaluationTitle(kind: AttemptKind): string {
  return kind === 'lesson' ? 'Evaluación de lección' : kind === 'module' ? 'Evaluación de módulo' : kind === 'level' ? 'Examen final de nivel' : 'Diagnóstico';
}
