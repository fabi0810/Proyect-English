import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { BookOpen, ChevronDown, CircleCheck, CircleX, Dumbbell, RotateCcw } from 'lucide-react';
import type { Exercise } from '../../types/content';
import type { EvaluationAttempt } from '../../types/progress';
import { isCorrectVerdict } from '../../types/exercise';
import { gradeExercise } from '../../services/exercises/grade';
import { defaultPrompt } from '../../services/exercises/prompts';
import { topicLabel, topics as topicMap } from '../../services/content/loader';
import { countErrors, topicBuckets } from '../../services/evaluation/results';
import { formatGrade, percentNeeded } from '../../services/evaluation/scale';
import { formatDuration } from '../../utils/dates';
import { cn } from '../../utils/cn';
import { ButtonLink } from '../ui/Button';
import { Badge, ProgressBar } from '../ui/primitives';
import { ExerciseView } from '../exercises/ExerciseView';
import { FeedbackPanel } from '../exercises/FeedbackPanel';

export function GradeHero({ attempt }: { attempt: EvaluationAttempt }) {
  const passed = Boolean(attempt.passed);
  const errors = countErrors(attempt.items);
  return (
    <div className={cn('card overflow-hidden')}>
      <div className={cn('flex flex-col gap-6 p-6 sm:flex-row sm:items-center', passed ? 'bg-success-soft' : 'bg-danger-soft')}>
        <div className="flex items-baseline gap-2">
          <span className={cn('font-mono text-6xl font-bold tracking-tight', passed ? 'text-success' : 'text-danger')}>{formatGrade(attempt.grade)}</span>
          <span className="font-mono text-lg text-muted">/ 5.0</span>
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={passed ? 'success' : 'danger'} className="px-3 py-1 text-sm">
              {passed ? 'Aprobado' : 'No aprobado'}
            </Badge>
            <span className="text-sm text-muted">Intento {attempt.number}</span>
          </div>
          <h2 className="mt-2 text-xl font-bold text-ink">{attempt.title}</h2>
          <p className="mt-1 text-sm text-muted">
            Nota mínima {attempt.passGrade.toFixed(1)} · se necesita {Math.round(percentNeeded(attempt.passGrade, attempt.exigency) * 100)} %
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 divide-x divide-line border-t border-line sm:grid-cols-4">
        {[
          { label: 'Aciertos', value: `${Math.round(attempt.percent * 100)} %` },
          { label: 'Errores', value: String(errors) },
          { label: 'Preguntas', value: String(attempt.items.length) },
          { label: 'Duración', value: formatDuration(attempt.durationSec) },
        ].map((s) => (
          <div key={s.label} className="px-4 py-4 text-center">
            <div className="font-mono text-xl font-bold text-ink">{s.value}</div>
            <div className="label-mono mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TopicsSummary({ attempt }: { attempt: EvaluationAttempt }) {
  const { mastered, pending, middle } = topicBuckets(attempt.topics);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="card card-pad">
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-ink">
          <CircleCheck size={18} className="text-success" /> Temas dominados
        </h3>
        {mastered.length ? (
          <ul className="space-y-2">
            {mastered.map((t) => (
              <li key={t} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-ink-soft">{topicLabel(t)}</span>
                <span className="font-mono text-xs text-success">{Math.round((attempt.topics[t].correct / attempt.topics[t].total) * 100)} %</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Aún ningún tema con ≥ 80 % de aciertos.</p>
        )}
      </div>
      <div className="card card-pad">
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-ink">
          <CircleX size={18} className="text-danger" /> Temas pendientes
        </h3>
        {pending.length || middle.length ? (
          <ul className="space-y-2">
            {[...pending, ...middle].map((t) => (
              <li key={t} className="flex items-center justify-between gap-2 text-sm">
                {topicMap[t]?.lesson ? (
                  <Link to={`/grammar/${topicMap[t].lesson}`} className="inline-flex items-center gap-1.5 text-ink-soft hover:text-info hover:underline">
                    <BookOpen size={13} className="text-info" /> {topicLabel(t)}
                  </Link>
                ) : (
                  <span className="text-ink-soft">{topicLabel(t)}</span>
                )}
                <span className={cn('font-mono text-xs', pending.includes(t) ? 'text-danger' : 'text-warning')}>
                  {Math.round((attempt.topics[t].correct / attempt.topics[t].total) * 100)} %
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No hay temas por debajo del 80 %. ¡Excelente!</p>
        )}
        {pending.length > 0 && <p className="mt-3 text-xs text-muted">Toca un tema para repasar su teoría.</p>}
      </div>
    </div>
  );
}

export function SectionsSummary({ attempt }: { attempt: EvaluationAttempt }) {
  if (!attempt.sections) return null;
  return (
    <div className="card card-pad">
      <h3 className="mb-4 font-semibold text-ink">Resultados por sección</h3>
      <div className="space-y-3">
        {Object.entries(attempt.sections).map(([id, s]) => (
          <div key={id}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium text-ink">
                {s.title} <span className="text-muted">· peso {Math.round(s.weight * 100)} %</span>
              </span>
              <span className={cn('font-mono text-xs font-semibold', s.passed ? 'text-success' : 'text-danger')}>
                {Math.round(s.percent * 100)} % {s.passed ? '' : '(mínimo no alcanzado)'}
              </span>
            </div>
            <ProgressBar value={s.percent} size="sm" barClassName={s.passed ? 'bg-success' : 'bg-danger'} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AttemptReview({ attempt, exercises }: { attempt: EvaluationAttempt; exercises: Map<string, Exercise> }) {
  const [filter, setFilter] = useState<'all' | 'wrong'>('wrong');
  const [open, setOpen] = useState<string | null>(null);
  const items = useMemo(
    () =>
      attempt.items
        .map((it, i) => ({ it, i, ex: exercises.get(it.id) }))
        .filter((x) => x.ex)
        .map((x) => ({ ...x, result: gradeExercise(x.ex as Exercise, x.it.response) })),
    [attempt, exercises],
  );
  const shown = filter === 'wrong' ? items.filter((x) => !isCorrectVerdict(x.result.verdict)) : items;
  return (
    <div className="card card-pad">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold text-ink">Revisión pregunta por pregunta</h3>
        <div className="flex gap-1 rounded-xl bg-surface-2 p-1 text-sm">
          {(['wrong', 'all'] as const).map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)} className={cn('rounded-lg px-3 py-1 font-semibold', filter === f ? 'bg-surface text-ink shadow-sm' : 'text-muted')}>
              {f === 'wrong' ? `Errores (${items.filter((x) => !isCorrectVerdict(x.result.verdict)).length})` : `Todas (${items.length})`}
            </button>
          ))}
        </div>
      </div>
      {shown.length === 0 && <p className="text-sm text-muted">No hay preguntas con error. 🎉</p>}
      <div className="space-y-2">
        {shown.map(({ it, i, ex, result }) => {
          const ok = isCorrectVerdict(result.verdict);
          const isOpen = open === it.id;
          return (
            <div key={it.id} className="rounded-2xl border border-line">
              <button type="button" onClick={() => setOpen(isOpen ? null : it.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                {ok ? <CircleCheck size={18} className="shrink-0 text-success" /> : result.verdict === 'partial' ? <CircleCheck size={18} className="shrink-0 text-warning" /> : <CircleX size={18} className="shrink-0 text-danger" />}
                <span className="font-mono text-xs text-muted">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{topicLabel((ex as Exercise).topic)}</span>
                <span className="font-mono text-xs text-muted">{Math.round(result.score * 100)} %</span>
                <ChevronDown size={16} className={cn('shrink-0 text-muted transition-transform', isOpen && 'rotate-180')} />
              </button>
              {isOpen && ex && (
                <div className="space-y-4 border-t border-line px-4 py-4">
                  <p className="font-semibold text-ink">{defaultPrompt(ex)}</p>
                  <ExerciseView exercise={ex} response={it.response} onChange={() => undefined} locked result={result} optionOrder={it.optionOrder} />
                  <FeedbackPanel exercise={ex} result={result} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ExamResultView({
  attempt,
  exercises,
  retryLink,
  practiceLink,
  continueLink,
  continueLabel,
}: {
  attempt: EvaluationAttempt;
  exercises: Map<string, Exercise>;
  retryLink?: string;
  practiceLink?: string;
  continueLink?: string;
  continueLabel?: string;
}) {
  return (
    <div className="space-y-5">
      <GradeHero attempt={attempt} />
      <SectionsSummary attempt={attempt} />
      <TopicsSummary attempt={attempt} />
      <div className="flex flex-wrap gap-2">
        {continueLink && <ButtonLink to={continueLink}>{continueLabel ?? 'Continuar'}</ButtonLink>}
        {practiceLink && !attempt.passed && (
          <ButtonLink to={practiceLink} variant="brand" icon={<Dumbbell size={16} />}>
            Practicar temas pendientes
          </ButtonLink>
        )}
        {retryLink && (
          <ButtonLink to={retryLink} variant="secondary" icon={<RotateCcw size={16} />}>
            {attempt.passed ? 'Volver a presentar' : 'Reintentar (preguntas nuevas)'}
          </ButtonLink>
        )}
      </div>
      <AttemptReview attempt={attempt} exercises={exercises} />
    </div>
  );
}
