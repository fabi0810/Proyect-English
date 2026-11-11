import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, ArrowRight, BookOpen, CircleCheck, ClipboardCheck, Lock, Target } from 'lucide-react';
import type { Exercise, Lesson, Module } from '../../types/content';
import { useAppStore } from '../../store/useAppStore';
import { useAsync } from '../../hooks/useAsync';
import { PageHeader } from '../../components/layout/AppShell';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Callout, Card, ErrorBox, LevelBadge, Loading } from '../../components/ui/primitives';
import { TheoryBlocks } from '../../components/lessons/TheoryBlocks';
import { ExercisePlayer } from '../../components/exercises/ExercisePlayer';
import { ExamRunner } from '../../components/evaluations/ExamRunner';
import { ExamResultView } from '../../components/evaluations/ExamResultView';
import { loadModule, moduleIdOfLesson } from '../../services/content/loader';
import { lessonPassPercent, lessonState } from '../../services/progress/unlock';
import { buildLessonQuiz, LESSON_QUIZ_SIZE } from '../../services/evaluation/builders';
import { randomSeed } from '../../utils/random';
import { cn } from '../../utils/cn';

const STEPS = [
  { key: 'intro', label: 'Introducción', short: 'A' },
  { key: 'theory', label: 'Explicación', short: 'B–D' },
  { key: 'guided', label: 'Práctica guiada', short: 'E' },
  { key: 'independent', label: 'Práctica independiente', short: 'F' },
  { key: 'summary', label: 'Resumen', short: 'H' },
  { key: 'quiz', label: 'Evaluación', short: 'I' },
] as const;

