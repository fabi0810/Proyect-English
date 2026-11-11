/**
 * Validador del contenido educativo. Se ejecuta en `npm test`.
 * Comprueba estructura, referencias y coherencia de respuestas. No sustituye la revisión lingüística.
 */
import type {
  ComprehensionGroupExercise,
  ErrorType,
  ExamPools,
  Exercise,
  LevelManifest,
  ListeningActivity,
  Module,
  PlacementQuestion,
  Reading,
  Requirement,
  TranslationExercise,
  VocabWord,
  WritingTaskExercise,
} from '../../types/content';
import { LEVELS } from '../../types/content';
import { expandAll, PatternError } from '../exercises/patterns';
import { basicNormalize, buildAnswerSet, normalizedVariants } from '../exercises/normalize';
import { CATEGORY_LABELS, VERB_FORMS } from './taxonomy';
import { countWords } from '../../utils/text';

export const MIN_LESSON_QUIZ = 8;
export const MIN_MODULE_POOL = 30;

const SKILLS = new Set(['grammar', 'vocabulary', 'reading', 'listening', 'writing', 'translation', 'construction', 'comprehension']);

export interface ValidationContext {
  topics: Record<string, { label: string; lesson?: string }>;
  catalog: Record<string, ErrorType>;
  ids: Set<string>;
  errors: string[];
}

export function createContext(topics: ValidationContext['topics'], catalog: ValidationContext['catalog']): ValidationContext {
  return { topics, catalog, ids: new Set(), errors: [] };
}

function err(ctx: ValidationContext, where: string, msg: string) {
  ctx.errors.push(`${where}: ${msg}`);
}

function checkPatterns(ctx: ValidationContext, where: string, patterns: string[] | undefined, label = 'answers'): string[] {
  if (!patterns || patterns.length === 0) {
    err(ctx, where, `${label} vacío`);
    return [];
  }
  try {
    return expandAll(patterns);
  } catch (e) {
    err(ctx, where, e instanceof PatternError ? e.message : String(e));
    return [];
  }
}

function checkRegex(ctx: ValidationContext, where: string, reqs: Requirement[] | undefined) {
  for (const r of reqs ?? []) {
    try {
      new RegExp(r.pattern, 'i');
    } catch {
      err(ctx, where, `regex inválida en «${r.label}»: ${r.pattern}`);
    }
  }
}

function meets(text: string, reqs: Requirement[] | undefined): Requirement[] {
  return (reqs ?? []).filter((r) => {
    try {
      return !new RegExp(r.pattern, 'i').test(text);
    } catch {
      return true;
    }
  });
}

