/**
 * Corrección determinista de los 15 tipos de ejercicio.
 * Cada función devuelve un GradeResult con puntuación (0..1), veredicto y explicaciones en español.
 */
import type {
  ChoiceOption,
  ComprehensionGroupExercise,
  DictationExercise,
  ErrorIdentificationExercise,
  Exercise,
  FillBlankExercise,
  MatchingExercise,
  MultipleChoiceExercise,
  OpenAnswerExercise,
  TenseIdentificationExercise,
  TranslationExercise,
  WordOrderExercise,
  WritingTaskExercise,
} from '../../types/content';
import type { DiffToken, FeedbackMessage, GradeResult, Response, Verdict } from '../../types/exercise';
import { catalogText, errorCatalog } from '../content/catalog';
import { VERB_FORMS } from '../content/taxonomy';
import { analyzeWriting, safeRegex } from '../writing/analyze';
import { checkText } from '../writing/checker';
import { capitalizeFirst, countWords } from '../../utils/text';
import { canonicalAnswer, expandAll } from './patterns';
import {
  basicNormalize,
  buildAnswerSet,
  diffWords,
  levenshtein,
  normalize,
  normalizedVariants,
  stripAccents,
  wordDistance,
} from './normalize';

/* ───────── utilidades ───────── */

export function toOption(o: string | ChoiceOption): ChoiceOption {
  return typeof o === 'string' ? { text: o } : o;
}

function verdictFromScore(score: number): Verdict {
  if (score >= 0.999) return 'correct';
  if (score > 0) return 'partial';
  return 'incorrect';
}

/** Texto de feedback: "@tag" usa el catálogo; "@tag|texto" combina ambos. */
export function resolveFeedback(value: string): { text: string; tag?: string } {
  const m = /^@([\w-]+)(?:\|([\s\S]*))?$/.exec(value);
  if (!m) return { text: value };
  const tag = m[1];
  const specific = m[2]?.trim();
  const base = catalogText(tag) ?? '';
  return { text: specific ? `${specific} ${base}`.trim() : base, tag };
}

function explanationMessage(ex: Exercise): FeedbackMessage {
  return { tone: 'info', text: ex.explanation };
}

function catalogMessage(tag?: string): FeedbackMessage[] {
  if (!tag || !errorCatalog[tag]) return [];
  return [{ tone: 'error', text: catalogText(tag) as string, errorTag: tag }];
}

export function fillText(text: string, values: string[]): string {
  let i = 0;
  return text.replace(/___/g, () => {
    const v = values[i++];
    return v && v.trim() ? v.trim() : '___';
  });
}

export function wordOrderSentence(ex: WordOrderExercise, order?: number[]): string {
  const tokens = order ? order.map((i) => ex.tokens[i]) : ex.tokens;
  return capitalizeFirst(tokens.join(' ')) + (ex.punctuation ?? '.');
}

function unanswered(ex: Exercise): GradeResult {
  return {
    exerciseId: ex.id,
    score: 0,
    verdict: 'incorrect',
    expected: expectedAnswer(ex),
    responseText: '',
    messages: [{ tone: 'error', text: 'Sin responder.' }, explanationMessage(ex)],
    errorTags: ex.errorTag ? [ex.errorTag] : [],
  };
}

/** Respuesta modelo para mostrar. */
export function expectedAnswer(ex: Exercise): string {
  switch (ex.type) {
    case 'multiple_choice':
      return toOption(ex.options[ex.answer]).text;
    case 'fill_blank':
      return fillText(ex.text, ex.blanks.map((b) => canonicalAnswer(b.answers)));
    case 'word_order':
      return wordOrderSentence(ex);
    case 'sentence_building':
    case 'error_correction':
    case 'translation':
      return canonicalAnswer(ex.answers);
    case 'error_identification':
      return ex.segments.map((s, i) => (i === ex.errorIndex ? canonicalAnswer(ex.correction) : s)).join(' ');
    case 'matching':
      return ex.pairs.map(([l, r]) => `${l} → ${r}`).join(' · ');
    case 'true_false':
      return ex.answer ? 'Verdadero (True)' : 'Falso (False)';
    case 'tense_identification':
      return VERB_FORMS[ex.answer]?.label ?? ex.answer;
    case 'open_answer':
      return ex.sampleAnswers[0] ?? '';
    case 'writing_task':
      return ex.model ?? '';
    case 'dictation':
      return ex.text;
    case 'reading_comprehension':
    case 'listening_comprehension':
      return '';
  }
}

