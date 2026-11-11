/* Tipos del contenido educativo (solo lectura, JSON en src/data). Ver docs/DATA_MODEL.md */

export type Level = 'A1' | 'A2' | 'B1' | 'B2';
export const LEVELS: Level[] = ['A1', 'A2', 'B1', 'B2'];

export type Skill =
  | 'grammar'
  | 'vocabulary'
  | 'reading'
  | 'listening'
  | 'writing'
  | 'translation'
  | 'construction'
  | 'comprehension';

export type Difficulty = 1 | 2 | 3;

export type ExerciseType =
  | 'multiple_choice'
  | 'fill_blank'
  | 'word_order'
  | 'sentence_building'
  | 'error_identification'
  | 'error_correction'
  | 'translation'
  | 'matching'
  | 'true_false'
  | 'tense_identification'
  | 'open_answer'
  | 'writing_task'
  | 'dictation'
  | 'reading_comprehension'
  | 'listening_comprehension';

/** Pool del que procede un ejercicio (lo asigna el cargador). */
export type Pool =
  | 'guided'
  | 'independent'
  | 'quiz'
  | 'integrative'
  | 'reading'
  | 'listening'
  | 'translation'
  | 'writing'
  | 'exam'
  | 'diagnostic'
  | 'vocab';

export interface ExerciseBase {
  id: string;
  type: ExerciseType;
  topic: string;
  skill: Skill;
  difficulty: Difficulty;
  /** Enunciado. Si falta se usa el predeterminado del tipo según el nivel. */
  prompt?: string;
  /** Explicación general: por qué la respuesta correcta lo es (español). */
  explanation: string;
  /** Error gramatical asociado (id del catálogo de errores). */
  errorTag?: string;
  points?: number;
  /** Ítems que evalúan lo mismo: nunca coinciden en un examen. */
  group?: string;
  /** Texto que se reproduce con síntesis de voz. */
  audio?: string;
  /** Grabación real (public/audio/...) con prioridad sobre el TTS. */
  audioUrl?: string;
  audioCredit?: string;
  /** Oculta el texto escrito (ejercicio de escucha). */
  hideText?: boolean;
  /** Inyectados por el cargador */
  level?: Level;
  module?: string;
  lesson?: string;
  pool?: Pool;
}

export interface ChoiceOption {
  text: string;
  /** Por qué esta opción es incorrecta (o un comentario si es la correcta). */
  why?: string;
  /** Error del catálogo asociado a esta opción. */
  error?: string;
}

export interface MultipleChoiceExercise extends ExerciseBase {
  type: 'multiple_choice';
  question: string;
  context?: string;
  options: (string | ChoiceOption)[];
  answer: number;
}

export interface Blank {
  /** Patrones aceptados ({a|b}, [opcional]). */
  answers: string[];
  /** Pista visible, p. ej. el verbo base: (go). */
  hint?: string;
  /** Si existe, el hueco se responde eligiendo entre estas opciones. */
  options?: string[];
  /** Feedback para respuestas incorrectas frecuentes. Valor "@tag" = explicación del catálogo. */
  feedback?: Record<string, string>;
}

export interface FillBlankExercise extends ExerciseBase {
  type: 'fill_blank';
  /** Texto con huecos marcados como ___ */
  text: string;
  blanks: Blank[];
}

export interface WordOrderExercise extends ExerciseBase {
  type: 'word_order';
  /** Fichas en el orden canónico (se barajan al mostrarse). */
  tokens: string[];
  /** Otras oraciones completas aceptadas. */
  answers?: string[];
  /** Puntuación final para mostrar la oración (por defecto "."). */
  punctuation?: string;
  /** Pista en español. */
  clue?: string;
}

export interface SentenceBuildingExercise extends ExerciseBase {
  type: 'sentence_building';
  /** Elementos o idea a expresar, p. ej. "she / not / like / coffee". */
  cue: string;
  clue?: string;
  answers: string[];
}

