import { describe, expect, it } from 'vitest';
import type { Exercise } from '../../types/content';
import { expandPattern, PatternError } from './patterns';
import { normalizedVariants, textsMatch } from './normalize';
import { gradeExercise, isResponseComplete } from './grade';

describe('expandPattern', () => {
  it('expande alternativas y opcionales', () => {
    expect(expandPattern('I {usually|normally} walk')).toEqual(['I usually walk', 'I normally walk']);
    expect(expandPattern('I am 20 [years old].')).toEqual(['I am 20.', 'I am 20 years old.']);
    expect(expandPattern("{It's|It is} [{very|really}] cold")).toHaveLength(6);
  });
  it('rechaza patrones mal formados', () => {
    expect(() => expandPattern('I {am|is')).toThrow(PatternError);
    expect(() => expandPattern('I am]')).toThrow(PatternError);
    expect(() => expandPattern('a|b')).toThrow(PatternError);
  });
});

describe('normalización', () => {
  it('trata contracciones y puntuación como equivalentes', () => {
    expect(textsMatch("She doesn't like coffee.", 'she does not like coffee')).toBe(true);
    expect(textsMatch("I'm from Peru", 'I am from Peru!')).toBe(true);
    expect(textsMatch("He can't swim", 'He cannot swim')).toBe(true);
    expect(textsMatch("It's raining", 'It is raining')).toBe(true);
    expect(textsMatch("She's got a cat", 'She has got a cat')).toBe(true);
  });
  it('no confunde el posesivo con una contracción', () => {
    expect(normalizedVariants("Ana's brother")).toEqual(["ana's brother"]);
  });
  it('compara sin tildes por defecto y con tildes si se pide', () => {
    expect(textsMatch('está aquí', 'esta aqui')).toBe(true);
    expect(textsMatch('está', 'esta', { accents: true })).toBe(false);
  });
});

const mc: Exercise = {
  id: 't-mc',
  type: 'multiple_choice',
  topic: 'third-person-s',
  skill: 'grammar',
  difficulty: 1,
  question: 'She ___ to school every day.',
  options: [
    { text: 'go', why: 'Falta la -s.', error: 'third-person-s' },
    'goes',
    { text: 'going', why: 'Necesita be.' },
    { text: 'went', why: 'Es pasado.' },
  ],
  answer: 1,
  explanation: 'Con she el verbo lleva -s: goes.',
};