export function validateExercise(ctx: ValidationContext, ex: Exercise, where: string, opts: { inGroup?: boolean } = {}): void {
  const w = `${where} [${ex.id ?? '¿sin id?'}]`;
  if (!ex.id) err(ctx, where, 'ejercicio sin id');
  else if (ctx.ids.has(ex.id)) err(ctx, w, 'id duplicado');
  else ctx.ids.add(ex.id);
  if (!ex.topic || !ctx.topics[ex.topic]) err(ctx, w, `tema desconocido «${ex.topic}»`);
  if (!SKILLS.has(ex.skill)) err(ctx, w, `habilidad inválida «${ex.skill}»`);
  if (![1, 2, 3].includes(ex.difficulty)) err(ctx, w, 'dificultad debe ser 1, 2 o 3');
  if (!ex.explanation || ex.explanation.trim().length < 8) err(ctx, w, 'falta la explicación');
  if (ex.errorTag && !ctx.catalog[ex.errorTag]) err(ctx, w, `errorTag desconocido «${ex.errorTag}»`);

  switch (ex.type) {
    case 'multiple_choice': {
      if (!ex.question?.trim()) err(ctx, w, 'falta la pregunta');
      const texts = ex.options.map((o) => (typeof o === 'string' ? o : o.text));
      if (texts.length < 2) err(ctx, w, 'necesita al menos 2 opciones');
      if (new Set(texts.map((t) => t.trim().replace(/\s+/g, ' '))).size !== texts.length) err(ctx, w, 'opciones duplicadas');
      if (!(ex.answer >= 0 && ex.answer < texts.length)) err(ctx, w, 'answer fuera de rango');
      for (const o of ex.options) if (typeof o !== 'string' && o.error && !ctx.catalog[o.error]) err(ctx, w, `error de opción desconocido «${o.error}»`);
      break;
    }
    case 'fill_blank': {
      const gaps = (ex.text.match(/___/g) ?? []).length;
      if (gaps !== ex.blanks.length) err(ctx, w, `huecos (${gaps}) ≠ blanks (${ex.blanks.length})`);
      ex.blanks.forEach((b, i) => {
        const answers = checkPatterns(ctx, `${w} hueco ${i + 1}`, b.answers);
        const set = buildAnswerSet(answers);
        if (b.options) {
          const optSet = b.options.map((o) => normalizedVariants(o)).filter((v) => v.some((x) => set.has(x)));
          if (optSet.length !== 1) err(ctx, w, `hueco ${i + 1}: debe haber exactamente una opción correcta (hay ${optSet.length})`);
        }
        for (const [k, v] of Object.entries(b.feedback ?? {})) {
          if (normalizedVariants(k).some((x) => set.has(x))) err(ctx, w, `hueco ${i + 1}: el feedback «${k}» corresponde a una respuesta aceptada`);
          const m = /^@([\w-]+)/.exec(v);
          if (m && !ctx.catalog[m[1]]) err(ctx, w, `feedback con errorTag desconocido «${m[1]}»`);
        }
      });
      break;
    }
    case 'word_order': {
      if (ex.tokens.length < 3) err(ctx, w, 'necesita al menos 3 fichas');
      if (ex.tokens.some((t) => !t.trim() || t !== t.trim())) err(ctx, w, 'fichas vacías o con espacios');
      if (ex.answers) checkPatterns(ctx, w, ex.answers);
      break;
    }
    case 'sentence_building':
      if (!ex.cue?.trim()) err(ctx, w, 'falta la pista');
      checkPatterns(ctx, w, ex.answers);
      break;
    case 'error_correction': {
      const answers = checkPatterns(ctx, w, ex.answers);
      const set = buildAnswerSet(answers);
      if (normalizedVariants(ex.sentence).some((v) => set.has(v))) err(ctx, w, 'la oración con error coincide con una respuesta aceptada');
      break;
    }
    case 'translation':
      if (!ex.source?.trim()) err(ctx, w, 'falta el texto fuente');
      if (ex.direction !== 'en-es' && ex.direction !== 'es-en') err(ctx, w, 'direction inválida');
      checkPatterns(ctx, w, ex.answers);
      break;
    case 'error_identification': {
      if (ex.segments.length < 3) err(ctx, w, 'necesita al menos 3 segmentos');
      if (!(ex.errorIndex >= 0 && ex.errorIndex < ex.segments.length)) err(ctx, w, 'errorIndex fuera de rango');
      const corr = checkPatterns(ctx, w, ex.correction, 'correction');
      if (corr.some((c) => basicNormalize(c) === basicNormalize(ex.segments[ex.errorIndex] ?? ''))) err(ctx, w, 'la corrección es igual al segmento erróneo');
      break;
    }
    case 'matching': {
      if (ex.pairs.length < 3) err(ctx, w, 'necesita al menos 3 pares');
      const l = ex.pairs.map((p) => basicNormalize(p[0]));
      const r = ex.pairs.map((p) => basicNormalize(p[1]));
      if (new Set(l).size !== l.length || new Set(r).size !== r.length) err(ctx, w, 'elementos repetidos');
      break;
    }
    case 'true_false':
      if (!ex.statement?.trim()) err(ctx, w, 'falta el enunciado');
      if (typeof ex.answer !== 'boolean') err(ctx, w, 'answer debe ser booleano');
      break;
    case 'tense_identification':
      if (!ex.options.includes(ex.answer)) err(ctx, w, 'la respuesta no está entre las opciones');
      for (const o of ex.options) if (!VERB_FORMS[o]) err(ctx, w, `forma verbal desconocida «${o}»`);
      if (new Set(ex.options).size !== ex.options.length) err(ctx, w, 'opciones duplicadas');
      if (ex.highlight && !ex.sentence.includes(ex.highlight)) err(ctx, w, 'highlight no aparece en la oración');
      break;
    case 'open_answer':
      checkRegex(ctx, w, ex.requirements);
      if (!ex.sampleAnswers.length) err(ctx, w, 'faltan respuestas modelo');
      for (const s of ex.sampleAnswers) {
        const missing = meets(s, ex.requirements);
        if (missing.length) err(ctx, w, `la respuesta modelo «${s}» no cumple: ${missing.map((m) => m.label).join(', ')}`);
      }
      break;
    case 'writing_task':
      validateWritingTask(ctx, ex, w);
      break;
    case 'dictation':
      if (!ex.text?.trim()) err(ctx, w, 'falta el texto del dictado');
      break;
    case 'reading_comprehension':
    case 'listening_comprehension': {
      if (opts.inGroup) err(ctx, w, 'no se permiten grupos anidados');
      const g = ex as ComprehensionGroupExercise;
      if (!g.passage && !g.lines?.length && !g.audio) err(ctx, w, 'falta el texto o el audio');
      if (g.questions.length < 2) err(ctx, w, 'necesita al menos 2 preguntas');
      for (const q of g.questions) {
        if (!q.id?.startsWith(`${ex.id}-`)) err(ctx, w, `la subpregunta ${q.id} debe empezar por «${ex.id}-»`);
        validateExercise(ctx, { ...q, topic: q.topic ?? ex.topic, skill: q.skill ?? ex.skill, difficulty: q.difficulty ?? ex.difficulty } as Exercise, w, { inGroup: true });
      }
      break;
    }
    default:
      err(ctx, w, `tipo desconocido «${(ex as { type: string }).type}»`);
  }
}

