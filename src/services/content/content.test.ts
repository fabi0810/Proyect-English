/** Validación de TODO el contenido educativo (se ejecuta con npm test). */
import { describe, expect, it } from 'vitest';
import type {
  ErrorType,
  ExamPools,
  LevelManifest,
  ListeningActivity,
  Module,
  PlacementQuestion,
  Reading,
  TranslationExercise,
  VocabWord,
  WritingTaskExercise,
} from '../../types/content';
import { flattenExercises, moduleExercises, prepareExercise, prepareModule } from './loader';
import { canonicalResponse } from './selfcheck';
import { gradeExercise } from '../exercises/grade';
import type { Exercise } from '../../types/content';
import {
  createContext,
  validateExamPools,
  validateListening,
  validateModule,
  validatePlacement,
  validateReading,
  validateTranslations,
  validateVocabulary,
  validateWritingTasks,
} from './validate';
import topicsJson from '../../data/topics.json';
import catalogJson from '../../data/errors/catalog.json';

const manifests = Object.values(import.meta.glob<LevelManifest>('../../data/curriculum/*/index.json', { eager: true, import: 'default' }));
const moduleFiles = import.meta.glob<Module>(['../../data/curriculum/*/*.json', '!../../data/curriculum/*/index.json'], { eager: true, import: 'default' });
const vocab = import.meta.glob<VocabWord[]>('../../data/vocabulary/*.json', { eager: true, import: 'default' });
const readings = import.meta.glob<Reading[]>('../../data/readings/*.json', { eager: true, import: 'default' });
const listening = import.meta.glob<ListeningActivity[]>('../../data/listening/*.json', { eager: true, import: 'default' });
const writing = import.meta.glob<WritingTaskExercise[]>('../../data/writing/*.json', { eager: true, import: 'default' });
const translation = import.meta.glob<TranslationExercise[]>('../../data/translation/*.json', { eager: true, import: 'default' });
const exams = import.meta.glob<ExamPools>('../../data/exams/*.json', { eager: true, import: 'default' });
const placement = import.meta.glob<{ questions: PlacementQuestion[] }>('../../data/diagnostic/*.json', { eager: true, import: 'default' });

const topics = topicsJson as Record<string, { label: string; lesson?: string }>;
const catalog = catalogJson as Record<string, ErrorType>;

function levelFromPath(p: string): string {
  return /\/([AB][12])(?:\/|\.json)/.exec(p)?.[1] ?? '?';
}

