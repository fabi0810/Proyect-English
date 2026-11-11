import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ArrowLeft, Check, RotateCcw, Shuffle, Sparkles, Star } from 'lucide-react';
import type { VocabWord } from '../../types/content';
import { useAppStore } from '../../store/useAppStore';
import { useAsync } from '../../hooks/useAsync';
import { PageHeader } from '../../components/layout/AppShell';
import { Button, ButtonLink } from '../../components/ui/Button';
import { EmptyState, Loading, Pill, Stat } from '../../components/ui/primitives';
import { SpeakButton } from '../../components/ui/SpeakButton';
import { loadAllVocabulary } from '../../services/content/loader';
import { CATEGORY_LABELS } from '../../services/content/taxonomy';
import { isDue, review, urgency, type ReviewQuality } from '../../services/vocabulary/srs';
import { currentLevel } from '../../services/progress/stats';
import { shuffle } from '../../utils/random';
import { cn } from '../../utils/cn';

type Mode = 'adaptive' | 'due' | 'new' | 'difficult' | 'all' | `list:${string}`;
const NEW_PER_SESSION = 10;

function intervalLabel(days: number): string {
  if (days <= 1) return '1 día';
  if (days < 30) return `${days} días`;
  return `${Math.round(days / 30)} mes${days >= 60 ? 'es' : ''}`;
}

