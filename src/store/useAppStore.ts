/**
 * Store global (Zustand). Contiene UserData y las acciones de dominio.
 * La lógica pedagógica vive en services/; aquí solo se orquesta y se persiste.
 */
import { create } from 'zustand';
import type { Exercise } from '../types/content';
import type { GradeResult, Response } from '../types/exercise';
import { isCorrectVerdict } from '../types/exercise';
import type {
  ActivityEvent,
  ArchivedCourse,
  DiagnosticSummary,
  EvaluationAttempt,
  Settings,
  UserData,
  WritingSubmission,
} from '../types/progress';
import type { BuiltExam } from '../services/evaluation/builders';
import { scoreExam } from '../services/evaluation/results';
import { newlyUnlocked } from '../services/progress/achievements';
import { buildAcademicReport } from '../services/progress/report';
import { createDefaultUserData, SLICE_KEYS } from '../services/storage/defaults';
import { migrateUserData } from '../services/storage/migrations';
import { createMemoryAdapter, createStorage, type StorageAdapter, type StorageKind } from '../services/storage/persistence';
import { markKnown, review, type ReviewQuality } from '../services/vocabulary/srs';
import { dayKey, nowIso } from '../utils/dates';
import { uid } from '../utils/ids';

export type AnswerContext =
  | 'guided'
  | 'independent'
  | 'practice'
  | 'mistakes'
  | 'lesson'
  | 'module'
  | 'level'
  | 'reading'
  | 'listening'
  | 'translation'
  | 'writing'
  | 'vocab'
  | 'diagnostic';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  tone: 'success' | 'info' | 'warning' | 'achievement';
}

const ANSWER_LOG_LIMIT = 5000;
const EVENTS_LIMIT = 500;

interface AppState {
  hydrated: boolean;
  storageKind: StorageKind;
  storageError?: string;
  multiTab: boolean;
  data: UserData;
  toasts: Toast[];

  hydrate: () => Promise<void>;
  flush: () => Promise<void>;

  recordAnswer: (ex: Exercise, result: GradeResult, context: AnswerContext) => void;
  selfAccept: (ex: Exercise, result: GradeResult) => void;

  touchLesson: (lessonId: string, step: number) => void;
  markLessonPractice: (lessonId: string, part: 'guided' | 'independent') => void;

  startExam: (built: BuiltExam) => void;
  setExamAnswer: (itemId: string, resp: Response | undefined) => void;
  setExamCurrent: (index: number) => void;
  toggleExamFlag: (itemId: string) => void;
  abandonExam: () => void;
  submitExam: (exercises: Map<string, Exercise>) => EvaluationAttempt | undefined;

  reviewWord: (wordId: string, q: ReviewQuality) => void;
  markWordKnown: (wordId: string) => void;
  toggleDifficult: (wordId: string) => void;
  createList: (name: string) => string;
  deleteList: (listId: string) => void;
  renameList: (listId: string, name: string) => void;
  toggleWordInList: (listId: string, wordId: string) => void;

  completeActivity: (kind: 'readings' | 'listening', id: string, score: number, title: string) => void;
  saveWriting: (sub: WritingSubmission) => void;
  reviseWriting: (id: string, revision: string, score: number) => void;

  addStudySeconds: (seconds: number, area: string) => void;
  logEvent: (e: Omit<ActivityEvent, 'id' | 'ts'>) => void;
  flagItem: (itemId: string, reason: string, response?: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  updateProfile: (patch: Partial<UserData['profile']>) => void;
  saveDiagnostic: (attempt: EvaluationAttempt, summary: DiagnosticSummary) => void;

  pushToast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: string) => void;

  getArchives: () => Promise<ArchivedCourse[]>;
  deleteArchive: (id: string) => Promise<void>;
  importData: (data: UserData, archives: ArchivedCourse[]) => Promise<void>;
  resetCourse: (opts: { keepLists: boolean }) => Promise<void>;
  eraseAll: () => Promise<void>;
}

let adapter: StorageAdapter = createMemoryAdapter();
let hydrating: Promise<void> | null = null;
const dirty = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/* ───────── helpers puros ───────── */

function bumpActivity(d: UserData, patch: { answers?: number; correct?: number; lessons?: number; reviews?: number }): UserData['activity'] {
  const key = dayKey();
  const cur = d.activity[key] ?? { seconds: 0, answers: 0, correct: 0, lessons: 0, reviews: 0 };
  return {
    ...d.activity,
    [key]: {
      ...cur,
      answers: cur.answers + (patch.answers ?? 0),
      correct: cur.correct + (patch.correct ?? 0),
      lessons: cur.lessons + (patch.lessons ?? 0),
      reviews: cur.reviews + (patch.reviews ?? 0),
    },
  };
}

