/**
 * Renderiza la interfaz de respuesta de cualquier tipo de ejercicio.
 * No corrige: solo produce un Response. La corrección vive en services/exercises/grade.ts.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Check, Eye, RotateCcw, X } from 'lucide-react';
import type {
  ComprehensionGroupExercise,
  ErrorIdentificationExercise,
  Exercise,
  FillBlankExercise,
  MatchingExercise,
  MultipleChoiceExercise,
  TenseIdentificationExercise,
  WordOrderExercise,
  WritingTaskExercise,
} from '../../types/content';
import type { GradeResult, Response } from '../../types/exercise';
import { isCorrectVerdict } from '../../types/exercise';
import { toOption } from '../../services/exercises/grade';
import { VERB_FORMS } from '../../services/content/taxonomy';
import { createRng, derangedPermutation, hashString, permutation } from '../../utils/random';
import { countWords } from '../../utils/text';
import { cn } from '../../utils/cn';
import { renderInline } from '../ui/Markdown';
import { SpeakButton } from '../ui/SpeakButton';

export interface ExerciseViewProps {
  exercise: Exercise;
  response: Response | undefined;
  onChange: (r: Response | undefined) => void;
  locked?: boolean;
  result?: GradeResult;
  optionOrder?: number[];
  shortcuts?: boolean;
  number?: number;
}

const LETTERS = ['a', 'b', 'c', 'd', 'e', 'f'];

/** Resalta los huecos "___" dentro de un enunciado. */
function withGaps(text: string): ReactNode {
  const parts = text.split('___');
  return parts.map((p, i) => (
    <span key={i}>
      {renderInline(p)}
      {i < parts.length - 1 && <span className="mx-1 inline-block min-w-12 border-b-2 border-ink-soft align-baseline">&nbsp;</span>}
    </span>
  ));
}

function AudioLine({ ex }: { ex: Exercise }) {
  if (!ex.audio) return null;
  return (
    <div className="mb-4 flex items-center gap-3 rounded-2xl bg-surface-2 px-3 py-2.5">
      <SpeakButton text={ex.audio} id={`ex-${ex.id}`} size="md" label="Escuchar audio" />
      <SpeakButton text={ex.audio} id={`ex-${ex.id}-slow`} size="sm" rate={0.6} label="Escuchar despacio" />
      <span className="text-sm text-muted">Escucha {ex.hideText ? 'y responde (el texto aparecerá al comprobar)' : 'el audio'}</span>
    </div>
  );
}

/* ───────── selección múltiple / V-F / tiempos ───────── */

function OptionButton({
  letter,
  label,
  selected,
  state,
  disabled,
  onClick,
}: {
  letter: string;
  label: ReactNode;
  selected: boolean;
  state?: 'correct' | 'wrong' | 'missed';
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected}
      data-answer
      className={cn(
        'flex min-h-12 w-full items-center gap-3 rounded-2xl border-2 bg-surface px-3 py-2.5 text-left text-[15px] font-medium text-ink transition-all',
        !disabled && 'hover:border-ink-soft/40',
        selected && !state && 'border-brand bg-brand-soft',
        !selected && !state && 'border-line',
        state === 'correct' && 'border-success bg-success-soft',
        state === 'wrong' && 'border-danger bg-danger-soft',
        state === 'missed' && 'border-success border-dashed',
        disabled && 'cursor-default',
      )}
    >
      <span
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold',
          state === 'correct' ? 'bg-success text-white' : state === 'wrong' ? 'bg-danger text-white' : selected ? 'bg-brand text-white' : 'bg-surface-2 text-muted',
        )}
      >
        {state === 'correct' ? <Check size={14} /> : state === 'wrong' ? <X size={14} /> : letter}
      </span>
      <span className="min-w-0 flex-1">{label}</span>
    </button>
  );
}

function useKeyChoice(enabled: boolean, count: number, pick: (i: number) => void) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const n = Number(e.key);
      if (n >= 1 && n <= count) return pick(n - 1);
      const li = LETTERS.indexOf(e.key.toLowerCase());
      if (li >= 0 && li < count) pick(li);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, count, pick]);
}