export interface ErrorIdentificationExercise extends ExerciseBase {
  type: 'error_identification';
  segments: string[];
  errorIndex: number;
  /** Reemplazos aceptados para el segmento erróneo. */
  correction: string[];
}

export interface ErrorCorrectionExercise extends ExerciseBase {
  type: 'error_correction';
  sentence: string;
  answers: string[];
}

export interface TranslationExercise extends ExerciseBase {
  type: 'translation';
  direction: 'en-es' | 'es-en';
  source: string;
  answers: string[];
  /** Diferencias entre traducción literal y natural, expresiones idiomáticas. */
  notes?: string;
  /** Grupos de conceptos clave: cada grupo se cumple si aparece alguna de sus formas. */
  keyConcepts?: string[][];
  /** palabra | expresión | oración | párrafo */
  unit?: 'word' | 'expression' | 'sentence' | 'paragraph';
}

export interface MatchingExercise extends ExerciseBase {
  type: 'matching';
  pairs: [string, string][];
  leftTitle?: string;
  rightTitle?: string;
}

export interface TrueFalseExercise extends ExerciseBase {
  type: 'true_false';
  statement: string;
  context?: string;
  answer: boolean;
}

export interface TenseIdentificationExercise extends ExerciseBase {
  type: 'tense_identification';
  sentence: string;
  highlight?: string;
  options: string[];
  answer: string;
}

export interface Requirement {
  label: string;
  /** Expresión regular (sin delimitadores, insensible a mayúsculas). */
  pattern: string;
  feedback?: string;
}

export interface OpenAnswerExercise extends ExerciseBase {
  type: 'open_answer';
  question: string;
  requirements: Requirement[];
  minWords?: number;
  maxWords?: number;
  sampleAnswers: string[];
}

export interface WritingTaskExercise extends ExerciseBase {
  type: 'writing_task';
  title?: string;
  task: string;
  requirements: Requirement[];
  targetStructures?: Requirement[];
  minWords: number;
  maxWords: number;
  model?: string;
  tips?: string[];
}

export interface DictationExercise extends ExerciseBase {
  type: 'dictation';
  text: string;
  answers?: string[];
}

export interface DialogueLine {
  speaker: string;
  text: string;
  es?: string;
}

export interface ComprehensionGroupExercise extends ExerciseBase {
  type: 'reading_comprehension' | 'listening_comprehension';
  title?: string;
  passage?: string;
  passageEs?: string;
  lines?: DialogueLine[];
  questions: Exercise[];
}

export type Exercise =
  | MultipleChoiceExercise
  | FillBlankExercise
  | WordOrderExercise
  | SentenceBuildingExercise
  | ErrorIdentificationExercise
  | ErrorCorrectionExercise
  | TranslationExercise
  | MatchingExercise
  | TrueFalseExercise
  | TenseIdentificationExercise
  | OpenAnswerExercise
  | WritingTaskExercise
  | DictationExercise
  | ComprehensionGroupExercise;

/* ───────── Teoría ───────── */

export type TheoryBlock =
  | { type: 'text'; title?: string; body: string }
  | { type: 'rule'; title: string; body?: string; formula?: string }
  | { type: 'table'; title?: string; headers: string[]; rows: string[][]; caption?: string }
  | { type: 'examples'; title?: string; items: { en: string; es: string; note?: string }[] }
  | { type: 'compare'; title?: string; items: { wrong: string; right: string; why: string }[] }
  | { type: 'tip' | 'warning' | 'exception'; title: string; body: string }
  | { type: 'glossary'; title?: string; items: { term: string; definition: string }[] }
  | { type: 'vocab'; title?: string; items: { en: string; es: string; ipa?: string }[] }
  | { type: 'dialogue'; title?: string; lines: { speaker: string; en: string; es: string }[] };

export interface Lesson {
  id: string;
  title: string;
  titleEs: string;
  objective: string;
  learn: string[];
  why: string;
  theory: TheoryBlock[];
  guided: Exercise[];
  independent: Exercise[];
  summary: string[];
  quiz: Exercise[];
}

