/**
 * Acceso al contenido educativo.
 * - Manifiestos, niveles, catálogo de errores y temas: carga inmediata (pequeños).
 * - Módulos y recursos: carga diferida por archivo, con caché.
 */
import type {
  ComprehensionGroupExercise,

  ExamPools,
  Exercise,
  Level,
  LevelDefinition,
  LevelManifest,
  ListeningActivity,
  Module,
  ModuleSummary,
  PlacementQuestion,
  Pool,
  Reading,
  TranslationExercise,
  VocabWord,
  WritingTaskExercise,
} from '../../types/content';
import { LEVELS } from '../../types/content';
import levelsJson from '../../data/curriculum/levels.json';

import topicsJson from '../../data/topics.json';
import { basicNormalize } from '../exercises/normalize';

const manifestFiles = import.meta.glob<LevelManifest>('../../data/curriculum/*/index.json', { eager: true, import: 'default' });
const moduleFiles = import.meta.glob<Module>(['../../data/curriculum/*/*.json', '!../../data/curriculum/*/index.json'], {
  import: 'default',
});
const vocabFiles = import.meta.glob<VocabWord[]>('../../data/vocabulary/*.json', { import: 'default' });
const readingFiles = import.meta.glob<Reading[]>('../../data/readings/*.json', { import: 'default' });
const listeningFiles = import.meta.glob<ListeningActivity[]>('../../data/listening/*.json', { import: 'default' });
const writingFiles = import.meta.glob<WritingTaskExercise[]>('../../data/writing/*.json', { import: 'default' });
const translationFiles = import.meta.glob<TranslationExercise[]>('../../data/translation/*.json', { import: 'default' });
const examFiles = import.meta.glob<ExamPools>('../../data/exams/*.json', { import: 'default' });
const placementFiles = import.meta.glob<{ questions: PlacementQuestion[] }>('../../data/diagnostic/*.json', { import: 'default' });

export const levelDefinitions = levelsJson as LevelDefinition[];
export { errorCatalog } from './catalog';
export const topics = topicsJson as Record<string, { label: string; lesson?: string }>;

const manifests: Record<Level, LevelManifest> = Object.fromEntries(
  Object.values(manifestFiles).map((m) => [m.level, m]),
) as Record<Level, LevelManifest>;

export function getLevelDefinition(level: Level): LevelDefinition | undefined {
  return levelDefinitions.find((l) => l.id === level);
}

export function getManifest(level: Level): LevelManifest {
  return manifests[level] ?? { level, modules: [], finalExam: { id: `${level}-final`, title: `${level} Final Exam`, sections: [] } };
}

export function allModuleSummaries(): (ModuleSummary & { level: Level })[] {
  return LEVELS.flatMap((level) => getManifest(level).modules.map((m) => ({ ...m, level })));
}

export function findModuleSummary(moduleId: string): (ModuleSummary & { level: Level }) | undefined {
  return allModuleSummaries().find((m) => m.id === moduleId);
}

export function moduleIdOfLesson(lessonId: string): string {
  return lessonId.replace(/-l\d+$/, '');
}

export function levelOfId(id: string): Level | undefined {
  const m = /^(a1|a2|b1|b2)-/.exec(id);
  return m ? (m[1].toUpperCase() as Level) : undefined;
}

export function topicLabel(topic: string): string {
  return topics[topic]?.label ?? topic.replace(/-/g, ' ');
}

/* ───────── Preparación de ejercicios ───────── */

function prepareFeedback(ex: Exercise): void {
  if (ex.type !== 'fill_blank') return;
  for (const b of ex.blanks) {
    if (!b.feedback) continue;
    const norm: Record<string, string> = {};
    for (const [k, v] of Object.entries(b.feedback)) norm[basicNormalize(k)] = v;
    b.feedback = norm;
  }
}

