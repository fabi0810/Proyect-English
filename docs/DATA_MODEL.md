# Modelos de datos y persistencia local

Dos familias de datos:

1. **Contenido** (solo lectura, JSON en `src/data/`): currículo, ejercicios, vocabulario, lecturas…
2. **Datos del estudiante** (`UserData`, IndexedDB): progreso, intentos, errores, repasos, escritos…

Los tipos completos viven en `src/types/`. Aquí se documentan los contratos.

## 1. Contenido

### 1.1 Niveles y manifiestos

```ts
type Level = 'A1' | 'A2' | 'B1' | 'B2';

interface LevelDefinition {            // data/curriculum/levels.json
  id: Level; name: string; nameEs: string;
  cefrGlobal: string;                  // descriptor global (paráfrasis en español)
  canDo: Record<'reading'|'listening'|'writing'|'interaction', string[]>;
  instructionLanguage: 'es' | 'es-en' | 'en-es' | 'en';
}

interface LevelManifest {              // data/curriculum/A1/index.json
  level: Level;
  modules: ModuleSummary[];            // en orden
  finalExam: FinalExamBlueprint;
}

interface ModuleSummary {
  id: string;                          // "a1-03"
  file: string;                        // "a1-03-verb-to-be.json"
  order: number;
  title: string; titleEs: string;
  summary: string;
  skills: Skill[];
  status: 'ready' | 'planned';         // 'planned' = estructura definida, contenido en preparación
  estimatedMinutes: number;
}
```

### 1.2 Módulo y lección

```ts
interface Module {
  id: string; level: Level; title: string; titleEs: string;
  description: string;
  objectives: string[];                // can-do del módulo
  vocabularyCategories?: string[];     // para generar ítems de vocabulario
  lessons: Lesson[];
  integrative: Exercise[];             // pool integrador (solo evaluación del módulo)
  evaluation?: { questionCount?: number };
}

interface Lesson {
  id: string;                          // "a1-03-l2"
  title: string; titleEs: string;
  objective: string;
  learn: string[];                     // "Qué aprenderás"
  why: string;                         // "Por qué es importante"
  theory: TheoryBlock[];               // B, C, D
  guided: Exercise[];                  // E
  independent: Exercise[];             // F
  summary: string[];                   // H
  quiz: Exercise[];                    // I (pool; también alimenta la evaluación del módulo)
}

type TheoryBlock =
  | { type: 'text'; title?: string; body: string }                       // markdown ligero: **negrita**, *cursiva*, `código`
  | { type: 'rule'; title: string; body?: string; formula?: string }
  | { type: 'table'; title?: string; headers: string[]; rows: string[][]; caption?: string }
  | { type: 'examples'; title?: string; items: { en: string; es: string; note?: string }[] }
  | { type: 'compare'; title?: string; items: { wrong: string; right: string; why: string }[] }
  | { type: 'tip' | 'warning' | 'exception'; title: string; body: string }
  | { type: 'glossary'; title?: string; items: { term: string; definition: string }[] }
  | { type: 'vocab'; title?: string; items: { en: string; es: string; ipa?: string }[] }
  | { type: 'dialogue'; title?: string; lines: { speaker: string; en: string; es: string }[] };
```

### 1.3 Ejercicios

Ver [ASSESSMENT_SYSTEM.md](ASSESSMENT_SYSTEM.md) §2. Unión discriminada por `type`:

```ts
type Exercise =
  | MultipleChoice    // question, options: (string | {text, why?, error?})[], answer
  | FillBlank         // text con ___, blanks: {answers[], hint?, options?, feedback?}[]
  | WordOrder         // tokens[] en orden canónico, answers?[], clue?
  | SentenceBuilding  // cue, answers[]
  | ErrorIdentification // segments[], errorIndex, correction, answers?[]
  | ErrorCorrection   // sentence, answers[]
  | Translation       // direction, source, answers[], notes?, keyConcepts?[][]
  | Matching          // pairs: [left, right][]
  | TrueFalse         // statement, answer, context?
  | TenseIdentification // sentence, highlight?, options[], answer
  | OpenAnswer        // question, requirements[], minWords?, maxWords?, sampleAnswers[]
  | WritingTask       // task, requirements[], minWords, maxWords, targetStructures?, model?
  | Dictation         // text, answers?
  | ComprehensionGroup; // reading_comprehension | listening_comprehension: passage | audio, questions[]
```

