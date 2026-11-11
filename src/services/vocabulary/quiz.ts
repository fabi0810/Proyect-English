/** Generación verificable de preguntas de vocabulario a partir del banco. */
import type { MultipleChoiceExercise, VocabWord } from '../../types/content';
import { basicNormalize, stripAccents } from '../exercises/normalize';
import { shuffle } from '../../utils/random';

function key(s: string): string {
  return stripAccents(basicNormalize(s));
}

/** Dos palabras son "confundibles" si comparten forma o significado (no sirven como distractores). */
export function overlaps(a: VocabWord, b: VocabWord): boolean {
  if (key(a.word) === key(b.word)) return true;
  const ta = key(a.translation).split(/\s*[,/;]\s*|\s+o\s+/);
  const tb = key(b.translation).split(/\s*[,/;]\s*|\s+o\s+/);
  return ta.some((x) => tb.some((y) => x === y || (x.length > 3 && (y.includes(x) || x.includes(y)))));
}

export function pickDistractors(word: VocabWord, bank: VocabWord[], n: number, rng: () => number): VocabWord[] {
  const pos = bank.filter((w) => w.id !== word.id && !overlaps(w, word));
  const sameCat = shuffle(pos.filter((w) => w.category === word.category && w.pos === word.pos), rng);
  const sameCatAny = shuffle(pos.filter((w) => w.category === word.category && w.pos !== word.pos), rng);
  const samePos = shuffle(pos.filter((w) => w.category !== word.category && w.pos === word.pos), rng);
  const out: VocabWord[] = [];
  for (const w of [...sameCat, ...samePos, ...sameCatAny]) {
    if (out.length >= n) break;
    if (out.some((o) => overlaps(o, w))) continue;
    out.push(w);
  }
  return out;
}

export function vocabQuestion(word: VocabWord, bank: VocabWord[], direction: 'en-es' | 'es-en', rng: () => number): MultipleChoiceExercise | null {
  const distractors = pickDistractors(word, bank, 3, rng);
  if (distractors.length < 3) return null;
  const all = shuffle([word, ...distractors], rng);
  const answer = all.findIndex((w) => w.id === word.id);
  const toEs = direction === 'en-es';
  return {
    id: `vq-${word.id}-${direction}`,
    type: 'multiple_choice',
    topic: `vocab-${word.category}`,
    skill: 'vocabulary',
    difficulty: toEs ? 1 : 2,
    level: word.level,
    pool: 'vocab',
    prompt: toEs ? '¿Qué significa esta palabra?' : '¿Cómo se dice en inglés?',
    question: toEs ? word.word : word.translation,
    options: all.map((w) => ({
      text: toEs ? w.translation : w.word,
      why: w.id === word.id ? undefined : toEs ? `«${w.translation}» se dice «${w.word}».` : `«${w.word}» significa «${w.translation}».`,
    })),
    answer,
    explanation: `«${word.word}» significa «${word.translation}». Ejemplo: ${word.example} — ${word.exampleEs}`,
    audio: toEs ? word.word : undefined,
  };
}

export function generateVocabQuestions(words: VocabWord[], bank: VocabWord[], count: number, rng: () => number): MultipleChoiceExercise[] {
  const out: MultipleChoiceExercise[] = [];
  for (const w of shuffle(words, rng)) {
    if (out.length >= count) break;
    const q = vocabQuestion(w, bank, rng() < 0.5 ? 'en-es' : 'es-en', rng);
    if (q) out.push(q);
  }
  return out;
}