/** Inyecta nivel, módulo, lección y pool en cada ejercicio (también en subpreguntas). */
export function prepareExercise(ex: Exercise, ctx: { level: Level; module?: string; lesson?: string; pool: Pool }): Exercise {
  ex.level = ex.level ?? ctx.level;
  ex.module = ex.module ?? ctx.module;
  ex.lesson = ex.lesson ?? ctx.lesson;
  ex.pool = ex.pool ?? ctx.pool;
  prepareFeedback(ex);
  if (ex.type === 'reading_comprehension' || ex.type === 'listening_comprehension') {
    for (const q of (ex as ComprehensionGroupExercise).questions) {
      q.topic = q.topic ?? ex.topic;
      q.skill = q.skill ?? ex.skill;
      q.difficulty = q.difficulty ?? ex.difficulty;
      prepareExercise(q, { ...ctx, pool: ctx.pool });
    }
  }
  return ex;
}

export function prepareModule(mod: Module): Module {
  for (const lesson of mod.lessons) {
    const ctx = { level: mod.level, module: mod.id, lesson: lesson.id };
    lesson.guided.forEach((e) => prepareExercise(e, { ...ctx, pool: 'guided' }));
    lesson.independent.forEach((e) => prepareExercise(e, { ...ctx, pool: 'independent' }));
    lesson.quiz.forEach((e) => prepareExercise(e, { ...ctx, pool: 'quiz' }));
  }
  mod.integrative.forEach((e) => prepareExercise(e, { level: mod.level, module: mod.id, pool: 'integrative' }));
  return mod;
}

/* ───────── Carga diferida ───────── */

const cache = new Map<string, Promise<unknown>>();

function cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
  if (!cache.has(key)) cache.set(key, loader());
  return cache.get(key) as Promise<T>;
}

function fileFor<T>(files: Record<string, () => Promise<T>>, name: string): (() => Promise<T>) | undefined {
  const key = Object.keys(files).find((k) => k.endsWith(`/${name}`));
  return key ? files[key] : undefined;
}

export function loadModule(moduleId: string): Promise<Module> {
  return cached(`module:${moduleId}`, async () => {
    const summary = findModuleSummary(moduleId);
    if (!summary) throw new Error(`Módulo desconocido: ${moduleId}`);
    if (summary.status !== 'ready') throw new Error(`El módulo ${moduleId} está en preparación`);
    const loader = fileFor(moduleFiles, `${summary.level}/${summary.file}`);
    if (!loader) throw new Error(`No se encontró el archivo del módulo ${summary.file}`);
    const raw = await loader();
    return prepareModule(structuredClone(raw));
  });
}

export async function loadLevelModules(level: Level): Promise<Module[]> {
  const ready = getManifest(level).modules.filter((m) => m.status === 'ready');
  return Promise.all(ready.map((m) => loadModule(m.id)));
}

export function hasLevelFile(dir: 'vocabulary' | 'readings' | 'listening' | 'writing' | 'translation' | 'exams', level: Level): boolean {
  const files = { vocabulary: vocabFiles, readings: readingFiles, listening: listeningFiles, writing: writingFiles, translation: translationFiles, exams: examFiles }[dir];
  return Boolean(fileFor(files as Record<string, () => Promise<unknown>>, `${level}.json`));
}

export function loadVocabulary(level: Level): Promise<VocabWord[]> {
  return cached(`vocab:${level}`, async () => {
    const loader = fileFor(vocabFiles, `${level}.json`);
    return loader ? structuredClone(await loader()) : [];
  });
}

export async function loadAllVocabulary(): Promise<VocabWord[]> {
  const all = await Promise.all(LEVELS.map((l) => loadVocabulary(l)));
  return all.flat();
}

export function loadReadings(level: Level): Promise<Reading[]> {
  return cached(`readings:${level}`, async () => {
    const loader = fileFor(readingFiles, `${level}.json`);
    const list = loader ? structuredClone(await loader()) : [];
    for (const r of list) r.questions.forEach((q) => prepareExercise(q, { level: r.level, pool: 'reading' }));
    return list;
  });
}