function pushEvent(events: ActivityEvent[], e: Omit<ActivityEvent, 'id' | 'ts'>): ActivityEvent[] {
  const next = [...events, { ...e, id: uid('ev'), ts: nowIso() }];
  return next.length > EVENTS_LIMIT ? next.slice(next.length - EVENTS_LIMIT) : next;
}

/** Aplica una respuesta (no grupal) a estadísticas, registro y errores. */
function applyAnswer(d: UserData, ex: Exercise, r: GradeResult, context: AnswerContext): UserData {
  const now = nowIso();
  const ok = isCorrectVerdict(r.verdict);
  const prev = d.itemStats[ex.id];
  const itemStats = {
    ...d.itemStats,
    [ex.id]: {
      seen: (prev?.seen ?? 0) + 1,
      correct: (prev?.correct ?? 0) + (ok ? 1 : 0),
      lastAt: now,
      lastVerdict: r.verdict,
      streak: ok ? (prev?.streak ?? 0) + 1 : 0,
      usedIn: prev?.usedIn ?? [],
    },
  };
  const log = [
    ...d.answerLog,
    {
      ts: now,
      itemId: ex.id,
      context,
      skill: ex.skill,
      topic: ex.topic,
      level: ex.level,
      score: r.score,
      verdict: r.verdict,
      response: r.responseText.slice(0, 300),
      errorTags: r.errorTags,
    },
  ];
  const answerLog = log.length > ANSWER_LOG_LIMIT ? log.slice(log.length - ANSWER_LOG_LIMIT) : log;

  let mistakes = d.mistakes;
  const existing = d.mistakes[ex.id];
  if (!ok && context !== 'diagnostic' && context !== 'vocab' && !ex.id.startsWith('vq-')) {
    mistakes = {
      ...d.mistakes,
      [ex.id]: {
        itemId: ex.id,
        level: ex.level,
        moduleId: ex.module,
        lessonId: ex.lesson,
        topic: ex.topic,
        errorTags: Array.from(new Set([...(existing?.errorTags ?? []), ...r.errorTags, ...(ex.errorTag ? [ex.errorTag] : [])])),
        count: (existing?.count ?? 0) + 1,
        lastResponse: r.responseText.slice(0, 300),
        expected: r.expected.slice(0, 300),
        firstAt: existing?.firstAt ?? now,
        lastAt: now,
        resolved: false,
        correctStreak: 0,
      },
    };
  } else if (ok && existing && !existing.resolved) {
    const correctStreak = existing.correctStreak + 1;
    mistakes = {
      ...d.mistakes,
      [ex.id]: { ...existing, correctStreak, resolved: correctStreak >= 2, resolvedAt: correctStreak >= 2 ? now : undefined },
    };
  }
  return { ...d, itemStats, answerLog, mistakes, activity: bumpActivity(d, { answers: 1, correct: r.score }) };
}

function applyResult(d: UserData, ex: Exercise, r: GradeResult, context: AnswerContext): UserData {
  if ((ex.type === 'reading_comprehension' || ex.type === 'listening_comprehension') && r.sub) {
    let out = d;
    ex.questions.forEach((q, i) => {
      const sr = r.sub?.[i];
      if (sr) out = applyAnswer(out, q, sr, context);
    });
    return out;
  }
  return applyAnswer(d, ex, r, context);
}

/** Registra logros recién cumplidos; devuelve los nuevos para mostrar avisos. */
function withAchievements(d: UserData): { data: UserData; unlocked: { title: string; description: string }[] } {
  const fresh = newlyUnlocked(d);
  if (!fresh.length) return { data: d, unlocked: [] };
  const now = nowIso();
  const achievements = { ...d.achievements };
  let events = d.events;
  for (const a of fresh) {
    achievements[a.id] = { unlockedAt: now };
    events = pushEvent(events, { type: 'achievement', title: `Logro: ${a.title}`, link: '/achievements' });
  }
  return { data: { ...d, achievements, events }, unlocked: fresh.map((a) => ({ title: a.title, description: a.description })) };
}

/* ───────── persistencia ───────── */

function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    void useAppStore.getState().flush();
  }, 400);
}

async function writeAll(data: UserData) {
  await adapter.save(SLICE_KEYS.map((k) => [k, data[k]] as [string, unknown]));
}