export default function FlashcardsPage() {
  const [params, setParams] = useSearchParams();
  const mode = (params.get('mode') ?? 'adaptive') as Mode;
  const dir = (params.get('dir') ?? 'en-es') as 'en-es' | 'es-en';
  const data = useAppStore((s) => s.data);
  const reviewWord = useAppStore((s) => s.reviewWord);
  const markKnown = useAppStore((s) => s.markWordKnown);
  const toggleDifficult = useAppStore((s) => s.toggleDifficult);
  const logEvent = useAppStore((s) => s.logEvent);
  const { data: all, loading } = useAsync(() => loadAllVocabulary(), []);
  const [queue, setQueue] = useState<VocabWord[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [tally, setTally] = useState({ know: 0, learning: 0 });
  const [requeued, setRequeued] = useState<Record<string, number>>({});

  const level = currentLevel(data);

  const buildQueue = useMemo(
    () => (words: VocabWord[]): VocabWord[] => {
      const cards = data.vocab.cards;
      const byId = new Map(words.map((w) => [w.id, w]));
      const due = words.filter((w) => isDue(cards[w.id])).sort((a, b) => urgency(cards[b.id]) - urgency(cards[a.id]));
      const fresh = words.filter((w) => !cards[w.id] && w.level === level).slice(0, NEW_PER_SESSION);
      const difficult = data.vocab.difficult.map((id) => byId.get(id)).filter(Boolean) as VocabWord[];
      if (mode === 'due') return due;
      if (mode === 'new') return fresh;
      if (mode === 'difficult') return difficult;
      if (mode === 'all') return shuffle(words.filter((w) => w.level === level)).slice(0, 25);
      if (mode.startsWith('list:')) {
        const list = data.vocab.lists.find((l) => l.id === mode.slice(5));
        return (list?.words.map((id) => byId.get(id)).filter(Boolean) as VocabWord[]) ?? [];
      }
      const seen = new Set<string>();
      return [...due, ...difficult.filter((w) => !isDue(cards[w.id])), ...fresh].filter((w) => (seen.has(w.id) ? false : (seen.add(w.id), true))).slice(0, 30);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, level],
  );

  useEffect(() => {
    if (all) {
      setQueue(buildQueue(all));
      setIdx(0);
      setFlipped(false);
      setTally({ know: 0, learning: 0 });
      setRequeued({});
    }
  }, [all, buildQueue]);

  const word = queue?.[idx];
  const card = word ? data.vocab.cards[word.id] : undefined;
  const remaining = queue ? Math.max(0, queue.length - idx) : 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!word) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!flipped) setFlipped(true);
      }
      if (flipped && ['1', '2', '3', '4'].includes(e.key)) rate(([1, 3, 4, 5] as ReviewQuality[])[Number(e.key) - 1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const advance = () => {
    setFlipped(false);
    setIdx((i) => i + 1);
  };

  const rate = (q: ReviewQuality) => {
    if (!word || !queue) return;
    reviewWord(word.id, q);
    if (q >= 4) setTally((t) => ({ ...t, know: t.know + 1 }));
    else setTally((t) => ({ ...t, learning: t.learning + 1 }));
    if (q === 1 && (requeued[word.id] ?? 0) < 2) {
      setQueue([...queue, word]);
      setRequeued((r) => ({ ...r, [word.id]: (r[word.id] ?? 0) + 1 }));
    }
    if (idx + 1 >= queue.length && !(q === 1 && (requeued[word.id] ?? 0) < 2)) {
      logEvent({ type: 'vocab_session', title: 'Sesión de vocabulario', detail: `${tally.know + (q >= 4 ? 1 : 0)} recordadas · ${queue.length} tarjetas`, link: '/vocabulary' });
    }
    advance();
  };

  const setMode = (m: Mode) => setParams({ mode: m, dir });

  if (loading || !queue) return <Loading />;

  const finished = idx >= queue.length;

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/vocabulary" className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft size={15} /> Vocabulary
      </Link>
      <PageHeader eyebrow="Repetición espaciada" title="Tarjetas de vocabulario" />

      <div className="mx-auto mb-6 grid max-w-xl grid-cols-3 gap-3">
        <Stat value={tally.know} label="✓ Know it" tone="success" />
        <Stat value={tally.learning} label="↺ Still learning" tone="success" />
        <Stat value={remaining} label="Remaining" />
      </div>

      {finished || !word ? (
        <EmptyState
          icon={<Check size={22} />}
          title={queue.length ? '¡Sesión completada!' : 'No hay tarjetas en este modo'}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="secondary" icon={<Sparkles size={16} />} onClick={() => setMode('new')}>
                Aprender palabras nuevas
              </Button>
              <ButtonLink to="/vocabulary/quiz" variant="primary">
                Hacer un quiz
              </ButtonLink>
            </div>
          }
        >
          {queue.length ? `Repasaste ${tally.know + tally.learning} tarjetas. Las que marcaste «Otra vez» volverán pronto.` : 'Prueba con «Aprender nuevas» o elige otra lista.'}
        </EmptyState>
      ) : (
        <>
          <div className="flip-scene mx-auto max-w-2xl">
            <div
              role="button"
              tabIndex={0}
              aria-label={flipped ? 'Tarjeta: reverso' : 'Tarjeta: toca para ver la traducción'}
              onClick={() => setFlipped((f) => !f)}
              onKeyDown={(e) => e.key === 'Enter' && setFlipped((f) => !f)}
              className={cn('flip-card relative h-[300px] cursor-pointer sm:h-[320px]', flipped && 'is-flipped')}
            >
              <div className="flip-face absolute inset-0 flex flex-col items-center justify-center rounded-[28px] bg-gradient-to-br from-[#0f1b33] to-[#1e4b8f] px-6 text-center text-white shadow-xl">
                <span className="font-mono text-xs tracking-[0.2em] opacity-70">{dir === 'en-es' ? 'ENGLISH' : 'ESPAÑOL'}</span>
                <span className="mt-3 font-serif text-5xl font-bold sm:text-6xl">{dir === 'en-es' ? word.word : word.translation}</span>
                <span className="mt-3 font-mono text-xs text-emerald-300">
                  ★ {CATEGORY_LABELS[word.category]} · {word.level}
                </span>
                <span className="mt-6 text-sm opacity-60">tap to reveal</span>
                {dir === 'en-es' && (
                  <div className="absolute top-4 right-4" onClick={(e) => e.stopPropagation()}>
                    <SpeakButton text={word.word} size="sm" className="!bg-white/15 !text-white" />
                  </div>
                )}
              </div>
              <div className="flip-face flip-back absolute inset-0 flex flex-col items-center justify-center rounded-[28px] border border-line bg-surface px-6 text-center">
                <span className="font-serif text-3xl font-bold text-ink sm:text-4xl">{dir === 'en-es' ? word.translation : word.word}</span>
                <span className="mt-1 font-mono text-sm text-muted">
                  {word.word} · {word.ipa}
                </span>
                <div className="mt-5 max-w-md text-[15px]">
                  <div className="text-ink">{word.example}</div>
                  <div className="text-muted">{word.exampleEs}</div>
                </div>
                {word.context && <p className="mt-3 max-w-md text-xs text-info">{word.context}</p>}
                <div className="absolute top-4 right-4 flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <SpeakButton text={word.word} size="sm" />
                  <SpeakButton text={word.example} id={`ex-${word.id}`} size="sm" label="Escuchar ejemplo" />
                </div>
              </div>
            </div>
          </div>

          <div className="mx-auto mt-6 max-w-2xl">
            {!flipped ? (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="secondary"
                  size="lg"
                  className="!border-2 !border-success !text-success"
                  disabled={Boolean(card)}
                  title={card ? 'Solo para palabras nuevas' : 'Programar sin estudiar (se confirmará en 4 días)'}
                  onClick={() => {
                    markKnown(word.id);
                    setTally((t) => ({ ...t, know: t.know + 1 }));
                    advance();
                  }}
                >
                  Ya la conozco
                </Button>
                <Button size="lg" variant="success" onClick={() => setFlipped(true)}>
                  Mostrar respuesta
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {([
                  [1, 'Otra vez', 'border-danger text-danger'],
                  [3, 'Difícil', 'border-warning text-warning'],
                  [4, 'Bien', 'border-success text-success'],
                  [5, 'Fácil', 'border-info text-info'],
                ] as [ReviewQuality, string, string][]).map(([q, label, cls], i) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => rate(q)}
                    className={cn('rounded-2xl border-2 bg-surface px-3 py-3 text-center font-semibold transition-colors hover:bg-surface-2', cls)}
                  >
                    <span className="block">{label}</span>
                    <span className="block font-mono text-[11px] font-normal text-muted">
                      {i + 1} · {intervalLabel(review(card, q).interval)}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <div className="mt-3 flex justify-center">
              <button type="button" onClick={() => toggleDifficult(word.id)} className={cn('inline-flex items-center gap-1.5 text-sm font-semibold', data.vocab.difficult.includes(word.id) ? 'text-warning' : 'text-muted hover:text-warning')}>
                <Star size={15} fill={data.vocab.difficult.includes(word.id) ? 'currentColor' : 'none'} /> {data.vocab.difficult.includes(word.id) ? 'Guardada como difícil' : 'Guardar como difícil'}
              </button>
            </div>
          </div>
        </>
      )}

      <div className="mt-8 flex flex-wrap justify-center gap-2">
        {(
          [
            ['adaptive', 'Adaptive ✦'],
            ['due', 'Por repasar'],
            ['new', 'Nuevas'],
            ['difficult', 'Difíciles'],
            ['all', 'Todas (aleatorio)'],
          ] as [Mode, string][]
        ).map(([m, label]) => (
          <Pill key={m} active={mode === m} onClick={() => setMode(m)}>
            {label}
          </Pill>
        ))}
        <Pill onClick={() => setParams({ mode, dir: dir === 'en-es' ? 'es-en' : 'en-es' })}>
          <Shuffle size={14} /> {dir === 'en-es' ? 'EN → ES' : 'ES → EN'}
        </Pill>
        <Pill onClick={() => all && setQueue(buildQueue(all))}>
          <RotateCcw size={14} /> Reiniciar
        </Pill>
      </div>
    </div>
  );
}