export function loadListening(level: Level): Promise<ListeningActivity[]> {
  return cached(`listening:${level}`, async () => {
    const loader = fileFor(listeningFiles, `${level}.json`);
    const list = loader ? structuredClone(await loader()) : [];
    for (const a of list) a.questions.forEach((q) => prepareExercise(q, { level: a.level, pool: 'listening' }));
    return list;
  });
}

export function loadWritingTasks(level: Level): Promise<WritingTaskExercise[]> {
  return cached(`writing:${level}`, async () => {
    const loader = fileFor(writingFiles, `${level}.json`);
    const list = loader ? structuredClone(await loader()) : [];
    list.forEach((t) => prepareExercise(t, { level, pool: 'writing' }));
    return list;
  });
}

export function loadTranslations(level: Level): Promise<TranslationExercise[]> {
  return cached(`translation:${level}`, async () => {
    const loader = fileFor(translationFiles, `${level}.json`);
    const list = loader ? structuredClone(await loader()) : [];
    list.forEach((t) => prepareExercise(t, { level, pool: 'translation' }));
    return list;
  });
}

export function loadExamPools(level: Level): Promise<ExamPools | undefined> {
  return cached(`exam:${level}`, async () => {
    const loader = fileFor(examFiles, `${level}.json`);
    if (!loader) return undefined;
    const pools = structuredClone(await loader());
    for (const key of ['reading', 'listening', 'translation', 'writing'] as const)
      (pools[key] as Exercise[]).forEach((e) => prepareExercise(e, { level, pool: 'exam' }));
    return pools;
  });
}

export function loadPlacement(): Promise<PlacementQuestion[]> {
  return cached('placement', async () => {
    const loader = fileFor(placementFiles, 'placement.json');
    return loader ? structuredClone((await loader()).questions) : [];
  });
}

/* ───────── Índice global de ejercicios ───────── */

export function flattenExercises(list: Exercise[]): Exercise[] {
  const out: Exercise[] = [];
  for (const e of list) {
    out.push(e);
    if (e.type === 'reading_comprehension' || e.type === 'listening_comprehension') out.push(...flattenExercises(e.questions));
  }
  return out;
}

export function moduleExercises(mod: Module): Exercise[] {
  return [...mod.lessons.flatMap((l) => [...l.guided, ...l.independent, ...l.quiz]), ...mod.integrative];
}

/** Todos los ejercicios de un nivel (módulos listos + recursos), indexados por id. */
export function loadLevelIndex(level: Level): Promise<Map<string, Exercise>> {
  return cached(`index:${level}`, async () => {
    const [mods, readings, listening, writing, translation, exams] = await Promise.all([
      loadLevelModules(level),
      loadReadings(level),
      loadListening(level),
      loadWritingTasks(level),
      loadTranslations(level),
      loadExamPools(level),
    ]);
    const all: Exercise[] = [
      ...mods.flatMap(moduleExercises),
      ...readings.flatMap((r) => r.questions),
      ...listening.flatMap((a) => a.questions),
      ...writing,
      ...translation,
      ...(exams ? [...exams.reading, ...exams.listening, ...exams.translation, ...exams.writing] : []),
    ];
    const map = new Map<string, Exercise>();
    for (const e of flattenExercises(all)) map.set(e.id, e);
    return map;
  });
}

export async function findExercises(ids: string[]): Promise<Map<string, Exercise>> {
  const levels = new Set<Level>();
  for (const id of ids) {
    const l = levelOfId(id);
    if (l) levels.add(l);
  }
  const out = new Map<string, Exercise>();
  for (const level of levels) {
    const idx = await loadLevelIndex(level);
    for (const id of ids) {
      const e = idx.get(id);
      if (e) out.set(id, e);
    }
  }
  return out;
}
