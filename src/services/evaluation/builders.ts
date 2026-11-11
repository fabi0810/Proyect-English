/**
 * Construcción de evaluaciones: lección, módulo, examen final de nivel.
 * Las preguntas se eligen con assemble() priorizando ítems no usados en intentos previos.
 */
import type {
  Exercise,
  ExamPools,
  FinalExamBlueprint,
  Level,
  Lesson,
  Module,
  VocabWord,
} from '../../types/content';
import type { AttemptKind, UserData } from '../../types/progress';
import { createRng, permutation } from '../../utils/random';
import { generateVocabQuestions } from '../vocabulary/quiz';
import { assemble } from './assemble';

export const LESSON_QUIZ_SIZE = 6;
export const MODULE_EVAL_SIZE = 15;

export interface BuiltExam {
  kind: AttemptKind;
  targetId: string;
  level: Level;
  title: string;
  seed: number;
  exercises: Exercise[];
  items: { id: string; section?: string; optionOrder?: number[] }[];
  sections?: { id: string; title: string; weight: number }[];
  generated?: Exercise[];
}

/** Prioridad de frescura de cada ítem según intentos anteriores. */
export function usagePriority(data: UserData, kind: AttemptKind, targetId: string): (ex: Exercise) => number {
  const attempts = data.attempts.filter((a) => a.kind === kind && a.targetId === targetId);
  const last = attempts[attempts.length - 1];
  const lastIds = new Set(last ? last.items.map((i) => i.id) : []);
  const anyIds = new Set(attempts.flatMap((a) => a.items.map((i) => i.id)));
  const otherIds = new Set(
    data.attempts.filter((a) => !(a.kind === kind && a.targetId === targetId)).flatMap((a) => a.items.map((i) => i.id)),
  );
  return (ex) => (lastIds.has(ex.id) ? 3 : anyIds.has(ex.id) ? 2 : otherIds.has(ex.id) ? 1 : 0);
}

function withOptionOrders(exercises: Exercise[], seed: number, section?: (ex: Exercise) => string | undefined): BuiltExam['items'] {
  const rng = createRng(seed ^ 0x9e3779b9);
  return exercises.map((ex) => ({
    id: ex.id,
    section: section?.(ex),
    optionOrder:
      ex.type === 'multiple_choice' ? permutation(ex.options.length, rng) : ex.type === 'tense_identification' ? permutation(ex.options.length, rng) : undefined,
  }));
}

export function buildLessonQuiz(lesson: Lesson, level: Level, data: UserData, seed: number): BuiltExam {
  const exercises = assemble(lesson.quiz, {
    size: LESSON_QUIZ_SIZE,
    seed,
    priority: usagePriority(data, 'lesson', lesson.id),
    bucketOf: (ex) => ex.topic,
    minPerBucket: 1,
  });
  return {
    kind: 'lesson',
    targetId: lesson.id,
    level,
    title: `Evaluación de la lección: ${lesson.title}`,
    seed,
    exercises,
    items: withOptionOrders(exercises, seed),
  };
}

export function modulePool(mod: Module): Exercise[] {
  return [...mod.lessons.flatMap((l) => l.quiz), ...mod.integrative];
}

export function buildModuleEvaluation(mod: Module, data: UserData, seed: number): BuiltExam {
  const pool = modulePool(mod);
  const exercises = assemble(pool, {
    size: mod.evaluation?.questionCount ?? MODULE_EVAL_SIZE,
    seed,
    priority: usagePriority(data, 'module', mod.id),
    bucketOf: (ex) => ex.lesson ?? 'integrative',
    minPerBucket: 2,
  });
  return {
    kind: 'module',
    targetId: mod.id,
    level: mod.level,
    title: `Evaluación: ${mod.title}`,
    seed,
    exercises,
    items: withOptionOrders(exercises, seed),
  };
}

export interface LevelExamSources {
  modules: Module[];
  vocabulary: VocabWord[];
  pools?: ExamPools;
}

export function buildLevelExam(level: Level, blueprint: FinalExamBlueprint, src: LevelExamSources, data: UserData, seed: number): BuiltExam {
  const priority = usagePriority(data, 'level', level);
  const rng = createRng(seed);
  const exercises: Exercise[] = [];
  const sectionOf = new Map<string, string>();
  const generated: Exercise[] = [];
  const moduleItems = src.modules.flatMap(modulePool);
  const taken = new Set<string>();

  blueprint.sections.forEach((section, i) => {
    const sectionSeed = (seed + (i + 1) * 7919) >>> 0;
    let picked: Exercise[] = [];
    const source = section.source;
    if (source.kind === 'modules') {
      const pool = moduleItems.filter(
        (ex) =>
          !taken.has(ex.id) &&
          ex.type !== 'reading_comprehension' &&
          ex.type !== 'listening_comprehension' &&
          ex.type !== 'writing_task' &&
          (!source.skills || source.skills.includes(ex.skill)) &&
          (!source.types || source.types.includes(ex.type)),
      );
      picked = assemble(pool, { size: section.count, seed: sectionSeed, priority, bucketOf: (ex) => ex.module ?? 'x', minPerBucket: 0 });
    } else if (source.kind === 'vocabulary') {
      const used = new Set(data.attempts.filter((a) => a.kind === 'level' && a.targetId === level).flatMap((a) => a.items.map((x) => x.id)));
      const fresh = src.vocabulary.filter((w) => !used.has(`vq-${w.id}-en-es`) && !used.has(`vq-${w.id}-es-en`));
      const words = fresh.length >= section.count ? fresh : src.vocabulary;
      picked = generateVocabQuestions(words, src.vocabulary, section.count, rng);
      generated.push(...picked);
    } else if (src.pools) {
      const pool = src.pools[source.pool] as Exercise[];
      picked = assemble(pool, { size: section.count, seed: sectionSeed, priority, bucketOf: () => 'all', minPerBucket: 0, sortByDifficulty: false });
    }
    for (const ex of picked) {
      taken.add(ex.id);
      sectionOf.set(ex.id, section.id);
      exercises.push(ex);
    }
  });

  return {
    kind: 'level',
    targetId: level,
    level,
    title: blueprint.title,
    seed,
    exercises,
    items: withOptionOrders(exercises, seed, (ex) => sectionOf.get(ex.id)),
    sections: blueprint.sections.map((s) => ({ id: s.id, title: s.title, weight: s.weight })),
    generated,
  };
}
