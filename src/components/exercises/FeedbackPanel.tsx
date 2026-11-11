import { useState } from 'react';
import { Link } from 'react-router';
import { BookOpen, ChevronRight, CircleCheck, CircleX, Flag, Info, Lightbulb, ThumbsUp, TriangleAlert } from 'lucide-react';
import type { ComprehensionGroupExercise, Exercise } from '../../types/content';
import type { GradeResult } from '../../types/exercise';
import { isCorrectVerdict } from '../../types/exercise';
import { errorCatalog } from '../../services/content/catalog';
import { topicLabel, topics } from '../../services/content/loader';
import { cn } from '../../utils/cn';
import { renderInline } from '../ui/Markdown';

export function theoryLinkFor(ex: Exercise, result?: GradeResult): string | undefined {
  const tag = result?.errorTags.find((t) => errorCatalog[t]?.lesson);
  const lesson = (tag && errorCatalog[tag]?.lesson) || topics[ex.topic]?.lesson || ex.lesson;
  return lesson ? `/grammar/${lesson}` : undefined;
}

const VERDICT: Record<GradeResult['verdict'], { title: string; cls: string; icon: React.ReactNode }> = {
  correct: { title: '¡Correcto!', cls: 'text-success', icon: <CircleCheck size={22} className="text-success" /> },
  accepted_with_note: { title: 'Correcto, con una observación', cls: 'text-success', icon: <CircleCheck size={22} className="text-success" /> },
  partial: { title: 'Parcialmente correcto', cls: 'text-warning', icon: <TriangleAlert size={22} className="text-warning" /> },
  incorrect: { title: 'Respuesta incorrecta', cls: 'text-danger', icon: <CircleX size={22} className="text-danger" /> },
};

export function AnswerChip({ children, tone }: { children: React.ReactNode; tone: 'right' | 'wrong' | 'neutral' }) {
  return (
    <span
      className={cn(
        'inline-block rounded-lg px-2.5 py-1 font-mono text-[14.5px] leading-snug break-words',
        tone === 'right' ? 'bg-success-soft text-success' : tone === 'wrong' ? 'bg-danger-soft text-danger' : 'bg-surface-2 text-ink-soft',
      )}
    >
      {children}
    </span>
  );
}

export function DiffLine({ result }: { result: GradeResult }) {
  if (!result.diff?.length) return null;
  return (
    <div className="flex flex-wrap gap-1 font-mono text-[14px]">
      {result.diff.map((d, i) => (
        <span
          key={i}
          title={d.status === 'wrong' ? `Esperado: ${d.expected}` : d.status === 'missing' ? 'Falta esta palabra' : d.status === 'extra' ? 'Palabra de más' : undefined}
          className={cn(
            'rounded-md px-1.5 py-0.5',
            d.status === 'ok' && 'text-ink-soft',
            d.status === 'wrong' && 'bg-danger-soft text-danger line-through decoration-1',
            d.status === 'extra' && 'bg-warning-soft text-warning line-through decoration-1',
            d.status === 'missing' && 'border border-dashed border-success text-success',
          )}
        >
          {d.text}
          {d.status === 'wrong' && <span className="ml-1 text-success no-underline">→ {d.expected}</span>}
        </span>
      ))}
    </div>
  );
}