/* ───────── comparación de texto ───────── */

interface TextGradeOptions {
  lang: 'en' | 'es';
  mode: 'strict' | 'translation';
  keyConcepts?: string[][];
}

function closestAnswer(given: string, answers: string[]): { answer: string; distance: number } {
  const g = basicNormalize(given).split(' ').filter(Boolean);
  let best = { answer: answers[0] ?? '', distance: Number.POSITIVE_INFINITY };
  for (const a of answers) {
    const d = wordDistance(g, basicNormalize(a).split(' ').filter(Boolean));
    if (d < best.distance) best = { answer: a, distance: d };
  }
  return best;
}

function buildDiff(given: string, expected: string): DiffToken[] {
  const g = basicNormalize(given).split(' ').filter(Boolean);
  const e = basicNormalize(expected).split(' ').filter(Boolean);
  return diffWords(g, e).map((op) => {
    if (op.op === 'ok') return { text: op.given as string, status: 'ok' as const };
    if (op.op === 'extra') return { text: op.given as string, status: 'extra' as const };
    if (op.op === 'missing') return { text: op.expected as string, status: 'missing' as const };
    return { text: op.given as string, status: 'wrong' as const, expected: op.expected };
  });
}

/** ¿Las diferencias son solo erratas menores? */
function onlyMinorTypos(diff: DiffToken[]): { ok: boolean; typos: DiffToken[] } {
  const wrong = diff.filter((d) => d.status === 'wrong');
  const missingOrExtra = diff.some((d) => d.status === 'missing' || d.status === 'extra');
  const words = diff.length;
  const maxTypos = words >= 8 ? 2 : words >= 5 ? 1 : 0;
  const ok =
    !missingOrExtra &&
    wrong.length > 0 &&
    wrong.length <= maxTypos &&
    wrong.every((d) => {
      const exp = d.expected ?? '';
      const dist = levenshtein(stripAccents(d.text), stripAccents(exp));
      return exp.length >= 4 && dist <= (exp.length > 6 ? 2 : 1);
    });
  return { ok, typos: wrong };
}

function conceptsMet(given: string, groups: string[][]): boolean {
  const norm = ` ${normalize(given)} `;
  return groups.every((group) => group.some((form) => norm.includes(` ${normalize(form)} `)));
}