function validateWritingTask(ctx: ValidationContext, t: WritingTaskExercise, w: string) {
  checkRegex(ctx, w, t.requirements);
  checkRegex(ctx, w, t.targetStructures);
  if (!(t.minWords > 0 && t.maxWords > t.minWords)) err(ctx, w, 'rango de palabras inválido');
  if (t.model) {
    const n = countWords(t.model);
    if (n < t.minWords || n > t.maxWords) err(ctx, w, `el modelo tiene ${n} palabras (fuera del rango ${t.minWords}–${t.maxWords})`);
    const missing = meets(t.model, [...t.requirements, ...(t.targetStructures ?? [])]);
    if (missing.length) err(ctx, w, `el modelo no cumple: ${missing.map((m) => m.label).join(', ')}`);
  }
}

export function validateModule(ctx: ValidationContext, mod: Module, summaryId: string, level: string): void {
  const w = `módulo ${summaryId}`;
  if (mod.id !== summaryId) err(ctx, w, `id del archivo (${mod.id}) ≠ manifiesto`);
  if (mod.level !== level) err(ctx, w, `nivel ${mod.level} ≠ ${level}`);
  if (!mod.objectives?.length) err(ctx, w, 'faltan objetivos');
  if (!mod.lessons?.length) err(ctx, w, 'sin lecciones');
  mod.lessons.forEach((l, i) => {
    const lw = `${w} › ${l.id}`;
    if (l.id !== `${mod.id}-l${i + 1}`) err(ctx, lw, `id esperado ${mod.id}-l${i + 1}`);
    if (!l.objective || !l.why || (l.learn?.length ?? 0) < 2) err(ctx, lw, 'introducción incompleta (objetivo, por qué, qué aprenderás)');
    if ((l.theory?.length ?? 0) < 3) err(ctx, lw, 'teoría insuficiente (mínimo 3 bloques)');
    if ((l.guided?.length ?? 0) < 4) err(ctx, lw, 'práctica guiada insuficiente (mínimo 4)');
    if ((l.independent?.length ?? 0) < 6) err(ctx, lw, 'práctica independiente insuficiente (mínimo 6)');
    if ((l.summary?.length ?? 0) < 3) err(ctx, lw, 'resumen insuficiente (mínimo 3 puntos)');
    if ((l.quiz?.length ?? 0) < MIN_LESSON_QUIZ) err(ctx, lw, `pool de evaluación insuficiente (mínimo ${MIN_LESSON_QUIZ})`);
    for (const b of l.theory) {
      if (b.type === 'table') b.rows.forEach((r, ri) => r.length !== b.headers.length && err(ctx, lw, `tabla «${b.title ?? ''}» fila ${ri + 1}: columnas ≠ encabezados`));
    }
    [...l.guided, ...l.independent, ...l.quiz].forEach((e) => validateExercise(ctx, e, lw));
  });
  (mod.integrative ?? []).forEach((e) => validateExercise(ctx, e, `${w} › integrador`));
  const pool = mod.lessons.reduce((s, l) => s + l.quiz.length, 0) + (mod.integrative?.length ?? 0);
  if (pool < MIN_MODULE_POOL) err(ctx, w, `pool de evaluación del módulo: ${pool} (< ${MIN_MODULE_POOL})`);
}