export const useAppStore = create<AppState>((set, get) => {
  const commit = (fn: (d: UserData) => UserData, opts: { achievements?: boolean } = {}) => {
    set((s) => {
      let data = fn(s.data);
      if (opts.achievements) {
        const res = withAchievements(data);
        data = res.data;
        if (res.unlocked.length) {
          const toasts = [
            ...s.toasts,
            ...res.unlocked.map((u) => ({ id: uid('t'), title: `🏆 ${u.title}`, description: u.description, tone: 'achievement' as const })),
          ];
          return { data, toasts };
        }
      }
      return { data };
    });
  };

  return {
    hydrated: false,
    storageKind: 'memory',
    multiTab: false,
    data: createDefaultUserData(),
    toasts: [],

    hydrate() {
      // Una sola vez por página (StrictMode ejecuta los efectos dos veces en desarrollo).
      if (!hydrating) {
        hydrating = (async () => {
          try {
            adapter = await createStorage();
            const raw = await adapter.loadAll();
            const data = Object.keys(raw).length ? migrateUserData(raw) : createDefaultUserData();
            set({ data, hydrated: true, storageKind: adapter.kind });
            if (!Object.keys(raw).length) await writeAll(data);
          } catch (e) {
            adapter = createMemoryAdapter();
            set({ hydrated: true, storageKind: 'memory', storageError: e instanceof Error ? e.message : String(e) });
          }
          useAppStore.subscribe((state, prev) => {
            if (state.data === prev.data) return;
            for (const k of SLICE_KEYS) if (state.data[k] !== prev.data[k]) dirty.add(k);
            if (dirty.size) scheduleFlush();
          });
          const flushNow = () => {
            if (dirty.size) void get().flush();
          };
          window.addEventListener('pagehide', flushNow);
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') flushNow();
          });
          if ('BroadcastChannel' in window) {
            const ch = new BroadcastChannel('elp-tabs');
            ch.onmessage = (m) => {
              if (m.data === 'hello') ch.postMessage('here');
              if (m.data === 'hello' || m.data === 'here') set({ multiTab: true });
            };
            ch.postMessage('hello');
          }
        })();
      }
      return hydrating;
    },

    async flush() {
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      if (!dirty.size) return;
      const keys = Array.from(dirty);
      dirty.clear();
      const data = get().data;
      try {
        await adapter.save(keys.map((k) => [k, data[k as keyof UserData]] as [string, unknown]));
        if (get().storageError) set({ storageError: undefined });
      } catch (e) {
        keys.forEach((k) => dirty.add(k));
        set({ storageError: e instanceof Error ? e.message : 'No se pudo guardar el progreso.' });
      }
    },

    recordAnswer(ex, result, context) {
      commit((d) => applyResult(d, ex, result, context), { achievements: true });
    },

    selfAccept(ex, result) {
      commit((d) => {
        const stat = d.itemStats[ex.id];
        const fixed = stat ? { ...d.itemStats, [ex.id]: { ...stat, correct: stat.correct + 1, lastVerdict: 'accepted_with_note' as const, streak: stat.streak + 1 } } : d.itemStats;
        const mistakes = { ...d.mistakes };
        const m = mistakes[ex.id];
        if (m) {
          if (m.count <= 1) delete mistakes[ex.id];
          else mistakes[ex.id] = { ...m, count: m.count - 1 };
        }
        return {
          ...d,
          itemStats: fixed,
          mistakes,
          flags: [...d.flags, { itemId: ex.id, ts: nowIso(), reason: 'Respuesta marcada como válida por el estudiante', response: result.responseText }],
        };
      });
    },

    touchLesson(lessonId, step) {
      commit((d) => {
        const cur = d.lessons[lessonId];
        if (cur && cur.step === step) return d;
        return {
          ...d,
          lessons: {
            ...d.lessons,
            [lessonId]: cur ? { ...cur, step: Math.max(step, 0) } : { status: 'in_progress', step, startedAt: nowIso(), quizAttempts: 0, quizBest: 0 },
          },
        };
      });
    },

    markLessonPractice(lessonId, part) {
      commit((d) => {
        const cur = d.lessons[lessonId] ?? { status: 'in_progress' as const, step: 0, startedAt: nowIso(), quizAttempts: 0, quizBest: 0 };
        return { ...d, lessons: { ...d.lessons, [lessonId]: { ...cur, [part === 'guided' ? 'guidedDone' : 'independentDone']: true } } };
      });
    },

    startExam(built) {
      commit((d) => ({
        ...d,
        activeExam: {
          attemptId: uid('att'),
          kind: built.kind,
          targetId: built.targetId,
          level: built.level,
          title: built.title,
          seed: built.seed,
          startedAt: nowIso(),
          items: built.items,
          answers: {},
          flagged: [],
          current: 0,
          sections: built.sections,
          generated: built.generated,
        },
      }));
    },

    setExamAnswer(itemId, resp) {
      commit((d) => (d.activeExam ? { ...d, activeExam: { ...d.activeExam, answers: { ...d.activeExam.answers, [itemId]: resp } } } : d));
    },

    setExamCurrent(index) {
      commit((d) => (d.activeExam ? { ...d, activeExam: { ...d.activeExam, current: index } } : d));
    },

    toggleExamFlag(itemId) {
      commit((d) => {
        if (!d.activeExam) return d;
        const f = d.activeExam.flagged;
        return { ...d, activeExam: { ...d.activeExam, flagged: f.includes(itemId) ? f.filter((x) => x !== itemId) : [...f, itemId] } };
      });
    },

    abandonExam() {
      commit((d) => {
        const ex = d.activeExam;
        if (!ex) return d;
        const number = d.attempts.filter((a) => a.kind === ex.kind && a.targetId === ex.targetId).length + 1;
        const attempt: EvaluationAttempt = {
          id: ex.attemptId,
          kind: ex.kind,
          targetId: ex.targetId,
          level: ex.level,
          title: ex.title,
          number,
          startedAt: ex.startedAt,
          finishedAt: nowIso(),
          status: 'abandoned',
          seed: ex.seed,
          items: ex.items.map((i) => ({ id: i.id, section: i.section, score: 0, points: 0, topic: '' })),
          score: 0,
          maxScore: 0,
          percent: 0,
          topics: {},
          passGrade: d.settings.passGrade,
          exigency: d.settings.exigency,
          durationSec: Math.round((Date.now() - new Date(ex.startedAt).getTime()) / 1000),
        };
        return { ...d, attempts: [...d.attempts, attempt], activeExam: null };
      });
    },

    submitExam(exercises) {
      const d0 = get().data;
      const ex = d0.activeExam;
      if (!ex) return undefined;
      const scored = scoreExam(ex.items, exercises, ex.answers, d0.settings, ex.sections);
      const now = nowIso();
      const number = d0.attempts.filter((a) => a.kind === ex.kind && a.targetId === ex.targetId).length + 1;
      const attempt: EvaluationAttempt = {
        id: ex.attemptId,
        kind: ex.kind,
        targetId: ex.targetId,
        level: ex.level,
        title: ex.title,
        number,
        startedAt: ex.startedAt,
        finishedAt: now,
        status: 'completed',
        seed: ex.seed,
        items: scored.items,
        score: scored.score,
        maxScore: scored.maxScore,
        percent: scored.percent,
        grade: scored.grade,
        passed: scored.passed,
        sections: scored.sections,
        topics: scored.topics,
        passGrade: d0.settings.passGrade,
        exigency: d0.settings.exigency,
        durationSec: Math.round((Date.now() - new Date(ex.startedAt).getTime()) / 1000),
        generated: ex.generated,
      };
      const context: AnswerContext = ex.kind === 'lesson' ? 'lesson' : ex.kind === 'module' ? 'module' : ex.kind === 'level' ? 'level' : 'diagnostic';

      commit(
        (d) => {
          let data: UserData = { ...d, attempts: [...d.attempts, attempt], activeExam: null };
          for (const item of ex.items) {
            const e = exercises.get(item.id);
            const r = scored.results[item.id];
            if (e && r) data = applyResult(data, e, r, context);
            const st = data.itemStats[item.id];
            if (st) data = { ...data, itemStats: { ...data.itemStats, [item.id]: { ...st, usedIn: [...st.usedIn.slice(-9), attempt.id] } } };
          }
          if (ex.kind === 'lesson') {
            const cur = data.lessons[ex.targetId] ?? { status: 'in_progress' as const, step: 0, startedAt: now, quizAttempts: 0, quizBest: 0 };
            const completedNow = attempt.passed && cur.status !== 'completed';
            data = {
              ...data,
              lessons: {
                ...data.lessons,
                [ex.targetId]: {
                  ...cur,
                  quizAttempts: cur.quizAttempts + 1,
                  quizBest: Math.max(cur.quizBest, attempt.percent),
                  status: attempt.passed ? 'completed' : cur.status,
                  completedAt: completedNow ? now : cur.completedAt,
                },
              },
              activity: completedNow ? bumpActivity(data, { lessons: 1 }) : data.activity,
              events: pushEvent(data.events, {
                type: completedNow ? 'lesson_completed' : 'lesson_quiz',
                title: completedNow ? `Lección completada: ${ex.title.replace('Evaluación de la lección: ', '')}` : ex.title,
                detail: `Nota ${attempt.grade?.toFixed(1)} · ${Math.round(attempt.percent * 100)} %`,
                link: `/lesson/${ex.targetId}`,
              }),
            };
          } else if (ex.kind === 'module') {
            const cur = data.modules[ex.targetId] ?? { attempts: 0 };
            data = {
              ...data,
              modules: {
                ...data.modules,
                [ex.targetId]: {
                  attempts: cur.attempts + 1,
                  bestGrade: Math.max(cur.bestGrade ?? 0, attempt.grade ?? 0),
                  passedAt: cur.passedAt ?? (attempt.passed ? now : undefined),
                },
              },
              events: pushEvent(data.events, {
                type: 'evaluation',
                title: `${ex.title} — intento ${number}`,
                detail: `Nota ${attempt.grade?.toFixed(1)} · ${attempt.passed ? 'Aprobado' : 'No aprobado'}`,
                link: `/evaluations/result/${attempt.id}`,
              }),
            };
          } else if (ex.kind === 'level') {
            data = {
              ...data,
              events: pushEvent(data.events, {
                type: 'level_exam',
                title: `${ex.title} — intento ${number}`,
                detail: `Nota ${attempt.grade?.toFixed(1)} · ${attempt.passed ? 'Aprobado' : 'No aprobado'}`,
                link: `/evaluations/result/${attempt.id}`,
              }),
            };
          }
          return data;
        },
        { achievements: true },
      );
      return attempt;
    },

    reviewWord(wordId, q) {
      commit(
        (d) => ({
          ...d,
          vocab: { ...d.vocab, cards: { ...d.vocab.cards, [wordId]: review(d.vocab.cards[wordId], q) } },
          activity: bumpActivity(d, { reviews: 1 }),
        }),
        { achievements: true },
      );
    },

    markWordKnown(wordId) {
      commit((d) => ({ ...d, vocab: { ...d.vocab, cards: { ...d.vocab.cards, [wordId]: markKnown(d.vocab.cards[wordId]) } } }));
    },

    toggleDifficult(wordId) {
      commit((d) => {
        const list = d.vocab.difficult;
        return { ...d, vocab: { ...d.vocab, difficult: list.includes(wordId) ? list.filter((w) => w !== wordId) : [...list, wordId] } };
      });
    },

    createList(name) {
      const id = uid('list');
      commit((d) => ({ ...d, vocab: { ...d.vocab, lists: [...d.vocab.lists, { id, name: name.trim() || 'Mi lista', words: [], createdAt: nowIso() }] } }));
      return id;
    },

    deleteList(listId) {
      commit((d) => ({ ...d, vocab: { ...d.vocab, lists: d.vocab.lists.filter((l) => l.id !== listId) } }));
    },

    renameList(listId, name) {
      commit((d) => ({ ...d, vocab: { ...d.vocab, lists: d.vocab.lists.map((l) => (l.id === listId ? { ...l, name } : l)) } }));
    },

    toggleWordInList(listId, wordId) {
      commit((d) => ({
        ...d,
        vocab: {
          ...d.vocab,
          lists: d.vocab.lists.map((l) =>
            l.id !== listId ? l : { ...l, words: l.words.includes(wordId) ? l.words.filter((w) => w !== wordId) : [...l.words, wordId] },
          ),
        },
      }));
    },

    completeActivity(kind, id, score, title) {
      commit(
        (d) => {
          const cur = d[kind][id];
          const completed = Boolean(cur?.completed) || score >= 0.6;
          return {
            ...d,
            [kind]: {
              ...d[kind],
              [id]: {
                completed,
                completedAt: cur?.completedAt ?? (completed ? nowIso() : undefined),
                attempts: (cur?.attempts ?? 0) + 1,
                bestScore: Math.max(cur?.bestScore ?? 0, score),
                lastScore: score,
              },
            },
            events: pushEvent(d.events, {
              type: kind === 'readings' ? 'reading' : 'listening',
              title,
              detail: `${Math.round(score * 100)} % de aciertos`,
              link: `/${kind === 'readings' ? 'reading' : 'listening'}/${id}`,
            }),
          };
        },
        { achievements: true },
      );
    },

    saveWriting(sub) {
      commit(
        (d) => ({
          ...d,
          writings: [...d.writings, sub],
          events: pushEvent(d.events, { type: 'writing', title: `Escritura: ${sub.title}`, detail: `Puntuación ${Math.round(sub.score * 100)} %`, link: '/writing' }),
        }),
        { achievements: true },
      );
    },

    reviseWriting(id, revision, score) {
      commit((d) => ({
        ...d,
        writings: d.writings.map((w) => (w.id === id ? { ...w, revision, revisedAt: nowIso(), criteria: { ...w.criteria, revisionScore: score } } : w)),
      }));
    },

    addStudySeconds(seconds, area) {
      commit((d) => {
        const key = dayKey();
        const cur = d.activity[key] ?? { seconds: 0, answers: 0, correct: 0, lessons: 0, reviews: 0 };
        const byArea = { ...(cur.byArea ?? {}), [area]: (cur.byArea?.[area] ?? 0) + seconds };
        return { ...d, activity: { ...d.activity, [key]: { ...cur, seconds: cur.seconds + seconds, byArea } } };
      });
    },

    logEvent(e) {
      commit((d) => ({ ...d, events: pushEvent(d.events, e) }), { achievements: true });
    },

    flagItem(itemId, reason, response) {
      commit((d) => ({ ...d, flags: [...d.flags, { itemId, ts: nowIso(), reason, response }] }));
    },

    updateSettings(patch) {
      commit((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
      if (patch.theme) {
        try {
          localStorage.setItem('elp:theme', patch.theme);
        } catch {
          /* sin almacenamiento */
        }
      }
    },

    updateProfile(patch) {
      commit((d) => ({ ...d, profile: { ...d.profile, ...patch } }));
    },

    saveDiagnostic(attempt, summary) {
      commit(
        (d) => ({
          ...d,
          attempts: [...d.attempts, attempt],
          profile: { ...d.profile, diagnostic: summary },
          events: pushEvent(d.events, {
            type: 'diagnostic',
            title: 'Diagnóstico inicial',
            detail: `Nivel estimado: ${summary.estimatedLevel}`,
            link: '/diagnostic',
          }),
        }),
        { achievements: true },
      );
    },

    pushToast(t) {
      set((s) => ({ toasts: [...s.toasts, { ...t, id: uid('t') }] }));
    },

    dismissToast(id) {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    },

    getArchives() {
      return adapter.getArchives();
    },

    async deleteArchive(id) {
      await adapter.deleteArchive(id);
    },

    async importData(data, archives) {
      const migrated = migrateUserData(data);
      const withEvent = { ...migrated, events: pushEvent(migrated.events, { type: 'import', title: 'Copia de seguridad importada' }) };
      await adapter.clear();
      await writeAll(withEvent);
      for (const a of archives) await adapter.putArchive(a);
      dirty.clear();
      set({ data: withEvent });
    },

    async resetCourse({ keepLists }) {
      await get().flush();
      const old = get().data;
      const archive: ArchivedCourse = {
        id: uid('course'),
        courseNumber: old.meta.courseNumber,
        archivedAt: nowIso(),
        report: buildAcademicReport(old),
        data: old,
      };
      await adapter.putArchive(archive);
      const fresh = createDefaultUserData(old.meta.courseNumber + 1);
      const data: UserData = {
        ...fresh,
        settings: old.settings,
        profile: { ...fresh.profile, name: old.profile.name, onboarded: true },
        vocab: keepLists ? { ...fresh.vocab, lists: old.vocab.lists, difficult: old.vocab.difficult } : fresh.vocab,
        events: pushEvent([], { type: 'course_reset', title: `Curso reiniciado (curso n.º ${old.meta.courseNumber + 1})`, link: '/history' }),
      };
      await writeAll(data);
      dirty.clear();
      set({ data });
    },

    async eraseAll() {
      await adapter.clear();
      const archives = await adapter.getArchives();
      for (const a of archives) await adapter.deleteArchive(a.id);
      const data = createDefaultUserData();
      await writeAll(data);
      dirty.clear();
      set({ data });
    },
  };
});

/* ───────── selectores de conveniencia ───────── */

export function useData<T>(selector: (d: UserData) => T): T {
  return useAppStore((s) => selector(s.data));
}

export function useSettings(): Settings {
  return useAppStore((s) => s.data.settings);
}