export function gradeTextAnswer(
  exId: string,
  given: string,
  patterns: string[],
  opts: TextGradeOptions,
): Omit<GradeResult, 'messages' | 'errorTags'> & { messages: FeedbackMessage[] } {
  const answers = expandAll(patterns);
  const expected = answers[0] ?? '';
  const base = { exerciseId: exId, expected, responseText: given };
  if (!given.trim()) return { ...base, score: 0, verdict: 'incorrect', messages: [{ tone: 'error', text: 'Sin responder.' }] };

  const keepAccents = opts.lang === 'es';
  const exactSet = buildAnswerSet(answers, { accents: keepAccents });
  if (normalizedVariants(given, { accents: keepAccents }).some((v) => exactSet.has(v))) {
    const matched = normalizedVariants(given, { accents: keepAccents }).map((v) => exactSet.get(v)).find(Boolean);
    const alternatives = answers.filter((a) => a !== matched).slice(0, 4);
    return { ...base, score: 1, verdict: 'correct', messages: [], alternatives };
  }
  if (keepAccents) {
    const looseSet = buildAnswerSet(answers);
    const hit = normalizedVariants(given).map((v) => looseSet.get(v)).find(Boolean);
    if (hit) {
      return {
        ...base,
        score: 1,
        verdict: 'accepted_with_note',
        messages: [{ tone: 'note', text: `Correcto en significado. Revisa las tildes: «${hit}».` }],
        alternatives: answers.filter((a) => a !== hit).slice(0, 4),
      };
    }
  }

  const closest = closestAnswer(given, answers);
  const diff = buildDiff(given, closest.answer);
  const messages: FeedbackMessage[] = [];

  if (opts.mode === 'translation') {
    const typos = onlyMinorTypos(diff);
    if (typos.ok) {
      const list = typos.typos.map((t) => `«${t.text}» → «${t.expected}»`).join(', ');
      return {
        ...base,
        expected: closest.answer,
        score: 1,
        verdict: 'accepted_with_note',
        diff,
        messages: [{ tone: 'note', text: `Traducción correcta con una errata menor: ${list}.` }],
        alternatives: answers.filter((a) => a !== closest.answer).slice(0, 4),
      };
    }
    if (opts.keyConcepts && opts.keyConcepts.length > 0 && conceptsMet(given, opts.keyConcepts)) {
      return {
        ...base,
        expected: closest.answer,
        score: 0.5,
        verdict: 'partial',
        diff,
        messages: [
          {
            tone: 'note',
            text: 'Tu traducción contiene las ideas clave, pero la forma no coincide con las respuestas aceptadas. Compárala con la versión modelo.',
          },
        ],
        alternatives: answers.filter((a) => a !== closest.answer).slice(0, 4),
      };
    }
  } else {
    const dist = levenshtein(normalize(given), normalize(closest.answer));
    if (dist > 0 && dist <= 2) messages.push({ tone: 'note', text: 'Casi: revisa la ortografía o la forma exacta de las palabras.' });
  }
  return {
    ...base,
    expected: closest.answer,
    score: 0,
    verdict: 'incorrect',
    diff,
    messages,
    alternatives: answers.filter((a) => a !== closest.answer).slice(0, 4),
  };
}

/* ───────── por tipo ───────── */

function gradeMultipleChoice(ex: MultipleChoiceExercise, index: number): GradeResult {
  const opts = ex.options.map(toOption);
  const correct = index === ex.answer;
  const chosen = opts[index];
  const messages: FeedbackMessage[] = [];
  const tags: string[] = [];
  if (correct) {
    messages.push({ tone: 'success', text: ex.explanation });
  } else {
    if (chosen?.why) messages.push({ tone: 'error', text: chosen.why, errorTag: chosen.error });
    else messages.push(...catalogMessage(chosen?.error ?? ex.errorTag));
    messages.push(explanationMessage(ex));
    const tag = chosen?.error ?? ex.errorTag;
    if (tag) tags.push(tag);
  }
  return {
    exerciseId: ex.id,
    score: correct ? 1 : 0,
    verdict: correct ? 'correct' : 'incorrect',
    expected: opts[ex.answer].text,
    responseText: chosen?.text ?? '',
    messages,
    errorTags: tags,
    optionNotes: opts.map((o, i) => ({ text: o.text, why: o.why, correct: i === ex.answer, chosen: i === index })),
  };
}

function gradeFillBlank(ex: FillBlankExercise, values: string[]): GradeResult {
  const messages: FeedbackMessage[] = [];
  const tags = new Set<string>();
  const parts = ex.blanks.map((b, i) => {
    const given = (values[i] ?? '').trim();
    const answers = expandAll(b.answers);
    const set = buildAnswerSet(answers);
    const ok = given.length > 0 && normalizedVariants(given).some((v) => set.has(v));
    if (!ok) {
      const key = basicNormalize(given);
      const fb = b.feedback?.[key];
      if (fb) {
        const r = resolveFeedback(fb);
        messages.push({ tone: 'error', text: `«${given}»: ${r.text}`, errorTag: r.tag });
        if (r.tag) tags.add(r.tag);
      } else if (given) {
        const near = answers.some((a) => {
          const d = levenshtein(normalize(given), normalize(a));
          return d > 0 && d <= (a.length > 5 ? 2 : 1);
        });
        if (near) messages.push({ tone: 'note', text: `«${given}»: casi; revisa la ortografía.` });
        if (ex.errorTag) tags.add(ex.errorTag);
      } else if (ex.errorTag) tags.add(ex.errorTag);
    }
    return { label: `Hueco ${i + 1}`, correct: ok, given: given || '—', expected: answers[0] ?? '' };
  });
  const okCount = parts.filter((p) => p.correct).length;
  const score = okCount / Math.max(ex.blanks.length, 1);
  const verdict = verdictFromScore(score);
  if (verdict === 'correct') messages.unshift({ tone: 'success', text: ex.explanation });
  else messages.push(explanationMessage(ex));
  return {
    exerciseId: ex.id,
    score,
    verdict,
    expected: expectedAnswer(ex),
    responseText: fillText(ex.text, values),
    messages,
    errorTags: verdict === 'correct' ? [] : Array.from(tags),
    parts: ex.blanks.length > 1 ? parts : undefined,
  };
}

