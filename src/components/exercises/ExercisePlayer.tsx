/**
 * Reproductor de práctica: una pregunta tras otra con retroalimentación inmediata.
 * Los ítems fallados se repiten una vez al final de la sesión (repaso inmediato).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, CornerDownLeft, Flag, RotateCcw, Trophy } from 'lucide-react';
import type { Exercise } from '../../types/content';
import type { GradeResult, Response } from '../../types/exercise';
import { isCorrectVerdict } from '../../types/exercise';
import { gradeExercise, isResponseComplete } from '../../services/exercises/grade';
import { defaultPrompt, TYPE_LABELS } from '../../services/exercises/prompts';
import { topicLabel } from '../../services/content/loader';
import { useAppStore, type AnswerContext } from '../../store/useAppStore';
import { Button } from '../ui/Button';
import { Badge, ProgressBar } from '../ui/primitives';
import { Modal } from '../ui/Modal';
import { cn } from '../../utils/cn';
import { ExerciseView } from './ExerciseView';
import { FeedbackPanel } from './FeedbackPanel';

export interface PlayerSummary {
  total: number;
  correct: number;
  score: number; // 0..1 (primer intento)
  results: { exercise: Exercise; result: GradeResult }[];
}

export function ReportDialog({ exercise, response, onClose }: { exercise: Exercise | null; response?: string; onClose: () => void }) {
  const flagItem = useAppStore((s) => s.flagItem);
  const pushToast = useAppStore((s) => s.pushToast);
  const [reason, setReason] = useState('La respuesta correcta parece incorrecta');
  const reasons = ['La respuesta correcta parece incorrecta', 'Hay más de una respuesta válida', 'La explicación no es clara', 'Error de ortografía o formato', 'Otro'];
  return (
    <Modal
      open={Boolean(exercise)}
      onClose={onClose}
      title="Reportar pregunta"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              if (exercise) flagItem(exercise.id, reason, response);
              pushToast({ title: 'Pregunta reportada', description: 'Quedó registrada en Settings › Revisión de contenido.', tone: 'info' });
              onClose();
            }}
          >
            Reportar
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-muted">El reporte se guarda localmente para revisar el contenido más adelante.</p>
      <div className="space-y-2">
        {reasons.map((r) => (
          <label key={r} className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-line px-3 py-2 text-sm hover:bg-surface-2">
            <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} className="accent-[var(--brand)]" />
            {r}
          </label>
        ))}
      </div>
    </Modal>
  );
}

export function ExercisePlayer({
  exercises,
  context,
  onFinish,
  retryMistakes = true,
  finishLabel = 'Continuar',
  showSummary = true,
}: {
  exercises: Exercise[];
  context: AnswerContext;
  onFinish?: (s: PlayerSummary) => void;
  retryMistakes?: boolean;
  finishLabel?: string;
  showSummary?: boolean;
}) {
  const recordAnswer = useAppStore((s) => s.recordAnswer);
  const selfAccept = useAppStore((s) => s.selfAccept);
  const [queue, setQueue] = useState<Exercise[]>(exercises);
  const [index, setIndex] = useState(0);
  const [response, setResponse] = useState<Response | undefined>();
  const [result, setResult] = useState<GradeResult | undefined>();
  const [first, setFirst] = useState<Record<string, GradeResult>>({});
  const [done, setDone] = useState(false);
  const [reporting, setReporting] = useState<Exercise | null>(null);
  const baseCount = exercises.length;

  useEffect(() => {
    setQueue(exercises);
    setIndex(0);
    setResponse(undefined);
    setResult(undefined);
    setFirst({});
    setDone(false);
  }, [exercises]);

  const current = queue[index];
  const isRetry = index >= baseCount;
  const canCheck = current ? isResponseComplete(current, response) : false;

  const summary = useMemo<PlayerSummary>(() => {
    const results = exercises.map((e) => ({ exercise: e, result: first[e.id] })).filter((r) => r.result);
    const score = results.length ? results.reduce((s, r) => s + r.result.score, 0) / exercises.length : 0;
    return { total: exercises.length, correct: results.filter((r) => isCorrectVerdict(r.result.verdict)).length, score, results };
  }, [exercises, first]);

  const check = useCallback(() => {
    if (!current || result || !canCheck) return;
    const r = gradeExercise(current, response);
    setResult(r);
    recordAnswer(current, r, context);
    if (!first[current.id]) setFirst((f) => ({ ...f, [current.id]: r }));
    if (retryMistakes && !isRetry && !isCorrectVerdict(r.verdict) && current.type !== 'writing_task' && current.type !== 'open_answer')
      setQueue((q) => [...q, current]);
  }, [current, result, canCheck, response, recordAnswer, context, first, retryMistakes, isRetry]);

  const next = useCallback(() => {
    if (!result) return;
    if (index + 1 >= queue.length) {
      setDone(true);
      if (!showSummary) onFinish?.(summary);
      return;
    }
    setIndex((i) => i + 1);
    setResponse(undefined);
    setResult(undefined);
  }, [result, index, queue.length, showSummary, onFinish, summary]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
      const t = e.target as HTMLElement | null;
      if (!t || t.closest('[role="dialog"]') || t.tagName === 'TEXTAREA') return;
      // Enter = comprobar / siguiente, salvo en enlaces y botones secundarios (Reportar, Leer explicación…)
      if ((t.tagName === 'BUTTON' || t.tagName === 'A') && !t.closest('[data-answer]') && !t.closest('[data-primary-action]')) return;
      e.preventDefault();
      if (result) next();
      else check();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [result, next, check]);

  if (!exercises.length) return null;

  if (done && showSummary) {
    const pct = Math.round(summary.score * 100);
    return (
      <div className="card card-pad animate-pop text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
          <Trophy size={26} />
        </div>
        <h3 className="text-xl font-bold text-ink">Práctica terminada</h3>
        <p className="mt-1 text-muted">
          Acertaste <strong className="text-ink">{summary.correct}</strong> de {summary.total} al primer intento ({pct} %).
        </p>
        <ProgressBar value={summary.score} className="mx-auto mt-4 max-w-sm" barClassName={pct >= 70 ? 'bg-success' : 'bg-warning'} />
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button
            variant="secondary"
            icon={<RotateCcw size={16} />}
            onClick={() => {
              setQueue(exercises);
              setIndex(0);
              setResponse(undefined);
              setResult(undefined);
              setFirst({});
              setDone(false);
            }}
          >
            Repetir
          </Button>
          {onFinish && (
            <Button iconRight={<ArrowRight size={16} />} onClick={() => onFinish(summary)}>
              {finishLabel}
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (!current) return null;
  const progress = Math.min(index, queue.length) / queue.length;

  return (
    <div className="card card-pad">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Badge tone="info" className="px-3 py-1 text-[13px]">
          {topicLabel(current.topic)}
        </Badge>
        <span className="text-[13px] text-muted">{TYPE_LABELS[current.type]}</span>
        {isRetry && <Badge tone="warning">Repaso</Badge>}
        <div className="ml-auto flex items-center gap-3">
          <button type="button" onClick={() => setReporting(current)} title="Reportar pregunta" aria-label="Reportar pregunta" className="flex h-9 w-9 items-center justify-center rounded-full bg-coral-soft text-coral hover:brightness-95">
            <Flag size={15} />
          </button>
          <span className="font-mono text-sm font-semibold text-ink">
            {Math.min(index + 1, queue.length)}/{queue.length}
          </span>
          <ProgressBar value={progress} size="sm" className="w-24 sm:w-40" barClassName="bg-info" />
        </div>
      </div>

      <h3 className="mb-4 text-[19px] font-bold tracking-tight text-ink sm:text-[21px]">{defaultPrompt(current)}</h3>

      <ExerciseView key={`${current.id}-${index}`} exercise={current} response={response} onChange={setResponse} locked={Boolean(result)} result={result} shortcuts />

      {result && (
        <div className="mt-5">
          <FeedbackPanel
            exercise={current}
            result={result}
            onSelfAccept={
              context !== 'lesson' && context !== 'module' && context !== 'level'
                ? () => {
                    selfAccept(current, result);
                    setResult({ ...result, verdict: 'accepted_with_note', score: 1, messages: [{ tone: 'note', text: 'Marcaste tu respuesta como válida. Quedó registrada para revisar el contenido.' }, ...result.messages] });
                    setFirst((f) => ({ ...f, [current.id]: { ...result, verdict: 'accepted_with_note', score: 1 } }));
                    setQueue((q) => (q.length > baseCount && q[q.length - 1]?.id === current.id ? q.slice(0, -1) : q));
                  }
                : undefined
            }
          />
        </div>
      )}

      <div className="mt-6">
        {result ? (
          <Button block size="lg" variant="info" className="!bg-info !text-white" onClick={next} iconRight={<CornerDownLeft size={16} />} data-primary-action>
            {index + 1 >= queue.length ? 'Terminar' : 'Siguiente pregunta'}
          </Button>
        ) : (
          <Button block size="lg" onClick={check} disabled={!canCheck} data-primary-action>
            Comprobar
          </Button>
        )}
        <p className={cn('mt-2 text-center text-xs text-subtle', result && 'invisible')}>Pulsa Enter para comprobar · teclas 1–4 para elegir</p>
      </div>
      <ReportDialog exercise={reporting} response={result?.responseText} onClose={() => setReporting(null)} />
    </div>
  );
}