describe('contenido educativo', () => {
  const ctx = createContext(topics, catalog);
  const readyIds = new Set(manifests.flatMap((m) => m.modules.filter((x) => x.status === 'ready').map((x) => x.id)));
  const allLessonIds = new Set<string>();

  it('manifiestos: módulos únicos y archivos existentes para los módulos listos', () => {
    const errors: string[] = [];
    const ids = new Set<string>();
    for (const m of manifests) {
      m.modules.forEach((s, i) => {
        if (ids.has(s.id)) errors.push(`módulo duplicado ${s.id}`);
        ids.add(s.id);
        if (s.order !== i + 1) errors.push(`${s.id}: orden ${s.order} ≠ ${i + 1}`);
        const path = `../../data/curriculum/${m.level}/${s.file}`;
        if (s.status === 'ready' && !moduleFiles[path]) errors.push(`${s.id}: falta el archivo ${s.file}`);
      });
      const w = m.finalExam.sections.reduce((s, x) => s + x.weight, 0);
      if (Math.abs(w - 1) > 1e-6) errors.push(`${m.level}: los pesos del examen final suman ${w}`);
    }
    expect(errors).toEqual([]);
  });

  it('módulos: estructura A–I, pools y respuestas coherentes', () => {
    ctx.errors.length = 0;
    for (const [path, raw] of Object.entries(moduleFiles)) {
      const level = levelFromPath(path);
      const mod = prepareModule(structuredClone(raw));
      const summary = manifests.find((m) => m.level === level)?.modules.find((s) => path.endsWith(`/${s.file}`));
      if (!summary) {
        ctx.errors.push(`${path}: archivo no registrado en el manifiesto`);
        continue;
      }
      if (summary.status !== 'ready') ctx.errors.push(`${summary.id}: tiene archivo pero está marcado como "planned"`);
      mod.lessons.forEach((l) => allLessonIds.add(l.id));
      if (summary.lessons !== mod.lessons.length) ctx.errors.push(`${summary.id}: el manifiesto indica ${summary.lessons} lecciones y el archivo tiene ${mod.lessons.length}`);
      validateModule(ctx, mod, summary.id, level);
    }
    expect(ctx.errors).toEqual([]);
  });

  it('vocabulario, lecturas, listening, escritura, traducción y exámenes', () => {
    ctx.errors.length = 0;
    for (const [p, words] of Object.entries(vocab)) validateVocabulary(ctx, words, levelFromPath(p));
    for (const list of Object.values(readings)) list.forEach((r) => validateReading(ctx, r));
    for (const list of Object.values(listening)) list.forEach((a) => validateListening(ctx, a));
    for (const [p, list] of Object.entries(writing)) validateWritingTasks(ctx, list, levelFromPath(p));
    for (const [p, list] of Object.entries(translation)) validateTranslations(ctx, list, levelFromPath(p));
    for (const pools of Object.values(exams)) validateExamPools(ctx, pools);
    expect(ctx.errors).toEqual([]);
  });

  it('diagnóstico', () => {
    ctx.errors.length = 0;
    for (const file of Object.values(placement)) validatePlacement(ctx, file.questions, manifests);
    expect(ctx.errors).toEqual([]);
  });

  it('referencias de temas y catálogo apuntan a lecciones existentes (módulos listos)', () => {
    const errors: string[] = [];
    const check = (where: string, lesson?: string) => {
      if (!lesson) return;
      const moduleId = lesson.replace(/-l\d+$/, '');
      if (readyIds.has(moduleId) && !allLessonIds.has(lesson)) errors.push(`${where}: la lección ${lesson} no existe`);
    };
    for (const [k, t] of Object.entries(topics)) check(`tema ${k}`, t.lesson);
    for (const [k, c] of Object.entries(catalog)) check(`error ${k}`, c.lesson);
    expect(errors).toEqual([]);
  });

  it('cada ejercicio se califica como correcto con su propia clave de respuestas', () => {
    const all: Exercise[] = [];
    for (const raw of Object.values(moduleFiles)) all.push(...moduleExercises(prepareModule(structuredClone(raw))));
    for (const list of Object.values(readings)) for (const r of list) all.push(...r.questions);
    for (const list of Object.values(listening)) for (const a of list) all.push(...a.questions);
    for (const list of Object.values(writing)) all.push(...list);
    for (const list of Object.values(translation)) all.push(...list);
    for (const pools of Object.values(exams)) all.push(...pools.reading, ...pools.listening, ...pools.translation, ...pools.writing);
    const failures: string[] = [];
    for (const ex of all) {
      const e = prepareExercise(structuredClone(ex), { level: ex.level ?? 'A1', pool: 'quiz' });
      const resp = canonicalResponse(e);
      if (!resp) continue;
      const r = gradeExercise(e, resp);
      const ok = e.type === 'writing_task' || e.type === 'open_answer' ? r.score >= 0.8 : r.verdict === 'correct';
      if (!ok) failures.push(`${e.id} (${e.type}): ${r.verdict} ${Math.round(r.score * 100)}% — ${r.messages.map((m) => m.text).join(' | ').slice(0, 160)}`);
    }
    expect(all.length).toBeGreaterThan(0);
    expect(flattenExercises(all).length).toBeGreaterThanOrEqual(all.length);
    expect(failures).toEqual([]);
  });

  it('niveles con módulos listos tienen recursos y pools de examen', () => {
    const errors: string[] = [];
    for (const m of manifests) {
      const ready = m.modules.filter((x) => x.status === 'ready').length;
      if (ready === 0) continue;
      if (!Object.keys(vocab).some((p) => p.endsWith(`/${m.level}.json`))) errors.push(`${m.level}: falta vocabulario`);
      if (ready === m.modules.length && !Object.keys(exams).some((p) => p.endsWith(`/${m.level}.json`))) errors.push(`${m.level}: faltan pools de examen final`);
    }
    expect(errors).toEqual([]);
  });
});