export interface Module {
  id: string;
  level: Level;
  title: string;
  titleEs: string;
  description: string;
  objectives: string[];
  vocabularyCategories?: string[];
  lessons: Lesson[];
  integrative: Exercise[];
  evaluation?: { questionCount?: number };
}

export interface ModuleSummary {
  id: string;
  file: string;
  order: number;
  title: string;
  titleEs: string;
  summary: string;
  skills: Skill[];
  status: 'ready' | 'planned';
  estimatedMinutes: number;
  /** Número de lecciones (se valida contra el archivo del módulo). */
  lessons?: number;
}

export type ExamSectionSource =
  | { kind: 'modules'; skills?: Skill[]; types?: ExerciseType[] }
  | { kind: 'vocabulary' }
  | { kind: 'exam'; pool: 'reading' | 'listening' | 'translation' | 'writing' };

export interface ExamSectionBlueprint {
  id: string;
  title: string;
  weight: number;
  count: number;
  source: ExamSectionSource;
}

export interface FinalExamBlueprint {
  id: string;
  title: string;
  sections: ExamSectionBlueprint[];
}

export interface LevelManifest {
  level: Level;
  modules: ModuleSummary[];
  finalExam: FinalExamBlueprint;
}

export interface LevelDefinition {
  id: Level;
  name: string;
  nameEs: string;
  objective: string;
  cefrGlobal: string;
  canDo: Record<'reading' | 'listening' | 'writing' | 'interaction', string[]>;
  instructionLanguage: 'es' | 'es-en' | 'en-es' | 'en';
  vocabularyTarget: number;
}

/* ───────── Recursos ───────── */

export type VocabCategory =
  | 'basics'
  | 'family'
  | 'food'
  | 'education'
  | 'work'
  | 'travel'
  | 'health'
  | 'technology'
  | 'transportation'
  | 'daily-activities'
  | 'relationships'
  | 'shopping'
  | 'environment'
  | 'entertainment'
  | 'emotions'
  | 'business';

export type PartOfSpeech =
  | 'noun'
  | 'verb'
  | 'adjective'
  | 'adverb'
  | 'pronoun'
  | 'preposition'
  | 'phrase'
  | 'determiner'
  | 'number'
  | 'conjunction'
  | 'interjection';

export interface VocabWord {
  id: string;
  word: string;
  translation: string;
  pos: PartOfSpeech;
  ipa: string;
  category: VocabCategory;
  level: Level;
  example: string;
  exampleEs: string;
  context?: string;
  audioUrl?: string;
}

export interface ReadingSentence {
  en: string;
  es: string;
  /** [forma verbal tal como aparece, id del tiempo verbal] */
  verbs?: [string, string][];
}

export type ReadingGenre = 'description' | 'story' | 'conversation' | 'message' | 'news' | 'informative' | 'academic';

export interface Reading {
  id: string;
  level: Level;
  title: string;
  topic: string;
  genre: ReadingGenre;
  intro?: string;
  paragraphs: { speaker?: string; sentences: ReadingSentence[] }[];
  glossary: { term: string; es: string; note?: string }[];
  grammarFocus: string[];
  questions: Exercise[];
}

export interface ListeningActivity {
  id: string;
  level: Level;
  title: string;
  topic: string;
  kind: 'dialogue' | 'monologue' | 'announcement';
  intro?: string;
  lines: DialogueLine[];
  audioUrl?: string;
  audioCredit?: string;
  questions: Exercise[];
}

export interface ErrorType {
  title: string;
  explanation: string;
  example: { wrong: string; right: string };
  lesson?: string;
}

export interface ExamPools {
  level: Level;
  reading: ComprehensionGroupExercise[];
  listening: ComprehensionGroupExercise[];
  translation: TranslationExercise[];
  writing: WritingTaskExercise[];
}

export interface PlacementQuestion {
  id: string;
  level: Level;
  skill: Skill;
  topic: string;
  module: string;
  question: string;
  context?: string;
  options: string[];
  answer: number;
  explanation: string;
}