### 1.4 Vocabulario, lecturas, audio, escritura, traducción

```ts
interface VocabWord {
  id: string;                 // "a1-fam-mother"
  word: string; translation: string;
  pos: 'noun'|'verb'|'adjective'|'adverb'|'pronoun'|'preposition'|'phrase'|'determiner'|'number'|'conjunction'|'interjection';
  ipa: string;                // pronunciación orientativa (inglés americano)
  category: VocabCategory; level: Level;
  example: string; exampleEs: string;
  context?: string;           // nota de uso (registro, falsos amigos, colocaciones)
  audioUrl?: string;
}

interface Reading {
  id: string; level: Level; title: string; topic: string;
  genre: 'description'|'story'|'conversation'|'message'|'news'|'informative'|'academic';
  paragraphs: { sentences: { en: string; es: string; verbs?: [form: string, tense: TenseId][] }[] }[];
  glossary: { term: string; es: string; note?: string }[];
  grammarFocus: string[];
  questions: Exercise[];
}

interface ListeningActivity {
  id: string; level: Level; title: string; topic: string;
  kind: 'dialogue' | 'monologue' | 'announcement';
  lines: { speaker: string; text: string; es: string }[];
  audioUrl?: string; audioCredit?: string;
  questions: Exercise[];      // listen_choose, completar, dictado, V/F…
}
```

### 1.5 Catálogo de errores

```ts
interface ErrorType {          // data/errors/catalog.json → Record<id, ErrorType>
  title: string;               // "Falta la -s de tercera persona"
  explanation: string;         // en español
  example: { wrong: string; right: string };
  lesson?: string;             // lección donde se explica
}
```

## 2. Datos del estudiante (`UserData`)

Cada clave de primer nivel es un **slice** persistido por separado.