function gradeWordOrder(ex: WordOrderExercise, order: number[]): GradeResult {
  const sentence = order.map((i) => ex.tokens[i]).join(' ');
  const expected = wordOrderSentence(ex);
  const complete = order.length === ex.tokens.length;
  const accepted = [ex.tokens.join(' '), ...expandAll(ex.answers ?? [])];
  const set = buildAnswerSet(accepted);
  const ok = complete && normalizedVariants(sentence).some((v) => set.has(v));
  const messages: FeedbackMessage[] = [];
  if (ok) messages.push({ tone: 'success', text: ex.explanation });
  else {
    if (!complete) messages.push({ tone: 'error', text: 'Debes usar todas las palabras.' });
    messages.push(...catalogMessage(ex.errorTag));
    messages.push(explanationMessage(ex));
  }
  return {
    exerciseId: ex.id,
    score: ok ? 1 : 0,
    verdict: ok ? 'correct' : 'incorrect',
    expected,
    responseText: sentence ? capitalizeFirst(sentence) : '',
    messages,
    errorTags: ok ? [] : [ex.errorTag ?? 'word-order'],
    diff: ok ? undefined : buildDiff(sentence, ex.tokens.join(' ')),
  };
}

function gradeTextType(ex: Exercise & { answers: string[] }, given: string, opts: TextGradeOptions): GradeResult {
  const r = gradeTextAnswer(ex.id, given, ex.answers, opts);
  const messages = [...r.messages];
  const ok = r.verdict === 'correct' || r.verdict === 'accepted_with_note';
  if (ok) messages.unshift({ tone: 'success', text: ex.explanation });
  else {
    messages.push(...catalogMessage(ex.errorTag));
    messages.push(explanationMessage(ex));
  }
  return { ...r, messages, errorTags: ok ? [] : ex.errorTag ? [ex.errorTag] : [] };
}

function gradeErrorIdentification(ex: ErrorIdentificationExercise, index: number | null, correction: string): GradeResult {
  const idOk = index === ex.errorIndex;
  const answers = expandAll(ex.correction);
  const set = buildAnswerSet(answers);
  const corrOk = idOk && correction.trim().length > 0 && normalizedVariants(correction).some((v) => set.has(v));
  const score = (idOk ? 0.5 : 0) + (corrOk ? 0.5 : 0);
  const messages: FeedbackMessage[] = [];
  if (!idOk) {
    messages.push({ tone: 'error', text: `El error está en «${ex.segments[ex.errorIndex]}».` });
  } else if (!corrOk) {
    messages.push({ tone: 'note', text: `Localizaste el error, pero la corrección debía ser «${answers[0]}».` });
  }
  if (score === 1) messages.unshift({ tone: 'success', text: ex.explanation });
  else {
    messages.push(...catalogMessage(ex.errorTag));
    messages.push(explanationMessage(ex));
  }
  return {
    exerciseId: ex.id,
    score,
    verdict: verdictFromScore(score),
    expected: expectedAnswer(ex),
    responseText: index === null ? '' : `${ex.segments[index]}${correction ? ` → ${correction}` : ''}`,
    messages,
    errorTags: score === 1 ? [] : ex.errorTag ? [ex.errorTag] : [],
    parts: [
      { label: 'Localizar el error', correct: idOk, given: index === null ? '—' : ex.segments[index], expected: ex.segments[ex.errorIndex] },
      { label: 'Corrección', correct: corrOk, given: correction || '—', expected: answers[0] ?? '' },
    ],
  };
}

