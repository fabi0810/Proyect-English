import type { Exercise, ExerciseType, Level } from '../../types/content';

const PROMPTS: Record<ExerciseType, { es: string; en: string }> = {
  multiple_choice: { es: 'Elige la opción correcta.', en: 'Choose the correct option.' },
  fill_blank: { es: 'Completa los espacios en blanco.', en: 'Complete the gaps.' },
  word_order: { es: 'Ordena las palabras para formar una oración correcta.', en: 'Put the words in the correct order.' },
  sentence_building: { es: 'Construye una oración correcta con estos elementos.', en: 'Build a correct sentence with these elements.' },
  error_identification: { es: 'Toca la parte de la oración que contiene el error y escribe la corrección.', en: 'Find the mistake and correct it.' },
  error_correction: { es: 'Reescribe la oración corrigiendo el error.', en: 'Rewrite the sentence correctly.' },
  translation: { es: 'Traduce.', en: 'Translate.' },
  matching: { es: 'Relaciona cada elemento con su pareja.', en: 'Match the items.' },
  true_false: { es: '¿Verdadero o falso?', en: 'True or false?' },
  tense_identification: { es: '¿Qué forma verbal se usa en esta oración?', en: 'Which verb form is used in this sentence?' },
  open_answer: { es: 'Responde con una oración completa.', en: 'Answer with a complete sentence.' },
  writing_task: { es: 'Escribe un texto breve.', en: 'Write a short text.' },
  dictation: { es: 'Escucha y escribe exactamente lo que oyes.', en: 'Listen and write what you hear.' },
  reading_comprehension: { es: 'Lee el texto y responde las preguntas.', en: 'Read the text and answer the questions.' },
  listening_comprehension: { es: 'Escucha y responde las preguntas.', en: 'Listen and answer the questions.' },
};

export function usesEnglishInstructions(level?: Level): boolean {
  return level === 'B1' || level === 'B2';
}

export function defaultPrompt(ex: Exercise): string {
  if (ex.prompt) return ex.prompt;
  if (ex.type === 'translation') {
    const toEs = ex.direction === 'en-es';
    return usesEnglishInstructions(ex.level)
      ? `Translate into ${toEs ? 'Spanish' : 'English'}.`
      : `Traduce al ${toEs ? 'español' : 'inglés'}.`;
  }
  const p = PROMPTS[ex.type];
  return usesEnglishInstructions(ex.level) ? p.en : p.es;
}

export const TYPE_LABELS: Record<ExerciseType, string> = {
  multiple_choice: 'Selección múltiple',
  fill_blank: 'Completar espacios',
  word_order: 'Ordenar palabras',
  sentence_building: 'Construcción de oraciones',
  error_identification: 'Identificar errores',
  error_correction: 'Corrección gramatical',
  translation: 'Traducción',
  matching: 'Relacionar columnas',
  true_false: 'Verdadero o falso',
  tense_identification: 'Tiempos verbales',
  open_answer: 'Respuesta abierta',
  writing_task: 'Escritura',
  dictation: 'Dictado',
  reading_comprehension: 'Comprensión lectora',
  listening_comprehension: 'Comprensión auditiva',
};
