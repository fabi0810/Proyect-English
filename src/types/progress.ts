/* Datos del estudiante persistidos localmente. Ver docs/DATA_MODEL.md */
import type { Exercise, Level } from './content';
import type { Response, Verdict } from './exercise';

export const SCHEMA_VERSION = 1;

export interface Settings {
  passGrade: number;
  exigency: number;
  sectionMinimum: number;
  strictProgression: boolean;
  requireReviewBeforeRetake: boolean;
  voiceURI?: string;
  secondVoiceURI?: string;
  speechRate: number;
  theme: 'light' | 'dark' | 'system';
  dailyGoalMinutes: number;
  showSpanishSupport: boolean;
}

export interface LessonProgress {
  status: 'in_progress' | 'completed';
  step: number;
  startedAt: string;
  completedAt?: string;
  quizAttempts: number;
  quizBest: number;
  guidedDone?: boolean;
  independentDone?: boolean;
}

export interface ModuleProgress {
  passedAt?: string;
  bestGrade?: number;
  attempts: number;
}

export type AttemptKind = 'lesson' | 'module' | 'level' | 'diagnostic';

export interface AttemptItem {
  id: string; // id del ejercicio
  section?: string;
  response?: Response;
  score: number;
  points: number;
  verdict?: Verdict;
  topic: string;
  /** Permutación de opciones mostrada (selección múltiple) */
  optionOrder?: number[];
  flagged?: boolean;
}

export interface EvaluationAttempt {
  id: string;
  kind: AttemptKind;
  targetId: string;
  level: Level;
  title: string;
  number: number;
  startedAt: string;
  finishedAt?: string;
  status: 'completed' | 'abandoned';
  seed: number;
  items: AttemptItem[];
  score: number;
  maxScore: number;
  percent: number;
  grade?: number;
  passed?: boolean;
  sections?: Record<string, { title: string; percent: number; weight: number; passed: boolean }>;
  topics: Record<string, { correct: number; total: number }>;
  passGrade: number;
  exigency: number;
  durationSec: number;
  /** Para el diagnóstico */
  estimatedLevel?: Level | 'pre-A1';
  /** Ítems generados (vocabulario) que no existen en los archivos de contenido */
  generated?: Exercise[];
}

/** Examen en curso (se puede reanudar tras recargar). */
export interface ActiveExam {
  attemptId: string;
  kind: AttemptKind;
  targetId: string;
  level: Level;
  title: string;
  seed: number;
  startedAt: string;
  /** Ítems del examen en orden; para grupos se guarda el id del grupo */
  items: { id: string; section?: string; optionOrder?: number[] }[];
  answers: Record<string, Response | undefined>;
  flagged: string[];
  current: number;
  sections?: { id: string; title: string; weight: number }[];
  generated?: Exercise[];
}

export interface ItemStat {
  seen: number;
  correct: number;
  lastAt: string;
  lastVerdict: Verdict;
  streak: number;
  usedIn: string[];
}

export interface AnswerRecord {
  ts: string;
  itemId: string;
  context: string;
  skill?: string;
  topic?: string;
  level?: Level;
  score: number;
  verdict: Verdict;
  response: string;
  errorTags: string[];
}

export interface MistakeRecord {
  itemId: string;
  level?: Level;
  moduleId?: string;
  lessonId?: string;
  topic: string;
  errorTags: string[];
  count: number;
  lastResponse: string;
  expected: string;
  firstAt: string;
  lastAt: string;
  resolved: boolean;
  resolvedAt?: string;
  correctStreak: number;
}

export interface SrsCard {
  ease: number;
  interval: number; // días
  reps: number;
  lapses: number;
  due: string; // ISO
  lastReview?: string;
  history: number[]; // calidades
  known?: boolean; // marcada "ya la conozco" pendiente de confirmar
}

export interface VocabList {
  id: string;
  name: string;
  words: string[];
  createdAt: string;
}

export interface ActivityProgress {
  completed: boolean;
  completedAt?: string;
  attempts: number;
  bestScore: number;
  lastScore?: number;
}

export interface WritingIssue {
  ruleId: string;
  message: string;
  excerpt: string;
  suggestion?: string;
  start: number;
  end: number;
  severity: 'error' | 'warning' | 'style';
}

export interface WritingSubmission {
  id: string;
  taskId: string;
  level: Level;
  title: string;
  createdAt: string;
  original: string;
  corrected: string;
  revision?: string;
  revisedAt?: string;
  issues: WritingIssue[];
  score: number;
  criteria: Record<string, number>;
  wordCount: number;
}

export interface DailyActivity {
  seconds: number;
  answers: number;
  correct: number;
  lessons: number;
  reviews: number;
  byArea?: Record<string, number>;
}

export type ActivityEventType =
  | 'lesson_completed'
  | 'lesson_quiz'
  | 'evaluation'
  | 'level_exam'
  | 'reading'
  | 'listening'
  | 'writing'
  | 'translation'
  | 'vocab_session'
  | 'practice'
  | 'diagnostic'
  | 'achievement'
  | 'course_reset'
  | 'import';

export interface ActivityEvent {
  id: string;
  ts: string;
  type: ActivityEventType;
  title: string;
  detail?: string;
  link?: string;
}

export interface ContentFlag {
  itemId: string;
  ts: string;
  reason: string;
  response?: string;
}

export interface DiagnosticSummary {
  attemptId: string;
  takenAt: string;
  estimatedLevel: Level | 'pre-A1';
  byLevel: Record<string, { correct: number; total: number }>;
  strongTopics: string[];
  weakTopics: string[];
  recommendedStart: Level;
}

export interface UserData {
  meta: { schemaVersion: number; createdAt: string; courseNumber: number };
  profile: { name: string; startLevel: Level; diagnostic?: DiagnosticSummary; onboarded: boolean };
  settings: Settings;
  lessons: Record<string, LessonProgress>;
  modules: Record<string, ModuleProgress>;
  attempts: EvaluationAttempt[];
  activeExam: ActiveExam | null;
  itemStats: Record<string, ItemStat>;
  answerLog: AnswerRecord[];
  mistakes: Record<string, MistakeRecord>;
  vocab: { cards: Record<string, SrsCard>; lists: VocabList[]; difficult: string[] };
  readings: Record<string, ActivityProgress>;
  listening: Record<string, ActivityProgress>;
  writings: WritingSubmission[];
  activity: Record<string, DailyActivity>;
  events: ActivityEvent[];
  achievements: Record<string, { unlockedAt: string }>;
  flags: ContentFlag[];
}

export type SliceKey = keyof UserData;

export interface AcademicReport {
  generatedAt: string;
  courseNumber: number;
  levels: Record<
    string,
    { finalGrade?: number; examGrade?: number; modulesAverage?: number; passed: boolean; modulesPassed: number; modulesTotal: number }
  >;
  overallAverage?: number;
  evaluationsCount: number;
  attemptsCount: number;
  passedCount: number;
  studySeconds: number;
  daysActive: number;
  wordsLearned: number;
  strengths: string[];
  weaknesses: string[];
}

export interface ArchivedCourse {
  id: string;
  courseNumber: number;
  archivedAt: string;
  report: AcademicReport;
  data: UserData;
}