export function validateVocabulary(ctx: ValidationContext, words: VocabWord[], level: string): void {
  const seen = new Set<string>();
  const seenWord = new Set<string>();
  for (const v of words) {
    const w = `vocabulario ${level} [${v.id}]`;
    if (seen.has(v.id)) err(ctx, w, 'id duplicado');
    seen.add(v.id);
    const key = `${basicNormalize(v.word)}|${v.pos}`;
    if (seenWord.has(key)) err(ctx, w, `palabra repetida «${v.word}» (${v.pos})`);
    seenWord.add(key);
    if (v.level !== level) err(ctx, w, `nivel ${v.level} ≠ ${level}`);
    if (!CATEGORY_LABELS[v.category]) err(ctx, w, `categoría desconocida «${v.category}»`);
    for (const f of ['word', 'translation', 'ipa', 'example', 'exampleEs'] as const) if (!v[f]?.trim()) err(ctx, w, `falta ${f}`);
    const root = basicNormalize(v.word).split(' ')[0].slice(0, Math.max(3, Math.min(5, v.word.length - 1)));
    if (v.example && !basicNormalize(v.example).includes(root)) err(ctx, w, `el ejemplo no contiene «${v.word}»`);
  }
}

export function validateReading(ctx: ValidationContext, r: Reading): void {
  const w = `lectura ${r.id}`;
  if (!r.paragraphs.length) err(ctx, w, 'sin párrafos');
  for (const p of r.paragraphs)
    for (const s of p.sentences) {
      if (!s.en?.trim() || !s.es?.trim()) err(ctx, w, 'oración sin texto o sin traducción');
      for (const [form, tense] of s.verbs ?? []) {
        if (!VERB_FORMS[tense]) err(ctx, w, `tiempo verbal desconocido «${tense}»`);
        if (!s.en.includes(form)) err(ctx, w, `la forma «${form}» no aparece en «${s.en}»`);
      }
    }
  if (r.questions.length < 4) err(ctx, w, 'mínimo 4 preguntas');
  r.questions.forEach((q) => validateExercise(ctx, q, w));
}

export function validateListening(ctx: ValidationContext, a: ListeningActivity): void {
  const w = `listening ${a.id}`;
  if (!a.lines.length) err(ctx, w, 'sin líneas');
  for (const l of a.lines) if (!l.text?.trim()) err(ctx, w, 'línea vacía');
  if (a.questions.length < 3) err(ctx, w, 'mínimo 3 preguntas');
  a.questions.forEach((q) => validateExercise(ctx, q, w));
}

export function validateExamPools(ctx: ValidationContext, p: ExamPools): void {
  const w = `exámenes ${p.level}`;
  if (p.reading.length < 3) err(ctx, w, 'mínimo 3 lecturas de examen');
  if (p.listening.length < 3) err(ctx, w, 'mínimo 3 audios de examen');
  if (p.translation.length < 8) err(ctx, w, 'mínimo 8 traducciones de examen');
  if (p.writing.length < 3) err(ctx, w, 'mínimo 3 tareas de escritura de examen');
  [...p.reading, ...p.listening, ...p.translation, ...p.writing].forEach((e) => validateExercise(ctx, e as Exercise, w));
}

export function validateTranslations(ctx: ValidationContext, list: TranslationExercise[], level: string): void {
  list.forEach((t) => validateExercise(ctx, t, `traducción ${level}`));
}

export function validateWritingTasks(ctx: ValidationContext, list: WritingTaskExercise[], level: string): void {
  list.forEach((t) => validateExercise(ctx, t, `escritura ${level}`));
}

export function validatePlacement(ctx: ValidationContext, questions: PlacementQuestion[], manifests: LevelManifest[]): void {
  const moduleIds = new Set(manifests.flatMap((m) => m.modules.map((x) => x.id)));
  const ids = new Set<string>();
  for (const q of questions) {
    const w = `diagnóstico [${q.id}]`;
    if (ids.has(q.id)) err(ctx, w, 'id duplicado');
    ids.add(q.id);
    if (!LEVELS.includes(q.level)) err(ctx, w, 'nivel inválido');
    if (!moduleIds.has(q.module)) err(ctx, w, `módulo desconocido «${q.module}»`);
    if (!ctx.topics[q.topic]) err(ctx, w, `tema desconocido «${q.topic}»`);
    if (q.options.length < 3) err(ctx, w, 'mínimo 3 opciones');
    if (new Set(q.options.map(basicNormalize)).size !== q.options.length) err(ctx, w, 'opciones duplicadas');
    if (!(q.answer >= 0 && q.answer < q.options.length)) err(ctx, w, 'answer fuera de rango');
    if (!q.explanation?.trim()) err(ctx, w, 'falta la explicación');
  }
  for (const level of LEVELS) {
    const n = questions.filter((q) => q.level === level).length;
    if (n < 8) err(ctx, 'diagnóstico', `nivel ${level}: ${n} preguntas (mínimo 8)`);
  }
}
