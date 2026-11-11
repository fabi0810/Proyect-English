/**
 * Ejecutor de evaluaciones: sin respuestas ni explicaciones hasta entregar,
 * navegación libre, marcar para revisar y autoguardado (se reanuda tras recargar).
 */
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Bookmark, BookmarkCheck, Clock, Send } from 'lucide-react';
import type { Exercise } from '../../types/content';
import type { ActiveExam } from '../../types/progress';
import { isResponseComplete } from '../../services/exercises/grade';
import { defaultPrompt } from '../../services/exercises/prompts';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/Modal';
import { Badge, ProgressBar } from '../ui/primitives';
import { ExerciseView } from '../exercises/ExerciseView';
import { cn } from '../../utils/cn';

function Elapsed({ since }: { since: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const s = Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-sm text-muted">
      <Clock size={14} /> {mm}:{ss}
    </span>
  );
}

export function ExamRunner({
  exam,
  exercises,
  onSubmit,
  onAbandon,
  compact,
}: {
  exam: ActiveExam;
  exercises: Map<string, Exercise>;
  onSubmit: () => void;
  onAbandon?: () => void;
  compact?: boolean;
}) {
  const setAnswer = useAppStore((s) => s.setExamAnswer);
  const setCurrent = useAppStore((s) => s.setExamCurrent);
  const toggleFlag = useAppStore((s) => s.toggleExamFlag);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [confirmAbandon, setConfirmAbandon] = useState(false);

  const index = Math.min(exam.current, exam.items.length - 1);
  const item = exam.items[index];
  const ex = exercises.get(item.id);
  const answered = useMemo(
    () => exam.items.map((it) => {
      const e = exercises.get(it.id);
      return e ? isResponseComplete(e, exam.answers[it.id]) : false;
    }),
    [exam.items, exam.answers, exercises],
  );
  const answeredCount = answered.filter(Boolean).length;
  const unanswered = exam.items.length - answeredCount;
  const flagged = exam.flagged.includes(item.id);
  const section = exam.sections?.find((s) => s.id === item.section);

  const go = (i: number) => setCurrent(Math.max(0, Math.min(exam.items.length - 1, i)));

  return (
    <div className={cn('grid gap-5', !compact && 'lg:grid-cols-[1fr_260px]')}>
      <div className="card card-pad min-w-0">
        <div className="mb-5 flex flex-wrap items-center gap-2">
          {section && <Badge tone="brand">{section.title}</Badge>}
          <span className="text-sm font-semibold text-ink">
            Pregunta {index + 1} de {exam.items.length}
          </span>
          <div className="ml-auto flex items-center gap-3">
            <Elapsed since={exam.startedAt} />
            <button
              type="button"
              onClick={() => toggleFlag(item.id)}
              className={cn('inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold', flagged ? 'bg-warning-soft text-warning' : 'text-muted hover:bg-surface-2')}
            >
              {flagged ? <BookmarkCheck size={15} /> : <Bookmark size={15} />} {flagged ? 'Marcada' : 'Marcar'}
            </button>
          </div>
        </div>
        <ProgressBar value={answeredCount / exam.items.length} size="xs" className="mb-6" barClassName="bg-ink" label="Preguntas respondidas" />

        {ex ? (
          <>
            <h3 className="mb-4 text-[19px] font-bold tracking-tight text-ink">{defaultPrompt(ex)}</h3>
            <ExerciseView
              key={item.id}
              exercise={ex}
              response={exam.answers[item.id]}
              onChange={(r) => setAnswer(item.id, r)}
              optionOrder={item.optionOrder}
              shortcuts
            />
          </>
        ) : (
          <p className="text-danger">No se encontró la pregunta {item.id}. Puede que el contenido haya cambiado.</p>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <Button variant="secondary" icon={<ArrowLeft size={16} />} onClick={() => go(index - 1)} disabled={index === 0}>
            Anterior
          </Button>
          {index < exam.items.length - 1 ? (
            <Button iconRight={<ArrowRight size={16} />} onClick={() => go(index + 1)}>
              Siguiente
            </Button>
          ) : (
            <Button variant="brand" icon={<Send size={16} />} onClick={() => setConfirmSubmit(true)}>
              Entregar evaluación
            </Button>
          )}
        </div>
      </div>

      <aside className={cn('card card-pad h-fit', !compact && 'lg:sticky lg:top-6')}>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-ink">Preguntas</span>
          <span className="font-mono text-xs text-muted">
            {answeredCount}/{exam.items.length}
          </span>
        </div>
        <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8 lg:grid-cols-5">
          {exam.items.map((it, i) => (
            <button
              key={it.id}
              type="button"
              onClick={() => go(i)}
              aria-label={`Ir a la pregunta ${i + 1}`}
              className={cn(
                'relative flex h-9 items-center justify-center rounded-lg font-mono text-xs font-semibold transition-colors',
                i === index ? 'bg-ink text-on-ink' : answered[i] ? 'bg-brand-soft text-brand' : 'bg-surface-2 text-muted hover:bg-surface-3',
                exam.flagged.includes(it.id) && 'ring-2 ring-warning',
              )}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <div className="mt-4 space-y-1.5 text-xs text-muted">
          <div className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-brand-soft" /> Respondida</div>
          <div className="flex items-center gap-2"><span className="h-3 w-3 rounded ring-2 ring-warning" /> Marcada para revisar</div>
        </div>
        <Button block variant="brand" className="mt-5" icon={<Send size={16} />} onClick={() => setConfirmSubmit(true)}>
          Entregar
        </Button>
        {onAbandon && (
          <button type="button" onClick={() => setConfirmAbandon(true)} className="mt-3 w-full text-center text-xs font-semibold text-muted hover:text-danger">
            Abandonar evaluación
          </button>
        )}
        <p className="mt-4 text-[11px] leading-snug text-subtle">Tus respuestas se guardan automáticamente. Las soluciones se muestran al entregar.</p>
      </aside>

      <ConfirmDialog
        open={confirmSubmit}
        title="¿Entregar la evaluación?"
        confirmLabel="Entregar"
        onCancel={() => setConfirmSubmit(false)}
        onConfirm={() => {
          setConfirmSubmit(false);
          onSubmit();
        }}
      >
        {unanswered > 0 ? (
          <p>
            Tienes <strong className="text-danger">{unanswered} pregunta{unanswered === 1 ? '' : 's'} sin responder</strong>; contarán como incorrectas.
          </p>
        ) : (
          <p>Has respondido todas las preguntas.</p>
        )}
        {exam.flagged.length > 0 && <p className="mt-2">Marcaste {exam.flagged.length} para revisar.</p>}
        <p className="mt-2 text-sm text-muted">Después de entregar verás tu nota y la explicación de cada respuesta.</p>
      </ConfirmDialog>
      <ConfirmDialog
        open={confirmAbandon}
        title="¿Abandonar la evaluación?"
        confirmLabel="Abandonar"
        danger
        onCancel={() => setConfirmAbandon(false)}
        onConfirm={() => {
          setConfirmAbandon(false);
          onAbandon?.();
        }}
      >
        Quedará registrada como abandonada (sin nota). Las preguntas vistas no se repetirán en el próximo intento si hay suficiente banco.
      </ConfirmDialog>
    </div>
  );
}