```ts
interface UserData {
  meta:        { schemaVersion: number; createdAt: string; courseNumber: number };
  profile:     { name: string; startLevel: Level; diagnostic?: DiagnosticSummary };
  settings:    Settings;
  lessons:     Record<lessonId, LessonProgress>;
  modules:     Record<moduleId, ModuleProgress>;
  attempts:    EvaluationAttempt[];          // TODOS los intentos (nunca se sobrescriben)
  activeExam:  ActiveExam | null;            // examen en curso (reanudable)
  itemStats:   Record<exerciseId, ItemStat>;
  answerLog:   AnswerRecord[];               // últimas 5 000 respuestas detalladas
  mistakes:    Record<exerciseId, MistakeRecord>;
  vocab:       { cards: Record<wordId, SrsCard>; lists: VocabList[]; difficult: string[] };
  readings:    Record<readingId, ActivityProgress>;
  listening:   Record<activityId, ActivityProgress>;
  writings:    WritingSubmission[];
  activity:    Record<'YYYY-MM-DD', DailyActivity>;
  events:      ActivityEvent[];              // últimas 500 actividades (para "actividad reciente")
  achievements: Record<achievementId, { unlockedAt: string }>;
  flags:       ContentFlag[];                // preguntas reportadas por el estudiante
}

interface Settings {
  passGrade: number;          // 3.0
  exigency: number;           // 0.7
  sectionMinimum: number;     // 0.5 (examen final)
  strictProgression: boolean; // true
  requireReviewBeforeRetake: boolean; // false
  voiceURI?: string; speechRate: number; // 1.0
  theme: 'light' | 'dark' | 'system';
  dailyGoalMinutes: number;   // 20
  showSpanishSupport: boolean;// true
}

interface LessonProgress {
  status: 'in_progress' | 'completed';
  step: number;                // último paso visitado (A–I)
  startedAt: string; completedAt?: string;
  quizAttempts: number; quizBest: number; // 0..1
}

interface ModuleProgress { passedAt?: string; bestGrade?: number; attempts: number }

interface EvaluationAttempt {
  id: string;
  kind: 'lesson' | 'module' | 'level' | 'diagnostic';
  targetId: string;            // lessonId, moduleId, "A1"…
  title: string;
  number: number;              // n.º de intento para ese targetId
  startedAt: string; finishedAt?: string;
  status: 'completed' | 'abandoned';
  seed: number;
  items: AttemptItem[];        // id del ítem, respuesta, score, verdict, sección, permutación de opciones
  score: number; maxScore: number; percent: number;
  grade?: number; passed?: boolean;
  sections?: Record<string, { percent: number; weight: number }>;
  topics: Record<topic, { correct: number; total: number }>;
  passGrade: number; exigency: number; // parámetros vigentes al calificar
  durationSec: number;
}

interface ItemStat {
  seen: number; correct: number; lastAt: string;
  lastVerdict: Verdict; streak: number;      // aciertos consecutivos
  usedIn: string[];                          // ids de intentos de evaluación (rotación)
}

interface MistakeRecord {
  itemId: string; moduleId?: string; lessonId?: string; topic: string;
  errorTags: string[]; count: number;
  lastResponse: string; expected: string;
  firstAt: string; lastAt: string;
  resolved: boolean; resolvedAt?: string; correctStreak: number;
}

interface SrsCard { ease: number; interval: number; reps: number; lapses: number; due: string; lastReview?: string; history: number[] }

interface WritingSubmission {
  id: string; taskId: string; level: Level; createdAt: string;
  original: string; corrected: string; revision?: string;
  issues: WritingIssue[]; score: number; wordCount: number;
}

interface DailyActivity { minutes: number; answers: number; correct: number; lessons: number; reviews: number }
```

## 3. Persistencia

| Dato | Almacén | Motivo |
|---|---|---|
| Slices de `UserData` | IndexedDB `kv` (clave = nombre del slice) | Capacidad amplia, escritura incremental |
| Historiales archivados | IndexedDB `archives` | Pueden ser grandes; se cargan solo al consultarlos |
| Tema (claro/oscuro) | `localStorage` | Lectura síncrona antes del primer render (sin parpadeo) |

- **Escritura incremental:** solo se escriben los slices cuyo objeto cambió (comparación de
  referencias, gracias a la inmutabilidad), con *debounce* de 400 ms y vaciado inmediato al ocultar la
  pestaña.
- **Límites:** `answerLog` (5 000) y `events` (500) son registros circulares; las estadísticas
  agregadas (`itemStats`, `activity`, `attempts`) se conservan completas.
- **Migraciones:** `meta.schemaVersion`; `services/storage/migrations.ts` aplica funciones
  `vN → vN+1` en orden al cargar o importar.

## 4. Copia de seguridad

```json
{
  "app": "english-learning-platform",
  "schemaVersion": 1,
  "exportedAt": "2026-11-07T10:00:00.000Z",
  "data": { "...UserData..." },
  "archives": [ "...ArchivedCourse..." ]
}
```

Importación: se valida `app`, la versión y la forma de cada slice; se muestra un resumen (intentos,
lecciones, palabras, escritos) y se pide confirmación antes de reemplazar.

## 5. Reinicio del curso

```ts
interface ArchivedCourse {
  id: string; courseNumber: number; archivedAt: string;
  report: AcademicReport;      // notas finales por nivel, promedios, tiempo, fortalezas, debilidades
  data: UserData;              // copia íntegra del historial
}
```

Flujo: informe académico → confirmación explícita → (opcional) exportar copia → archivar → reiniciar
progreso conservando configuración y listas personales de vocabulario (opcional) → empezar desde A1.