function gradeMatching(ex: MatchingExercise, map: (number | null)[]): GradeResult {
  const parts = ex.pairs.map(([left, right], i) => {
    const chosen = map[i];
    return {
      label: left,
      correct: chosen === i,
      given: chosen === null || chosen === undefined ? '—' : ex.pairs[chosen][1],
      expected: right,
    };
  });
  const score = parts.filter((p) => p.correct).length / Math.max(parts.length, 1);
  const verdict = verdictFromScore(score);
  return {
    exerciseId: ex.id,
    score,
    verdict,
    expected: expectedAnswer(ex),
    responseText: parts.map((p) => `${p.label} → ${p.given}`).join(' · '),
    messages: verdict === 'correct' ? [{ tone: 'success', text: ex.explanation }] : [explanationMessage(ex)],
    errorTags: verdict === 'correct' ? [] : ex.errorTag ? [ex.errorTag] : [],
    parts,
  };
}

function gradeTense(ex: TenseIdentificationExercise, value: string): GradeResult {
  const ok = value === ex.answer;
  return {
    exerciseId: ex.id,
    score: ok ? 1 : 0,
    verdict: ok ? 'correct' : 'incorrect',
    expected: VERB_FORMS[ex.answer]?.label ?? ex.answer,
    responseText: VERB_FORMS[value]?.label ?? value,
    messages: ok ? [{ tone: 'success', text: ex.explanation }] : [explanationMessage(ex)],
    errorTags: ok ? [] : [ex.errorTag ?? 'verb-form-identification'],
  };
}

function gradeOpenAnswer(ex: OpenAnswerExercise, text: string): GradeResult {
  const words = countWords(text);
  const reqs = ex.requirements.map((r) => ({ r, ok: safeRegex(r.pattern).test(text) }));
  const lengthOk = (!ex.minWords || words >= ex.minWords) && (!ex.maxWords || words <= ex.maxWords);
  const issues = checkText(text).filter((i) => i.severity === 'error');
  const criteria = reqs.length + 2;
  const met = reqs.filter((x) => x.ok).length + (lengthOk ? 1 : 0) + (issues.length === 0 ? 1 : 0);
  const score = text.trim() ? met / criteria : 0;
  const messages: FeedbackMessage[] = [];
  for (const x of reqs) if (!x.ok) messages.push({ tone: 'error', text: x.r.feedback ?? `Falta: ${x.r.label}.` });
  if (!lengthOk) messages.push({ tone: 'note', text: `Extensión: ${words} palabras (se piden ${ex.minWords ?? 1}–${ex.maxWords ?? '∞'}).` });
  for (const i of issues) messages.push({ tone: 'error', text: `«${i.excerpt}»: ${i.message}`, errorTag: i.ruleId });
  messages.push(explanationMessage(ex));
  return {
    exerciseId: ex.id,
    score,
    verdict: verdictFromScore(score),
    expected: ex.sampleAnswers[0] ?? '',
    responseText: text,
    messages,
    errorTags: issues.map((i) => i.ruleId),
    alternatives: ex.sampleAnswers.slice(1),
    parts: [
      ...reqs.map((x) => ({ label: x.r.label, correct: x.ok, given: x.ok ? 'Sí' : 'No', expected: 'Sí' })),
      { label: 'Extensión adecuada', correct: lengthOk, given: `${words} palabras`, expected: `${ex.minWords ?? 1}–${ex.maxWords ?? '∞'}` },
      { label: 'Sin errores gramaticales detectados', correct: issues.length === 0, given: `${issues.length}`, expected: '0' },
    ],
  };
}