export function FeedbackPanel({
  exercise,
  result,
  onSelfAccept,
  onFlag,
  compact,
}: {
  exercise: Exercise;
  result: GradeResult;
  onSelfAccept?: () => void;
  onFlag?: () => void;
  compact?: boolean;
}) {
  const [showOptions, setShowOptions] = useState(!isCorrectVerdict(result.verdict));
  const v = VERDICT[result.verdict];
  const ok = isCorrectVerdict(result.verdict);
  const link = theoryLinkFor(exercise, result);
  const isGroup = exercise.type === 'reading_comprehension' || exercise.type === 'listening_comprehension';
  const textual = ['sentence_building', 'error_correction', 'translation'].includes(exercise.type);
  const notes = result.optionNotes?.filter((o) => o.why && !o.correct);

  return (
    <div aria-live="polite" className={cn('animate-pop overflow-hidden rounded-3xl border', ok ? 'border-success/25' : 'border-line')}>
      <div className={cn('flex items-center gap-3 px-5 py-3.5', ok ? 'bg-success-soft' : result.verdict === 'partial' ? 'bg-warning-soft' : 'bg-surface-2')}>
        {v.icon}
        <span className={cn('text-[17px] font-semibold', v.cls)}>{v.title}</span>
        {isGroup && <span className="ml-auto text-sm font-semibold text-ink-soft">{result.responseText}</span>}
        {!isGroup && result.score > 0 && result.score < 1 && <span className="ml-auto font-mono text-sm text-ink-soft">{Math.round(result.score * 100)} %</span>}
      </div>

      {!isGroup && (
        <div className="space-y-4 bg-surface px-5 py-4">
          {!ok && result.responseText && exercise.type !== 'writing_task' && exercise.type !== 'open_answer' && (
            <div className="flex flex-wrap items-center gap-2 text-[15px] text-ink-soft">
              <AnswerChip tone="wrong">{result.responseText}</AnswerChip>
              {result.expected && (
                <>
                  <span>debería ser</span>
                  <AnswerChip tone="right">{result.expected}</AnswerChip>
                </>
              )}
            </div>
          )}
          {ok && result.verdict === 'accepted_with_note' && result.expected && textual && (
            <div className="flex flex-wrap items-center gap-2 text-[15px] text-ink-soft">
              Versión modelo: <AnswerChip tone="right">{result.expected}</AnswerChip>
            </div>
          )}
          {!ok && textual && <DiffLine result={result} />}

          {result.parts && result.parts.length > 1 && exercise.type !== 'fill_blank' && (
            <ul className="space-y-1.5 text-[14px]">
              {result.parts.map((p, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2">
                  {p.correct ? <CircleCheck size={16} className="text-success" /> : <CircleX size={16} className="text-danger" />}
                  <span className="font-medium text-ink">{p.label}</span>
                  {!p.correct && (
                    <span className="text-muted">
                      {p.given} → <span className="text-success">{p.expected}</span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-2.5">
            {result.messages.map((m, i) => (
              <div key={i} className="flex gap-2.5 text-[15px] leading-relaxed">
                <span className="mt-0.5 shrink-0">
                  {m.tone === 'success' ? (
                    <Lightbulb size={17} className="text-success" />
                  ) : m.tone === 'error' ? (
                    <TriangleAlert size={17} className="text-danger" />
                  ) : m.tone === 'note' ? (
                    <Info size={17} className="text-warning" />
                  ) : (
                    <Info size={17} className="text-info" />
                  )}
                </span>
                <span className="text-ink-soft">{renderInline(m.text)}</span>
              </div>
            ))}
          </div>

          {notes && notes.length > 0 && (
            <div className="rounded-2xl bg-surface-2 px-4 py-3">
              <button type="button" onClick={() => setShowOptions((s) => !s)} className="flex w-full items-center gap-2 text-left text-sm font-semibold text-ink">
                <ChevronRight size={16} className={cn('transition-transform', showOptions && 'rotate-90')} />
                ¿Por qué no las otras opciones?
              </button>
              {showOptions && (
                <ul className="mt-2 space-y-1.5 pl-6 text-[14px] text-ink-soft">
                  {notes.map((o) => (
                    <li key={o.text}>
                      <span className="font-mono text-danger">{o.text}</span> — {renderInline(o.why ?? '')}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {result.alternatives && result.alternatives.length > 0 && textual && (
            <div className="text-[14px] text-ink-soft">
              <div className="label-mono mb-1">Otras respuestas válidas</div>
              <div className="flex flex-wrap gap-1.5">
                {result.alternatives.map((a) => (
                  <AnswerChip key={a} tone="neutral">
                    {a}
                  </AnswerChip>
                ))}
              </div>
            </div>
          )}
          {exercise.type === 'translation' && exercise.notes && (
            <div className="rounded-2xl border border-info/20 bg-info-soft px-4 py-3 text-[14px] text-ink">
              <span className="font-semibold">Literal vs natural: </span>
              {renderInline(exercise.notes)}
            </div>
          )}

          {!compact && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap gap-2 text-xs text-muted">
                <span className="rounded-full bg-surface-2 px-2.5 py-1">{topicLabel(exercise.topic)}</span>
                {result.errorTags.slice(0, 2).map((t) => (
                  <span key={t} className="rounded-full bg-danger-soft px-2.5 py-1 text-danger">
                    {errorCatalog[t]?.title ?? t}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {onSelfAccept && !ok && textual && (
                  <button type="button" onClick={onSelfAccept} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-ink">
                    <ThumbsUp size={15} /> Mi respuesta también es válida
                  </button>
                )}
                {onFlag && (
                  <button type="button" onClick={onFlag} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-ink">
                    <Flag size={15} /> Reportar
                  </button>
                )}
                {link && (
                  <Link to={link} className="inline-flex items-center gap-1.5 rounded-xl bg-info-soft px-3.5 py-2 text-sm font-semibold text-info hover:brightness-95">
                    <BookOpen size={15} /> Leer explicación
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {isGroup && result.sub && (
        <div className="space-y-3 bg-surface px-5 py-4">
          {(exercise as ComprehensionGroupExercise).questions.map((q, i) => {
            const r = result.sub?.[i];
            if (!r) return null;
            return (
              <div key={q.id} className="rounded-2xl bg-surface-2 px-4 py-3">
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-ink">
                  {isCorrectVerdict(r.verdict) ? <CircleCheck size={16} className="text-success" /> : <CircleX size={16} className="text-danger" />}
                  Question {i + 1}
                  {!isCorrectVerdict(r.verdict) && r.expected && <span className="font-normal text-muted">· correcta: <span className="text-success">{r.expected}</span></span>}
                </div>
                <p className="text-[14px] text-ink-soft">{renderInline(q.explanation)}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