function MultipleChoiceView({ exercise: ex, response, onChange, locked, result, optionOrder, shortcuts }: ExerciseViewProps & { exercise: MultipleChoiceExercise }) {
  const order = optionOrder ?? ex.options.map((_, i) => i);
  const chosen = response?.kind === 'choice' ? response.index : undefined;
  useKeyChoice(Boolean(shortcuts && !locked), order.length, (i) => onChange({ kind: 'choice', index: order[i] }));
  const showText = !ex.hideText || Boolean(result);
  return (
    <div>
      <AudioLine ex={ex} />
      {ex.context && <p className="mb-2 text-sm text-muted">{renderInline(ex.context)}</p>}
      {showText && <p className="mb-5 text-[19px] leading-snug font-medium text-ink sm:text-[21px]">{withGaps(ex.question)}</p>}
      <div className={cn('grid gap-2.5', order.length <= 4 && ex.options.every((o) => toOption(o).text.length < 38) ? 'sm:grid-cols-2' : '')}>
        {order.map((orig, i) => {
          const opt = toOption(ex.options[orig]);
          let state: 'correct' | 'wrong' | 'missed' | undefined;
          if (result) {
            if (orig === ex.answer) state = chosen === orig ? 'correct' : 'missed';
            else if (chosen === orig) state = 'wrong';
          }
          return (
            <OptionButton
              key={orig}
              letter={LETTERS[i]}
              label={renderInline(opt.text)}
              selected={chosen === orig}
              state={state}
              disabled={locked}
              onClick={() => onChange({ kind: 'choice', index: orig })}
            />
          );
        })}
      </div>
    </div>
  );
}

function TrueFalseView({ exercise: ex, response, onChange, locked, result, shortcuts }: ExerciseViewProps & { exercise: Extract<Exercise, { type: 'true_false' }> }) {
  const v = response?.kind === 'bool' ? response.value : undefined;
  useKeyChoice(Boolean(shortcuts && !locked), 2, (i) => onChange({ kind: 'bool', value: i === 0 }));
  const showText = !ex.hideText || Boolean(result);
  return (
    <div>
      <AudioLine ex={ex} />
      {ex.context && <p className="mb-2 text-sm text-muted">{renderInline(ex.context)}</p>}
      {showText && <p className="mb-5 text-[19px] leading-snug font-medium text-ink sm:text-[21px]">{renderInline(ex.statement)}</p>}
      <div className="grid grid-cols-2 gap-2.5">
        {[true, false].map((val, i) => {
          let state: 'correct' | 'wrong' | 'missed' | undefined;
          if (result) {
            if (val === ex.answer) state = v === val ? 'correct' : 'missed';
            else if (v === val) state = 'wrong';
          }
          return (
            <OptionButton
              key={String(val)}
              letter={LETTERS[i]}
              label={val ? 'True · Verdadero' : 'False · Falso'}
              selected={v === val}
              state={state}
              disabled={locked}
              onClick={() => onChange({ kind: 'bool', value: val })}
            />
          );
        })}
      </div>
    </div>
  );
}