function gradeWritingTask(ex: WritingTaskExercise, text: string): GradeResult {
  const a = analyzeWriting(text, ex);
  const messages: FeedbackMessage[] = [];
  for (const r of a.requirements) if (!r.met) messages.push({ tone: 'error', text: r.feedback ?? `Falta: ${r.label}.` });
  for (const s of a.structures) if (!s.met) messages.push({ tone: 'note', text: s.feedback ?? `No se detectó la estructura: ${s.label}.` });
  for (const i of a.issues.filter((x) => x.severity !== 'style'))
    messages.push({ tone: i.severity === 'error' ? 'error' : 'note', text: `«${i.excerpt}»: ${i.message}`, errorTag: i.ruleId });
  messages.push(explanationMessage(ex));
  return {
    exerciseId: ex.id,
    score: a.score,
    verdict: verdictFromScore(a.score >= 0.85 ? 1 : a.score),
    expected: ex.model ?? '',
    responseText: text,
    messages,
    errorTags: a.issues.filter((i) => i.severity === 'error').map((i) => i.ruleId),
    parts: [
      { label: 'Cumplimiento de la tarea', correct: a.criteria.task >= 0.8, given: `${Math.round(a.criteria.task * 100)} %`, expected: '100 %' },
      { label: 'Corrección', correct: a.criteria.accuracy >= 0.8, given: `${Math.round(a.criteria.accuracy * 100)} %`, expected: '100 %' },
      { label: 'Organización', correct: a.criteria.organization >= 0.75, given: `${Math.round(a.criteria.organization * 100)} %`, expected: '100 %' },
      { label: 'Extensión', correct: a.criteria.length >= 1, given: `${a.wordCount} palabras`, expected: `${ex.minWords}–${ex.maxWords}` },
    ],
  };
}

function gradeDictation(ex: DictationExercise, given: string): GradeResult {
  const candidates = [ex.text, ...expandAll(ex.answers ?? [])];
  const g = normalize(given).split(' ').filter(Boolean);
  let best = { text: ex.text, dist: Number.POSITIVE_INFINITY, len: 1 };
  for (const c of candidates) {
    for (const v of normalizedVariants(c)) {
      const e = v.split(' ').filter(Boolean);
      const d = wordDistance(g, e);
      if (d < best.dist) best = { text: c, dist: d, len: e.length };
    }
  }
  const score = given.trim() ? Math.max(0, 1 - best.dist / Math.max(best.len, 1)) : 0;
  const verdict: Verdict = best.dist === 0 && given.trim() ? 'correct' : score >= 0.5 ? 'partial' : 'incorrect';
  return {
    exerciseId: ex.id,
    score: verdict === 'correct' ? 1 : score,
    verdict,
    expected: ex.text,
    responseText: given,
    messages:
      verdict === 'correct'
        ? [{ tone: 'success', text: ex.explanation }]
        : [{ tone: 'note', text: `Palabras con diferencias: ${best.dist}.` }, explanationMessage(ex)],
    errorTags: verdict === 'correct' ? [] : ['listening-detail'],
    diff: verdict === 'correct' ? undefined : buildDiff(given, best.text),
  };
}

function gradeGroup(ex: ComprehensionGroupExercise, answers: Record<string, Response | undefined>): GradeResult {
  const sub = ex.questions.map((q) => gradeExercise(q, answers[q.id]));
  const totalPoints = ex.questions.reduce((s, q) => s + (q.points ?? 1), 0);
  const got = ex.questions.reduce((s, q, i) => s + (q.points ?? 1) * sub[i].score, 0);
  const score = totalPoints ? got / totalPoints : 0;
  return {
    exerciseId: ex.id,
    score,
    verdict: verdictFromScore(score),
    expected: '',
    responseText: `${sub.filter((s) => s.verdict === 'correct' || s.verdict === 'accepted_with_note').length}/${sub.length} correctas`,
    messages: [],
    errorTags: Array.from(new Set(sub.flatMap((s) => s.errorTags))),
    sub,
  };
}

/* ───────── punto de entrada ───────── */