function Stepper({ step, onStep, done }: { step: number; onStep: (i: number) => void; done: boolean[] }) {
  return (
    <ol className="mb-6 flex gap-1.5 overflow-x-auto pb-1">
      {STEPS.map((s, i) => (
        <li key={s.key} className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onStep(i)}
            className={cn(
              'flex w-full min-w-[96px] flex-col items-start rounded-2xl border px-3 py-2 text-left transition-colors',
              i === step ? 'border-ink bg-ink text-on-ink' : done[i] ? 'border-success/30 bg-success-soft text-ink' : 'border-line bg-surface text-ink-soft hover:bg-surface-2',
            )}
          >
            <span className={cn('font-mono text-[10px] tracking-wider uppercase', i === step ? 'opacity-70' : 'text-muted')}>
              {s.short} {done[i] && i !== step && '✓'}
            </span>
            <span className="truncate text-[13px] font-semibold">{s.label}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

function LessonQuiz({ mod, lesson }: { mod: Module; lesson: Lesson }) {
  const data = useAppStore((s) => s.data);
  const active = data.activeExam;
  const startExam = useAppStore((s) => s.startExam);
  const submitExam = useAppStore((s) => s.submitExam);
  const abandonExam = useAppStore((s) => s.abandonExam);
  const [resultId, setResultId] = useState<string | null>(null);
  const isThis = active?.kind === 'lesson' && active.targetId === lesson.id;
  const quizMap = useMemo(() => new Map<string, Exercise>(lesson.quiz.map((e) => [e.id, e])), [lesson]);
  const attempts = data.attempts.filter((a) => a.kind === 'lesson' && a.targetId === lesson.id && a.status === 'completed');
  const result = resultId ? data.attempts.find((a) => a.id === resultId) : undefined;
  const pass = Math.round(lessonPassPercent(data) * 100);
  const idx = mod.lessons.findIndex((l) => l.id === lesson.id);
  const nextLesson = mod.lessons[idx + 1];

  if (result) {
    return (
      <ExamResultView
        attempt={result}
        exercises={quizMap}
        continueLink={result.passed ? (nextLesson ? `/lesson/${nextLesson.id}` : `/module/${mod.id}`) : undefined}
        continueLabel={nextLesson ? 'Siguiente lección' : 'Ir a la evaluación del módulo'}
      />
    );
  }
  if (isThis && active) {
    return (
      <ExamRunner
        exam={active}
        exercises={quizMap}
        compact
        onSubmit={() => {
          const a = submitExam(quizMap);
          if (a) setResultId(a.id);
        }}
        onAbandon={() => abandonExam()}
      />
    );
  }
  return (
    <Card>
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand">
          <ClipboardCheck size={22} />
        </span>
        <div>
          <h3 className="text-lg font-semibold text-ink">Evaluación de la lección</h3>
          <p className="mt-1 text-[15px] text-ink-soft">
            {LESSON_QUIZ_SIZE} preguntas elegidas al azar de un banco de {lesson.quiz.length}. Sin ayudas hasta entregar. Para completar la lección necesitas al menos {pass} % de aciertos.
          </p>
          {attempts.length > 0 && (
            <p className="mt-2 text-sm text-muted">
              Intentos: {attempts.length} · mejor resultado {Math.round(Math.max(...attempts.map((a) => a.percent)) * 100)} %
            </p>
          )}
        </div>
      </div>
      {active && !isThis ? (
        <Callout tone="warning" className="mt-5" title="Hay otra evaluación en curso">
          Termina o abandona «{active.title}» antes de empezar esta.{' '}
          <button type="button" onClick={() => abandonExam()} className="font-semibold text-danger underline-offset-2 hover:underline">
            Abandonarla
          </button>
        </Callout>
      ) : (
        <Button className="mt-5" size="lg" onClick={() => startExam(buildLessonQuiz(lesson, mod.level, data, randomSeed()))}>
          {attempts.length ? 'Nuevo intento' : 'Comenzar evaluación'}
        </Button>
      )}
    </Card>
  );
}

export default function LessonPage() {
  const { lessonId } = useParams() as { lessonId: string };
  const moduleId = moduleIdOfLesson(lessonId);
  const { data: mod, error, loading } = useAsync(() => loadModule(moduleId), [moduleId]);
  const data = useAppStore((s) => s.data);
  const touchLesson = useAppStore((s) => s.touchLesson);
  const markPractice = useAppStore((s) => s.markLessonPractice);
  const progress = data.lessons[lessonId];
  const [step, setStep] = useState<number>(progress?.step ?? 0);

  useEffect(() => {
    setStep(useAppStore.getState().data.lessons[lessonId]?.step ?? 0);
  }, [lessonId]);

  const goto = (i: number) => {
    const s = Math.max(0, Math.min(STEPS.length - 1, i));
    setStep(s);
    touchLesson(lessonId, s);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) return <Loading />;
  if (error || !mod) return <ErrorBox error={error ?? 'No disponible'} />;
  const index = mod.lessons.findIndex((l) => l.id === lessonId);
  const lesson = mod.lessons[index];
  if (!lesson) return <ErrorBox error={`Lección desconocida: ${lessonId}`} />;
  const state = lessonState(mod, index, data);

  if (state === 'locked') {
    return (
      <div className="mx-auto max-w-xl py-10 text-center">
        <Lock className="mx-auto mb-3 text-muted" />
        <h1 className="text-xl font-bold text-ink">Lección bloqueada</h1>
        <p className="mt-2 text-muted">Completa la lección anterior aprobando su evaluación. Puedes leer la teoría en el libro de gramática.</p>
        <div className="mt-5 flex justify-center gap-2">
          <ButtonLink to={`/module/${mod.id}`} variant="secondary">
            Volver al módulo
          </ButtonLink>
          <ButtonLink to={`/grammar/${lesson.id}`} icon={<BookOpen size={16} />}>
            Leer la teoría
          </ButtonLink>
        </div>
      </div>
    );
  }

  const done = [step > 0 || Boolean(progress), step > 1 || (progress?.step ?? 0) > 1, Boolean(progress?.guidedDone), Boolean(progress?.independentDone), (progress?.step ?? 0) > 4, progress?.status === 'completed'];

  return (
    <div>
      <Link to={`/module/${mod.id}`} className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft size={15} /> {mod.title}
      </Link>
      <PageHeader
        eyebrow={
          <span className="flex items-center gap-2">
            <LevelBadge level={mod.level} /> Lección {index + 1} de {mod.lessons.length}
          </span>
        }
        title={lesson.title}
        subtitle={lesson.titleEs}
        actions={progress?.status === 'completed' ? <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1.5 text-sm font-semibold text-success"><CircleCheck size={16} /> Completada</span> : undefined}
      />
      <Stepper step={step} onStep={goto} done={done} />

      {step === 0 && (
        <Card className="space-y-5">
          <div>
            <div className="label-mono mb-1">Objetivo</div>
            <p className="text-[17px] font-medium text-ink">{lesson.objective}</p>
          </div>
          <div>
            <div className="label-mono mb-2">Qué aprenderás</div>
            <ul className="space-y-2">
              {lesson.learn.map((l) => (
                <li key={l} className="flex gap-2.5 text-[15px] text-ink-soft">
                  <Target size={17} className="mt-0.5 shrink-0 text-brand" /> {l}
                </li>
              ))}
            </ul>
          </div>
          <Callout tone="info" title="Por qué es importante">
            {lesson.why}
          </Callout>
          <p className="text-sm text-muted">
            Nivel {mod.level} · Módulo «{mod.title}» · Las explicaciones están en español; los ejemplos, en inglés con audio.
          </p>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <TheoryBlocks blocks={lesson.theory} />
        </Card>
      )}

      {step === 2 && (
        <ExercisePlayer
          exercises={lesson.guided}
          context="guided"
          finishLabel="Ir a la práctica independiente"
          onFinish={() => {
            markPractice(lesson.id, 'guided');
            goto(3);
          }}
        />
      )}

      {step === 3 && (
        <ExercisePlayer
          exercises={lesson.independent}
          context="independent"
          finishLabel="Ver el resumen"
          onFinish={() => {
            markPractice(lesson.id, 'independent');
            goto(4);
          }}
        />
      )}

      {step === 4 && (
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-ink">Puntos clave para recordar</h2>
          <ul className="space-y-3">
            {lesson.summary.map((s, i) => (
              <li key={i} className="flex gap-3 text-[15.5px] leading-relaxed text-ink-soft">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft font-mono text-xs font-bold text-brand">{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {step === 5 && <LessonQuiz key={lesson.id} mod={mod} lesson={lesson} />}

      {step !== 2 && step !== 3 && (
        <div className="mt-6 flex justify-between gap-3">
          <Button variant="secondary" icon={<ArrowLeft size={16} />} onClick={() => goto(step - 1)} disabled={step === 0}>
            Anterior
          </Button>
          {step < STEPS.length - 1 && (
            <Button iconRight={<ArrowRight size={16} />} onClick={() => goto(step + 1)}>
              {step === 1 ? 'Practicar' : step === 4 ? 'Ir a la evaluación' : 'Continuar'}
            </Button>
          )}
        </div>
      )}
      {(step === 2 || step === 3) && (
        <div className="mt-4 flex justify-between text-sm">
          <button type="button" onClick={() => goto(step - 1)} className="font-semibold text-muted hover:text-ink">
            ← {STEPS[step - 1].label}
          </button>
          <button type="button" onClick={() => goto(step + 1)} className="font-semibold text-muted hover:text-ink">
            Saltar a {STEPS[step + 1].label} →
          </button>
        </div>
      )}
    </div>
  );
}