describe('gradeExercise', () => {
  it('selección múltiple con feedback por opción', () => {
    const ok = gradeExercise(mc, { kind: 'choice', index: 1 });
    expect(ok.verdict).toBe('correct');
    const bad = gradeExercise(mc, { kind: 'choice', index: 0 });
    expect(bad.verdict).toBe('incorrect');
    expect(bad.errorTags).toContain('third-person-s');
    expect(bad.messages[0].text).toBe('Falta la -s.');
    expect(bad.optionNotes?.filter((o) => o.why)).toHaveLength(3);
  });

  it('completar huecos con crédito parcial y feedback específico', () => {
    const ex: Exercise = {
      id: 't-fb',
      type: 'fill_blank',
      topic: 'be-affirmative',
      skill: 'grammar',
      difficulty: 1,
      text: 'I ___ a student and she ___ a teacher.',
      blanks: [{ answers: ['am'] }, { answers: ['is'], feedback: { are: '@be-agreement' } }],
      explanation: 'I am / she is.',
    };
    const r = gradeExercise(ex, { kind: 'blanks', values: ['am', 'are'] });
    expect(r.score).toBe(0.5);
    expect(r.verdict).toBe('partial');
    expect(r.errorTags).toEqual(['be-agreement']);
    expect(gradeExercise(ex, { kind: 'blanks', values: ['AM', ' is '] }).verdict).toBe('correct');
  });

  it('ordenar palabras acepta órdenes alternativos', () => {
    const ex: Exercise = {
      id: 't-wo',
      type: 'word_order',
      topic: 'frequency-adverbs',
      skill: 'construction',
      difficulty: 2,
      tokens: ['sometimes', 'I', 'walk', 'to', 'work'],
      answers: ['I sometimes walk to work'],
      explanation: '…',
    };
    expect(gradeExercise(ex, { kind: 'order', order: [0, 1, 2, 3, 4] }).verdict).toBe('correct');
    expect(gradeExercise(ex, { kind: 'order', order: [1, 0, 2, 3, 4] }).verdict).toBe('correct');
    expect(gradeExercise(ex, { kind: 'order', order: [1, 2, 0, 3, 4] }).verdict).toBe('incorrect');
  });

  it('traducción: patrones, tildes, erratas y conceptos clave', () => {
    const toEs: Exercise = {
      id: 't-tr1',
      type: 'translation',
      direction: 'en-es',
      topic: 'be-expressions',
      skill: 'translation',
      difficulty: 1,
      source: 'I am hungry.',
      answers: ['{Tengo|Yo tengo} hambre.'],
      keyConcepts: [['hambre']],
      explanation: '…',
    };
    expect(gradeExercise(toEs, { kind: 'text', value: 'yo tengo hambre' }).verdict).toBe('correct');
    const toEn: Exercise = {
      id: 't-tr2',
      type: 'translation',
      direction: 'es-en',
      topic: 'present-simple-form',
      skill: 'translation',
      difficulty: 2,
      source: 'Mi hermana trabaja en un hospital grande.',
      answers: ['My sister works in a big hospital.', 'My sister works at a big hospital.'],
      keyConcepts: [['sister'], ['works'], ['hospital']],
      explanation: '…',
    };
    expect(gradeExercise(toEn, { kind: 'text', value: 'My sister works in a big hospital' }).verdict).toBe('correct');
    expect(gradeExercise(toEn, { kind: 'text', value: 'My sister works in a big hospitl' }).verdict).toBe('accepted_with_note');
    const partial = gradeExercise(toEn, { kind: 'text', value: 'My sister works in a hospital that is big' });
    expect(partial.verdict).toBe('partial');
    expect(gradeExercise(toEn, { kind: 'text', value: 'My sister work in a big hospital' }).verdict).not.toBe('correct');
  });

  it('identificación de errores en dos pasos', () => {
    const ex: Exercise = {
      id: 't-ei',
      type: 'error_identification',
      topic: 'third-person-s',
      skill: 'grammar',
      difficulty: 2,
      segments: ['My brother', 'play', 'football', 'on Sundays.'],
      errorIndex: 1,
      correction: ['plays'],
      explanation: '…',
    };
    expect(gradeExercise(ex, { kind: 'segment', index: 1, correction: 'plays' }).score).toBe(1);
    expect(gradeExercise(ex, { kind: 'segment', index: 1, correction: 'playing' }).score).toBe(0.5);
    expect(gradeExercise(ex, { kind: 'segment', index: 2, correction: 'plays' }).score).toBe(0);
  });

  it('relacionar columnas con crédito parcial', () => {
    const ex: Exercise = {
      id: 't-m',
      type: 'matching',
      topic: 'greetings',
      skill: 'vocabulary',
      difficulty: 1,
      pairs: [
        ['Hello', 'Hola'],
        ['Goodbye', 'Adiós'],
        ['Thanks', 'Gracias'],
        ['Please', 'Por favor'],
      ],
      explanation: '…',
    };
    expect(gradeExercise(ex, { kind: 'pairs', map: [0, 1, 3, 2] }).score).toBe(0.5);
    expect(isResponseComplete(ex, { kind: 'pairs', map: [0, 1, null, 2] })).toBe(false);
  });

  it('grupo de comprensión califica cada subpregunta', () => {
    const ex: Exercise = {
      id: 't-g',
      type: 'reading_comprehension',
      topic: 'reading-detail',
      skill: 'reading',
      difficulty: 1,
      passage: 'Tom is a teacher. He lives in Leeds.',
      explanation: '…',
      questions: [
        { id: 't-g-1', type: 'true_false', topic: 'reading-detail', skill: 'reading', difficulty: 1, statement: 'Tom is a doctor.', answer: false, explanation: 'Es profesor.' },
        { ...(mc as Exercise), id: 't-g-2' },
      ],
    };
    const r = gradeExercise(ex, { kind: 'group', answers: { 't-g-1': { kind: 'bool', value: false }, 't-g-2': { kind: 'choice', index: 0 } } });
    expect(r.score).toBe(0.5);
    expect(r.sub).toHaveLength(2);
  });

  it('dictado mide precisión por palabra', () => {
    const ex: Exercise = { id: 't-d', type: 'dictation', topic: 'listening-detail', skill: 'listening', difficulty: 1, text: 'She works in a bank.', explanation: '…' };
    expect(gradeExercise(ex, { kind: 'text', value: 'she works in a bank' }).verdict).toBe('correct');
    const r = gradeExercise(ex, { kind: 'text', value: 'she work in a bank' });
    expect(r.verdict).toBe('partial');
    expect(r.score).toBeCloseTo(0.8);
  });

  it('respuesta vacía = incorrecta', () => {
    expect(gradeExercise(mc, undefined).verdict).toBe('incorrect');
  });
});

describe('equivalencias de formato', () => {
  it('a.m. / am y p.m. / pm', () => {
    expect(textsMatch('It opens at 9 a.m.', 'it opens at 9 am')).toBe(true);
    expect(textsMatch('8 P.M.', '8 pm')).toBe(true);
  });
});
