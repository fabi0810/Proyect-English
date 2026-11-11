/** Respuesta "de manual" de cada ejercicio: se usa para comprobar que su propia clave se califica como correcta. */
import type { Exercise } from '../../types/content';
import type { Response } from '../../types/exercise';
import { canonicalAnswer } from '../exercises/patterns';

export function canonicalResponse(ex: Exercise): Response | undefined {
  switch (ex.type) {
    case 'multiple_choice':
      return { kind: 'choice', index: ex.answer };
    case 'fill_blank':
      return { kind: 'blanks', values: ex.blanks.map((b) => canonicalAnswer(b.answers)) };
    case 'word_order':
      return { kind: 'order', order: ex.tokens.map((_, i) => i) };
    case 'sentence_building':
    case 'error_correction':
    case 'translation':
      return { kind: 'text', value: canonicalAnswer(ex.answers) };
    case 'dictation':
      return { kind: 'text', value: ex.text };
    case 'open_answer':
      return { kind: 'text', value: ex.sampleAnswers[0] ?? '' };
    case 'writing_task':
      return ex.model ? { kind: 'text', value: ex.model } : undefined;
    case 'error_identification':
      return { kind: 'segment', index: ex.errorIndex, correction: canonicalAnswer(ex.correction) };
    case 'matching':
      return { kind: 'pairs', map: ex.pairs.map((_, i) => i) };
    case 'true_false':
      return { kind: 'bool', value: ex.answer };
    case 'tense_identification':
      return { kind: 'option', value: ex.answer };
    case 'reading_comprehension':
    case 'listening_comprehension':
      return { kind: 'group', answers: Object.fromEntries(ex.questions.map((q) => [q.id, canonicalResponse(q)])) };
  }
}
