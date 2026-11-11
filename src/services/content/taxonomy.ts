import type { Level, ReadingGenre, Skill, VocabCategory } from '../../types/content';

/** Formas y tiempos verbales que se pueden identificar en ejercicios y lecturas. */
export const VERB_FORMS: Record<string, { label: string; level: Level; example: string }> = {
  'present-simple-be': { label: 'Presente de "to be"', level: 'A1', example: 'She is a nurse.' },
  'present-simple': { label: 'Presente simple', level: 'A1', example: 'He works at a bank.' },
  'present-simple-have-got': { label: 'Have got (posesión)', level: 'A1', example: "I've got two sisters." },
  'modal-can': { label: 'Modal "can"', level: 'A1', example: 'I can swim.' },
  imperative: { label: 'Imperativo', level: 'A1', example: 'Open your books.' },
  'would-like': { label: '"Would like" (petición cortés)', level: 'A1', example: "I'd like a coffee." },
  'present-continuous': { label: 'Presente continuo', level: 'A2', example: 'They are watching TV.' },
  'past-simple-be': { label: 'Pasado de "to be"', level: 'A2', example: 'We were tired.' },
  'past-simple': { label: 'Pasado simple', level: 'A2', example: 'She visited Rome.' },
  'future-will': { label: 'Futuro con "will"', level: 'A2', example: "I'll help you." },
  'future-going-to': { label: 'Futuro con "going to"', level: 'A2', example: "We're going to travel." },
  'present-perfect': { label: 'Presente perfecto', level: 'A2', example: "I've never been to Japan." },
  'past-continuous': { label: 'Pasado continuo', level: 'B1', example: 'It was raining.' },
  'present-perfect-continuous': { label: 'Presente perfecto continuo', level: 'B1', example: "I've been waiting for hours." },
  'past-perfect': { label: 'Pasado perfecto', level: 'B1', example: 'The film had started.' },
  'passive-present': { label: 'Pasiva (presente)', level: 'B1', example: 'English is spoken here.' },
  'passive-past': { label: 'Pasiva (pasado)', level: 'B1', example: 'The house was built in 1990.' },
  'past-perfect-continuous': { label: 'Pasado perfecto continuo', level: 'B2', example: 'She had been working all day.' },
  'future-continuous': { label: 'Futuro continuo', level: 'B2', example: "I'll be working at 9." },
  'future-perfect': { label: 'Futuro perfecto', level: 'B2', example: "They'll have finished by May." },
};

export const SKILL_LABELS: Record<Skill, string> = {
  grammar: 'Gramática',
  vocabulary: 'Vocabulario',
  reading: 'Lectura',
  listening: 'Comprensión auditiva',
  writing: 'Escritura',
  translation: 'Traducción',
  construction: 'Construcción de oraciones',
  comprehension: 'Comprensión del idioma',
};

export const CATEGORY_LABELS: Record<VocabCategory, string> = {
  basics: 'Basics',
  family: 'Family',
  food: 'Food',
  education: 'Education',
  work: 'Work',
  travel: 'Travel',
  health: 'Health',
  technology: 'Technology',
  transportation: 'Transportation',
  'daily-activities': 'Daily Activities',
  relationships: 'Relationships',
  shopping: 'Shopping',
  environment: 'Environment',
  entertainment: 'Entertainment',
  emotions: 'Emotions',
  business: 'Business',
};

export const CATEGORY_LABELS_ES: Record<VocabCategory, string> = {
  basics: 'Básico',
  family: 'Familia',
  food: 'Comida',
  education: 'Educación',
  work: 'Trabajo',
  travel: 'Viajes',
  health: 'Salud',
  technology: 'Tecnología',
  transportation: 'Transporte',
  'daily-activities': 'Actividades diarias',
  relationships: 'Relaciones',
  shopping: 'Compras',
  environment: 'Medio ambiente',
  entertainment: 'Entretenimiento',
  emotions: 'Emociones',
  business: 'Negocios',
};

export const GENRE_LABELS: Record<ReadingGenre, string> = {
  description: 'Descripción',
  story: 'Historia',
  conversation: 'Conversación',
  message: 'Mensaje',
  news: 'Noticia adaptada',
  informative: 'Texto informativo',
  academic: 'Texto académico',
};

export const LEVEL_META: Record<Level, { name: string; nameEs: string; color: string; soft: string; text: string }> = {
  A1: { name: 'Beginner', nameEs: 'Principiante', color: 'bg-lvl-a1', soft: 'bg-lvl-a1-soft', text: 'text-lvl-a1' },
  A2: { name: 'Elementary', nameEs: 'Elemental', color: 'bg-lvl-a2', soft: 'bg-lvl-a2-soft', text: 'text-lvl-a2' },
  B1: { name: 'Intermediate', nameEs: 'Intermedio', color: 'bg-lvl-b1', soft: 'bg-lvl-b1-soft', text: 'text-lvl-b1' },
  B2: { name: 'Upper Intermediate', nameEs: 'Intermedio alto', color: 'bg-lvl-b2', soft: 'bg-lvl-b2-soft', text: 'text-lvl-b2' },
};