export function gradeExercise(ex: Exercise, resp: Response | undefined): GradeResult {
  if (!resp) return unanswered(ex);
  switch (ex.type) {
    case 'multiple_choice':
      return resp.kind === 'choice' ? gradeMultipleChoice(ex, resp.index) : unanswered(ex);
    case 'fill_blank':
      return resp.kind === 'blanks' ? gradeFillBlank(ex, resp.values) : unanswered(ex);
    case 'word_order':
      return resp.kind === 'order' && resp.order.length ? gradeWordOrder(ex, resp.order) : unanswered(ex);
    case 'sentence_building':
    case 'error_correction':
      return resp.kind === 'text' && resp.value.trim() ? gradeTextType(ex, resp.value, { lang: 'en', mode: 'strict' }) : unanswered(ex);
    case 'translation': {
      const t = ex as TranslationExercise;
      return resp.kind === 'text' && resp.value.trim()
        ? gradeTextType(t, resp.value, { lang: t.direction === 'en-es' ? 'es' : 'en', mode: 'translation', keyConcepts: t.keyConcepts })
        : unanswered(ex);
    }
    case 'error_identification':
      return resp.kind === 'segment' && resp.index !== null ? gradeErrorIdentification(ex, resp.index, resp.correction) : unanswered(ex);
    case 'matching':
      return resp.kind === 'pairs' ? gradeMatching(ex, resp.map) : unanswered(ex);
    case 'true_false': {
      if (resp.kind !== 'bool') return unanswered(ex);
      const ok = resp.value === ex.answer;
      return {
        exerciseId: ex.id,
        score: ok ? 1 : 0,
        verdict: ok ? 'correct' : 'incorrect',
        expected: expectedAnswer(ex),
        responseText: resp.value ? 'Verdadero' : 'Falso',
        messages: ok ? [{ tone: 'success', text: ex.explanation }] : [...catalogMessage(ex.errorTag), explanationMessage(ex)],
        errorTags: ok ? [] : ex.errorTag ? [ex.errorTag] : [],
      };
    }
    case 'tense_identification':
      return resp.kind === 'option' ? gradeTense(ex, resp.value) : unanswered(ex);
    case 'open_answer':
      return resp.kind === 'text' && resp.value.trim() ? gradeOpenAnswer(ex, resp.value) : unanswered(ex);
    case 'writing_task':
      return resp.kind === 'text' && resp.value.trim() ? gradeWritingTask(ex, resp.value) : unanswered(ex);
    case 'dictation':
      return resp.kind === 'text' && resp.value.trim() ? gradeDictation(ex, resp.value) : unanswered(ex);
    case 'reading_comprehension':
    case 'listening_comprehension':
      return resp.kind === 'group' ? gradeGroup(ex, resp.answers) : unanswered(ex);
  }
}

/** ¿Está la respuesta completa como para poder comprobarla? */
export function isResponseComplete(ex: Exercise, resp: Response | undefined): boolean {
  if (!resp) return false;
  switch (ex.type) {
    case 'fill_blank':
      return resp.kind === 'blanks' && ex.blanks.every((_, i) => (resp.values[i] ?? '').trim().length > 0);
    case 'word_order':
      return resp.kind === 'order' && resp.order.length === ex.tokens.length;
    case 'matching':
      return resp.kind === 'pairs' && resp.map.length === ex.pairs.length && resp.map.every((v) => v !== null && v !== undefined);
    case 'error_identification':
      return resp.kind === 'segment' && resp.index !== null && resp.correction.trim().length > 0;
    case 'reading_comprehension':
    case 'listening_comprehension':
      return resp.kind === 'group' && ex.questions.every((q) => isResponseComplete(q, resp.answers[q.id]));
    case 'multiple_choice':
      return resp.kind === 'choice';
    case 'true_false':
      return resp.kind === 'bool';
    case 'tense_identification':
      return resp.kind === 'option' && resp.value.length > 0;
    default:
      return resp.kind === 'text' && resp.value.trim().length > 0;
  }
}

/** Puntos máximos de un ejercicio (grupos: suma de subpreguntas). */
export function exercisePoints(ex: Exercise): number {
  if (ex.type === 'reading_comprehension' || ex.type === 'listening_comprehension')
    return ex.questions.reduce((s, q) => s + (q.points ?? 1), 0);
  return ex.points ?? 1;
}