function TenseView({ exercise: ex, response, onChange, locked, result, optionOrder, shortcuts }: ExerciseViewProps & { exercise: TenseIdentificationExercise }) {
  const order = optionOrder ?? ex.options.map((_, i) => i);
  const v = response?.kind === 'option' ? response.value : undefined;
  useKeyChoice(Boolean(shortcuts && !locked), order.length, (i) => onChange({ kind: 'option', value: ex.options[order[i]] }));
  const sentence = ex.highlight ? ex.sentence.replace(ex.highlight, `**${ex.highlight}**`) : ex.sentence;
  return (
    <div>
      <AudioLine ex={ex} />
      <p className="mb-5 text-[19px] leading-snug font-medium text-ink sm:text-[21px]">{renderInline(sentence)}</p>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {order.map((orig, i) => {
          const id = ex.options[orig];
          let state: 'correct' | 'wrong' | 'missed' | undefined;
          if (result) {
            if (id === ex.answer) state = v === id ? 'correct' : 'missed';
            else if (v === id) state = 'wrong';
          }
          return (
            <OptionButton
              key={id}
              letter={LETTERS[i]}
              label={
                <span>
                  {VERB_FORMS[id]?.label ?? id}
                  <span className="block font-mono text-[11px] text-muted">{VERB_FORMS[id]?.example}</span>
                </span>
              }
              selected={v === id}
              state={state}
              disabled={locked}
              onClick={() => onChange({ kind: 'option', value: id })}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ───────── completar huecos ───────── */

function FillBlankView({ exercise: ex, response, onChange, locked, result }: ExerciseViewProps & { exercise: FillBlankExercise }) {
  const values = response?.kind === 'blanks' ? response.values : ex.blanks.map(() => '');
  const parts = ex.text.split('___');
  const set = (i: number, val: string) => {
    const next = ex.blanks.map((_, j) => (j === i ? val : (values[j] ?? '')));
    onChange({ kind: 'blanks', values: next });
  };
  const showText = !ex.hideText || Boolean(result);
  return (
    <div>
      <AudioLine ex={ex} />
      {showText ? (
        <p className="text-[19px] leading-[2.4] font-medium text-ink sm:text-[21px]">
          {parts.map((p, i) => {
            const blank = ex.blanks[i];
            const part = result?.parts?.[i];
            const ok = result ? (part ? part.correct : isCorrectVerdict(result.verdict)) : undefined;
            return (
              <span key={i}>
                {renderInline(p)}
                {blank && (
                  <span className="inline-flex items-baseline gap-1">
                    {blank.hint && <span className="text-muted">({blank.hint})</span>}
                    {blank.options ? (
                      <select
                        aria-label={`Hueco ${i + 1}`}
                        disabled={locked}
                        value={values[i] ?? ''}
                        onChange={(e) => set(i, e.target.value)}
                        className={cn(
                          'mx-1 rounded-xl border-2 bg-surface px-2 py-1 font-mono text-[16px] text-ink focus:border-brand focus:outline-none',
                          ok === true && 'border-success bg-success-soft text-success',
                          ok === false && 'border-danger bg-danger-soft text-danger',
                          ok === undefined && 'border-line',
                        )}
                      >
                        <option value="">—</option>
                        {blank.options.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        aria-label={`Hueco ${i + 1}`}
                        disabled={locked}
                        value={values[i] ?? ''}
                        onChange={(e) => set(i, e.target.value)}
                        autoComplete="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        size={Math.max(6, (values[i] ?? '').length + 2)}
                        className={cn(
                          'mx-1 rounded-xl border-2 bg-surface px-2.5 py-0.5 font-mono text-[16px] text-ink focus:border-brand focus:outline-none',
                          ok === true && 'border-success bg-success-soft text-success',
                          ok === false && 'border-danger bg-danger-soft text-danger',
                          ok === undefined && 'border-line',
                        )}
                      />
                    )}
                    {result && ok === false && part && (
                      <span className="rounded-lg bg-success-soft px-2 py-0.5 font-mono text-[15px] text-success">{part.expected}</span>
                    )}
                  </span>
                )}
              </span>
            );
          })}
        </p>
      ) : (
        <div className="space-y-2">
          {ex.blanks.map((b, i) => (
            <input
              key={i}
              aria-label={`Hueco ${i + 1}`}
              disabled={locked}
              value={values[i] ?? ''}
              onChange={(e) => set(i, e.target.value)}
              placeholder={`Palabra ${i + 1}${b.hint ? ` (${b.hint})` : ''}`}
              className="input font-mono"
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────── ordenar palabras ───────── */

function WordOrderView({ exercise: ex, response, onChange, locked, result }: ExerciseViewProps & { exercise: WordOrderExercise }) {
  const shuffled = useMemo(() => derangedPermutation(ex.tokens.length, createRng(hashString(ex.id))), [ex.id, ex.tokens.length]);
  const order = response?.kind === 'order' ? response.order : [];
  const used = new Set(order);
  const ok = result ? isCorrectVerdict(result.verdict) : undefined;
  return (
    <div>
      <AudioLine ex={ex} />
      {ex.clue && <p className="mb-3 text-[15px] text-muted">Significado: {renderInline(ex.clue)}</p>}
      <div
        className={cn(
          'mb-4 flex min-h-16 flex-wrap items-center gap-2 rounded-2xl border-2 border-dashed px-3 py-3',
          ok === true ? 'border-success bg-success-soft' : ok === false ? 'border-danger bg-danger-soft' : 'border-line bg-surface-2',
        )}
        aria-label="Tu oración"
      >
        {order.length === 0 && <span className="text-sm text-subtle">Toca las palabras en orden…</span>}
        {order.map((tokIdx, pos) => (
          <button
            key={`${tokIdx}-${pos}`}
            type="button"
            disabled={locked}
            data-answer
            onClick={() => onChange({ kind: 'order', order: order.filter((_, p) => p !== pos) })}
            className="rounded-xl border border-line bg-surface px-3 py-1.5 font-mono text-[15px] text-ink shadow-sm hover:border-danger/50"
          >
            {ex.tokens[tokIdx]}
          </button>
        ))}
        {(ex.punctuation ?? '.') && order.length > 0 && <span className="font-mono text-lg text-muted">{ex.punctuation ?? '.'}</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        {shuffled.map((tokIdx) => (
          <button
            key={tokIdx}
            type="button"
            disabled={locked || used.has(tokIdx)}
            data-answer
            onClick={() => onChange({ kind: 'order', order: [...order, tokIdx] })}
            className={cn(
              'rounded-xl border-2 px-3 py-1.5 font-mono text-[15px] transition-all',
              used.has(tokIdx) ? 'border-line bg-surface-2 text-transparent' : 'border-line bg-surface text-ink hover:border-brand hover:text-brand',
            )}
          >
            {ex.tokens[tokIdx]}
          </button>
        ))}
        {!locked && order.length > 0 && (
          <button type="button" onClick={() => onChange(undefined)} className="inline-flex items-center gap-1 rounded-xl px-2 text-sm text-muted hover:text-ink">
            <RotateCcw size={14} /> Reiniciar
          </button>
        )}
      </div>
    </div>
  );
}

/* ───────── texto libre ───────── */

function TextAnswerView({ exercise: ex, response, onChange, locked, result }: ExerciseViewProps) {
  const value = response?.kind === 'text' ? response.value : '';
  const set = (v: string) => onChange(v ? { kind: 'text', value: v } : undefined);
  let header: ReactNode = null;
  let multiline = false;
  let placeholder = 'Escribe tu respuesta…';
  if (ex.type === 'sentence_building') {
    header = (
      <>
        {ex.clue && <p className="mb-2 text-[15px] text-muted">{renderInline(ex.clue)}</p>}
        <p className="mb-4 rounded-2xl bg-surface-2 px-4 py-3 font-mono text-[17px] text-ink">{ex.cue}</p>
      </>
    );
    placeholder = 'Escribe la oración completa…';
  } else if (ex.type === 'error_correction') {
    header = (
      <p className="mb-4 rounded-2xl border border-danger/20 bg-danger-soft px-4 py-3 text-[18px] text-ink">
        <span className="mr-2 font-mono text-xs text-danger uppercase">con error</span>
        {ex.sentence}
      </p>
    );
    placeholder = 'Escribe la oración corregida…';
  } else if (ex.type === 'translation') {
    multiline = ex.source.length > 90;
    header = (
      <div className="mb-4 rounded-2xl bg-surface-2 px-4 py-3">
        <div className="label-mono mb-1 flex items-center gap-2">
          {ex.direction === 'en-es' ? 'Inglés → Español' : 'Español → Inglés'}
          {ex.direction === 'en-es' && <SpeakButton text={ex.source} size="xs" />}
        </div>
        <p className="text-[18px] leading-relaxed text-ink">{ex.source}</p>
      </div>
    );
    placeholder = ex.direction === 'en-es' ? 'Tu traducción al español…' : 'Your English translation…';
  } else if (ex.type === 'open_answer') {
    multiline = true;
    header = (
      <>
        <p className="mb-2 text-[19px] font-medium text-ink">{renderInline(ex.question)}</p>
        {(ex.minWords || ex.maxWords) && (
          <p className="mb-3 text-sm text-muted">
            Extensión: {ex.minWords ?? 1}–{ex.maxWords ?? '∞'} palabras · Llevas {countWords(value)}
          </p>
        )}
      </>
    );
  } else if (ex.type === 'dictation') {
    header = (
      <div className="mb-4 flex items-center gap-3 rounded-2xl bg-surface-2 px-3 py-3">
        <SpeakButton text={ex.text} id={`dict-${ex.id}`} size="md" label="Escuchar" />
        <SpeakButton text={ex.text} id={`dict-${ex.id}-slow`} size="sm" rate={0.6} label="Escuchar despacio" />
        <span className="text-sm text-muted">Escucha las veces que necesites y escribe exactamente lo que oyes.</span>
      </div>
    );
    placeholder = 'Escribe lo que oyes…';
    multiline = ex.text.length > 70;
  }
  const ok = result ? isCorrectVerdict(result.verdict) : undefined;
  const cls = cn(
    'input text-[16px]',
    ok === true && 'border-success bg-success-soft',
    ok === false && result?.verdict === 'partial' && 'border-warning bg-warning-soft',
    ok === false && result?.verdict !== 'partial' && 'border-danger bg-danger-soft',
  );
  return (
    <div>
      {ex.type !== 'dictation' && <AudioLine ex={ex} />}
      {header}
      {multiline ? (
        <textarea
          aria-label="Respuesta"
          disabled={locked}
          rows={4}
          value={value}
          onChange={(e) => set(e.target.value)}
          placeholder={placeholder}
          spellCheck={false}
          className={cn(cls, 'resize-y')}
        />
      ) : (
        <input
          aria-label="Respuesta"
          disabled={locked}
          value={value}
          onChange={(e) => set(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          autoCapitalize="sentences"
          spellCheck={false}
          className={cls}
        />
      )}
    </div>
  );
}

/* ───────── identificar error ───────── */

function ErrorIdView({ exercise: ex, response, onChange, locked, result }: ExerciseViewProps & { exercise: ErrorIdentificationExercise }) {
  const sel = response?.kind === 'segment' ? response.index : null;
  const correction = response?.kind === 'segment' ? response.correction : '';
  return (
    <div>
      <AudioLine ex={ex} />
      <div className="mb-4 flex flex-wrap gap-2">
        {ex.segments.map((s, i) => {
          const isErr = result && i === ex.errorIndex;
          const wrongSel = result && sel === i && i !== ex.errorIndex;
          return (
            <button
              key={i}
              type="button"
              disabled={locked}
              data-answer
              onClick={() => onChange({ kind: 'segment', index: i, correction: sel === i ? correction : '' })}
              className={cn(
                'rounded-xl border-2 px-3 py-2 text-[17px] transition-all',
                isErr ? 'border-success bg-success-soft text-ink' : wrongSel ? 'border-danger bg-danger-soft' : sel === i ? 'border-brand bg-brand-soft text-ink' : 'border-line bg-surface text-ink hover:border-ink-soft/40',
              )}
            >
              {s}
            </button>
          );
        })}
      </div>
      {sel !== null && (
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-ink-soft">
            Corrige «{ex.segments[sel]}»:
          </span>
          <input
            disabled={locked}
            value={correction}
            onChange={(e) => onChange({ kind: 'segment', index: sel, correction: e.target.value })}
            placeholder="Escribe la forma correcta"
            autoComplete="off"
            spellCheck={false}
            className="input font-mono"
          />
        </label>
      )}
    </div>
  );
}

/* ───────── relacionar columnas ───────── */

const PAIR_COLORS = ['bg-lvl-a1', 'bg-lvl-a2', 'bg-lvl-b1', 'bg-lvl-b2', 'bg-coral', 'bg-info', 'bg-warning', 'bg-ink-soft'];

function MatchingView({ exercise: ex, response, onChange, locked, result }: ExerciseViewProps & { exercise: MatchingExercise }) {
  const rightOrder = useMemo(() => permutation(ex.pairs.length, createRng(hashString(`${ex.id}-r`))), [ex.id, ex.pairs.length]);
  const map: (number | null)[] = response?.kind === 'pairs' ? response.map : ex.pairs.map(() => null);
  const [activeLeft, setActiveLeft] = useState<number | null>(null);
  const colorOf = (left: number) => PAIR_COLORS[left % PAIR_COLORS.length];
  const leftOfRight = (r: number) => map.findIndex((v) => v === r);

  const pickLeft = (i: number) => {
    if (locked) return;
    if (map[i] !== null && map[i] !== undefined) {
      const next = [...map];
      next[i] = null;
      onChange({ kind: 'pairs', map: next });
      setActiveLeft(i);
      return;
    }
    setActiveLeft(activeLeft === i ? null : i);
  };
  const pickRight = (r: number) => {
    if (locked || activeLeft === null) return;
    const next = map.map((v) => (v === r ? null : v));
    next[activeLeft] = r;
    onChange({ kind: 'pairs', map: next });
    const nextFree = next.findIndex((v) => v === null);
    setActiveLeft(nextFree >= 0 ? nextFree : null);
  };

  return (
    <div>
      <p className="mb-3 text-sm text-muted">Toca un elemento de la izquierda y luego su pareja de la derecha. Toca un par para deshacerlo.</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          {ex.leftTitle && <div className="label-mono">{ex.leftTitle}</div>}
          {ex.pairs.map(([left], i) => {
            const paired = map[i] !== null && map[i] !== undefined;
            const part = result?.parts?.[i];
            return (
              <button
                key={i}
                type="button"
                disabled={locked}
                data-answer
                onClick={() => pickLeft(i)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-2xl border-2 px-3 py-2.5 text-left text-[15px] text-ink transition-all',
                  part ? (part.correct ? 'border-success bg-success-soft' : 'border-danger bg-danger-soft') : activeLeft === i ? 'border-brand bg-brand-soft' : 'border-line bg-surface',
                )}
              >
                {paired && <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', colorOf(i))} />}
                {left}
              </button>
            );
          })}
        </div>
        <div className="space-y-2">
          {ex.rightTitle && <div className="label-mono">{ex.rightTitle}</div>}
          {rightOrder.map((r) => {
            const left = leftOfRight(r);
            return (
              <button
                key={r}
                type="button"
                disabled={locked}
                data-answer
                onClick={() => pickRight(r)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-2xl border-2 px-3 py-2.5 text-left text-[15px] text-ink transition-all',
                  left >= 0 ? 'border-line bg-surface-2' : 'border-line bg-surface hover:border-ink-soft/40',
                )}
              >
                {left >= 0 && <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', colorOf(left))} />}
                {ex.pairs[r][1]}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ───────── escritura ───────── */

function WritingView({ exercise: ex, response, onChange, locked }: ExerciseViewProps & { exercise: WritingTaskExercise }) {
  const value = response?.kind === 'text' ? response.value : '';
  const words = countWords(value);
  const inRange = words >= ex.minWords && words <= ex.maxWords;
  return (
    <div>
      {ex.title && <h3 className="mb-1 text-lg font-semibold text-ink">{ex.title}</h3>}
      <p className="mb-3 text-[16px] leading-relaxed text-ink-soft">{renderInline(ex.task)}</p>
      <ul className="mb-3 flex flex-wrap gap-1.5">
        {ex.requirements.map((r) => (
          <li key={r.label} className="rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-ink-soft">
            {r.label}
          </li>
        ))}
      </ul>
      <textarea
        aria-label="Tu texto"
        disabled={locked}
        rows={8}
        value={value}
        onChange={(e) => onChange(e.target.value ? { kind: 'text', value: e.target.value } : undefined)}
        placeholder="Write your text here…"
        spellCheck
        lang="en"
        className="input resize-y leading-relaxed"
      />
      <div className={cn('mt-1.5 text-right font-mono text-xs', inRange ? 'text-success' : 'text-muted')}>
        {words} / {ex.minWords}–{ex.maxWords} palabras
      </div>
    </div>
  );
}

/* ───────── grupos de comprensión ───────── */

function GroupView({ exercise: ex, response, onChange, locked, result }: ExerciseViewProps & { exercise: ComprehensionGroupExercise }) {
  const answers = response?.kind === 'group' ? response.answers : {};
  const [showText, setShowText] = useState(false);
  const isListening = ex.type === 'listening_comprehension';
  const audioLines = ex.lines?.map((l) => ({ text: l.text, speaker: l.speaker })) ?? (ex.audio ? [{ text: ex.audio }] : ex.passage ? [{ text: ex.passage }] : []);
  const textVisible = !isListening || showText || Boolean(result);
  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      <div className="space-y-3">
        {ex.title && <h3 className="text-lg font-semibold text-ink">{ex.title}</h3>}
        {(isListening || ex.audio) && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface-2 px-3 py-3">
            <SpeakButton text={audioLines} id={`grp-${ex.id}`} size="md" label="Reproducir audio" />
            <SpeakButton text={audioLines} id={`grp-${ex.id}-slow`} size="sm" rate={0.65} label="Reproducir despacio" />
            <span className="text-sm text-muted">Audio {isListening ? '(escúchalo antes de leer)' : ''}</span>
            {isListening && !result && (
              <button type="button" onClick={() => setShowText((s) => !s)} className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-info">
                <Eye size={15} /> {showText ? 'Ocultar' : 'Ver'} transcripción
              </button>
            )}
          </div>
        )}
        {textVisible && (
          <div className="rounded-2xl border border-line bg-surface px-5 py-4 text-[16px] leading-relaxed text-ink">
            {ex.lines?.length ? (
              <div className="space-y-1.5">
                {ex.lines.map((l, i) => (
                  <p key={i}>
                    <span className="mr-2 font-semibold text-brand">{l.speaker}:</span>
                    {l.text}
                  </p>
                ))}
              </div>
            ) : (
              ex.passage?.split('\n').map((p, i) => (
                <p key={i} className={i ? 'mt-3' : ''}>
                  {p}
                </p>
              ))
            )}
          </div>
        )}
      </div>
      <div className="space-y-6">
        {ex.questions.map((q, i) => (
          <div key={q.id} className="border-b border-dashed border-line pb-5 last:border-0">
            <span className="mb-2 inline-block rounded-md bg-coral px-2 py-0.5 text-xs font-semibold text-white">Question {i + 1}</span>
            <ExerciseView
              exercise={q}
              response={answers[q.id]}
              onChange={(r) => onChange({ kind: 'group', answers: { ...answers, [q.id]: r } })}
              locked={locked}
              result={result?.sub?.[i]}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────── despachador ───────── */

export function ExerciseView(props: ExerciseViewProps) {
  const ex = props.exercise;
  switch (ex.type) {
    case 'multiple_choice':
      return <MultipleChoiceView {...props} exercise={ex} />;
    case 'true_false':
      return <TrueFalseView {...props} exercise={ex} />;
    case 'tense_identification':
      return <TenseView {...props} exercise={ex} />;
    case 'fill_blank':
      return <FillBlankView {...props} exercise={ex} />;
    case 'word_order':
      return <WordOrderView {...props} exercise={ex} />;
    case 'error_identification':
      return <ErrorIdView {...props} exercise={ex} />;
    case 'matching':
      return <MatchingView {...props} exercise={ex} />;
    case 'writing_task':
      return <WritingView {...props} exercise={ex} />;
    case 'reading_comprehension':
    case 'listening_comprehension':
      return <GroupView {...props} exercise={ex} />;
    default:
      return <TextAnswerView {...props} />;
  }
}
