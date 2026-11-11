import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, Highlighter, Languages, ListPlus, MousePointerClick, Star, X } from 'lucide-react';
import type { Exercise, Reading, ReadingSentence, VocabWord } from '../../types/content';
import type { GradeResult, Response } from '../../types/exercise';
import { isCorrectVerdict } from '../../types/exercise';
import { useAppStore } from '../../store/useAppStore';
import { useAsync } from '../../hooks/useAsync';
import { PageHeader } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { Badge, Callout, Card, ErrorBox, LevelBadge, Loading, Pill } from '../../components/ui/primitives';
import { SpeakButton } from '../../components/ui/SpeakButton';
import { AudioPlayer } from '../../components/listening/AudioPlayer';
import { ExerciseView } from '../../components/exercises/ExerciseView';
import { FeedbackPanel } from '../../components/exercises/FeedbackPanel';
import { loadAllVocabulary, levelOfId, loadReadings, topicLabel } from '../../services/content/loader';
import { GENRE_LABELS, VERB_FORMS } from '../../services/content/taxonomy';
import { gradeExercise, isResponseComplete } from '../../services/exercises/grade';
import { defaultPrompt } from '../../services/exercises/prompts';
import { cn } from '../../utils/cn';

type Token = { text: string; word: boolean; i: number };

export function tokenize(s: string): Token[] {
  const out: Token[] = [];
  const re = /([A-Za-zÀ-ÿ0-9]+(?:['’][A-Za-z]+)*)|([^A-Za-zÀ-ÿ0-9]+)/g;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(s)) !== null) out.push({ text: m[0], word: Boolean(m[1]), i: i++ });
  return out;
}

const lower = (s: string) => s.toLowerCase().replace(/’/g, "'");

/** Índices de token que pertenecen a cada forma verbal anotada. */
export function verbTokenMap(sentence: ReadingSentence): Map<number, string> {
  const tokens = tokenize(sentence.en).filter((t) => t.word);
  const map = new Map<number, string>();
  for (const [form, tense] of sentence.verbs ?? []) {
    const ft = tokenize(form).filter((t) => t.word).map((t) => lower(t.text));
    for (let s = 0; s + ft.length <= tokens.length; s++) {
      const ok = ft.every((f, k) => lower(tokens[s + k].text) === f && !map.has(tokens[s + k].i));
      if (ok) {
        ft.forEach((_, k) => map.set(tokens[s + k].i, tense));
        break;
      }
    }
  }
  return map;
}

function lemmaCandidates(w: string): string[] {
  const x = lower(w).replace(/'s$/, '');
  const c = [x];
  if (x.endsWith('ies')) c.push(`${x.slice(0, -3)}y`);
  if (x.endsWith('es')) c.push(x.slice(0, -2));
  if (x.endsWith('s')) c.push(x.slice(0, -1));
  if (x.endsWith('ed')) c.push(x.slice(0, -2), x.slice(0, -1));
  if (x.endsWith('ing')) c.push(x.slice(0, -3), `${x.slice(0, -3)}e`);
  return c;
}

interface Lookup {
  term: string;
  es?: string;
  note?: string;
  word?: VocabWord;
}

const TENSE_COLORS = ['bg-lvl-a1-soft text-lvl-a1', 'bg-lvl-a2-soft text-lvl-a2', 'bg-lvl-b1-soft text-lvl-b1', 'bg-lvl-b2-soft text-lvl-b2', 'bg-coral-soft text-coral', 'bg-info-soft text-info'];

function ReaderText({
  reading,
  vocab,
  mode,
  showTranslation,
  highlight,
  selected,
  onToggleSelect,
  checked,
  onLookup,
}: {
  reading: Reading;
  vocab: Map<string, VocabWord>;
  mode: 'read' | 'verbs';
  showTranslation: boolean;
  highlight: boolean;
  selected: Set<string>;
  onToggleSelect: (key: string) => void;
  checked: boolean;
  onLookup: (l: Lookup) => void;
}) {
  const [openSentence, setOpenSentence] = useState<string | null>(null);
  const tenses = Array.from(new Set(reading.paragraphs.flatMap((p) => p.sentences.flatMap((s) => (s.verbs ?? []).map((v) => v[1])))));
  const colorOf = (t: string) => TENSE_COLORS[tenses.indexOf(t) % TENSE_COLORS.length];

  const lookup = (tokens: Token[], idx: number) => {
    const words = tokens.filter((t) => t.word);
    const pos = words.findIndex((t) => t.i === idx);
    for (const g of reading.glossary) {
      const gt = tokenize(g.term).filter((t) => t.word).map((t) => lower(t.text));
      for (let start = Math.max(0, pos - gt.length + 1); start <= pos; start++) {
        if (gt.every((f, k) => words[start + k] && lower(words[start + k].text) === f)) return onLookup({ term: g.term, es: g.es, note: g.note });
      }
    }
    for (const c of lemmaCandidates(words[pos].text)) {
      const v = vocab.get(c);
      if (v) return onLookup({ term: words[pos].text, es: v.translation, note: v.context, word: v });
    }
    onLookup({ term: words[pos].text });
  };

  return (
    <div className="space-y-4 text-[17px] leading-[1.85] text-ink">
      {reading.paragraphs.map((p, pi) => (
        <div key={pi} className={p.speaker ? 'flex gap-2' : undefined}>
          {p.speaker && <span className="shrink-0 font-semibold text-brand">{p.speaker}:</span>}
          <p>
            {p.sentences.map((s, si) => {
              const key = `${pi}-${si}`;
              const tokens = tokenize(s.en);
              const verbs = verbTokenMap(s);
              return (
                <span key={key}>
                  {tokens.map((t) => {
                    if (!t.word) return <span key={t.i}>{t.text}</span>;
                    const tkey = `${key}-${t.i}`;
                    const isVerb = verbs.has(t.i);
                    const sel = selected.has(tkey);
                    let cls = 'rounded px-[1px] hover:bg-highlight cursor-pointer';
                    if (mode === 'verbs' && checked) cls = cn(cls, isVerb && sel && 'bg-success-soft text-success', isVerb && !sel && 'outline-1 outline-dashed outline-success', !isVerb && sel && 'bg-danger-soft text-danger line-through');
                    else if (mode === 'verbs' && sel) cls = cn(cls, 'bg-brand-soft text-brand');
                    else if (highlight && isVerb) cls = cn(cls, colorOf(verbs.get(t.i) as string), 'font-semibold');
                    return (
                      <span
                        key={t.i}
                        role="button"
                        tabIndex={0}
                        title={highlight && isVerb ? VERB_FORMS[verbs.get(t.i) as string]?.label : undefined}
                        onClick={() => (mode === 'verbs' && !checked ? onToggleSelect(tkey) : lookup(tokens, t.i))}
                        onKeyDown={(e) => e.key === 'Enter' && (mode === 'verbs' && !checked ? onToggleSelect(tkey) : lookup(tokens, t.i))}
                        className={cls}
                      >
                        {t.text}
                      </span>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setOpenSentence(openSentence === key ? null : key)}
                    title="Traducir esta oración"
                    aria-label="Traducir esta oración"
                    className="mx-1 inline-flex h-5 w-5 translate-y-[-1px] items-center justify-center rounded-full align-middle text-subtle hover:bg-info-soft hover:text-info"
                  >
                    <Languages size={12} />
                  </button>
                  {(showTranslation || openSentence === key) && <span className="mb-1 block rounded-lg bg-info-soft px-2 py-1 text-[14px] leading-snug text-ink-soft">{s.es}</span>}{' '}
                </span>
              );
            })}
          </p>
        </div>
      ))}
      {highlight && tenses.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-line pt-3">
          {tenses.map((t) => (
            <span key={t} className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', colorOf(t))}>
              {VERB_FORMS[t]?.label ?? t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ReadingPage() {
  const { id } = useParams() as { id: string };
  const level = levelOfId(id) ?? 'A1';
  const { data, error, loading } = useAsync(async () => {
    const [readings, vocab] = await Promise.all([loadReadings(level), loadAllVocabulary()]);
    return { reading: readings.find((r) => r.id === id), vocab: new Map(vocab.map((v) => [v.word.toLowerCase(), v])) };
  }, [id]);
  const recordAnswer = useAppStore((s) => s.recordAnswer);
  const completeActivity = useAppStore((s) => s.completeActivity);
  const toggleDifficult = useAppStore((s) => s.toggleDifficult);
  const difficult = useAppStore((s) => s.data.vocab.difficult);
  const progress = useAppStore((s) => s.data.readings[id]);

  const [mode, setMode] = useState<'read' | 'verbs'>('read');
  const [showTr, setShowTr] = useState(false);
  const [highlight, setHighlight] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [verbsChecked, setVerbsChecked] = useState(false);
  const [lookupResult, setLookup] = useState<Lookup | null>(null);
  const [answers, setAnswers] = useState<Record<string, Response | undefined>>({});
  const [results, setResults] = useState<Record<string, GradeResult> | null>(null);

  const verbStats = useMemo(() => {
    if (!data?.reading || !verbsChecked) return null;
    let total = 0;
    let hit = 0;
    let wrong = 0;
    data.reading.paragraphs.forEach((p, pi) =>
      p.sentences.forEach((s, si) => {
        const verbs = verbTokenMap(s);
        total += verbs.size;
        for (const i of verbs.keys()) if (selected.has(`${pi}-${si}-${i}`)) hit++;
        for (const k of selected) {
          const [a, b, c] = k.split('-').map(Number);
          if (a === pi && b === si && !verbs.has(c)) wrong++;
        }
      }),
    );
    return { total, hit, wrong };
  }, [data, verbsChecked, selected]);

  if (loading) return <Loading />;
  if (error || !data?.reading) return <ErrorBox error={error ?? 'Lectura no encontrada'} />;
  const reading = data.reading;
  const lines = reading.paragraphs.map((p) => ({ text: p.sentences.map((s) => s.en).join(' '), speaker: p.speaker }));
  const allAnswered = reading.questions.every((q) => isResponseComplete(q, answers[q.id]));

  const check = () => {
    const res: Record<string, GradeResult> = {};
    let total = 0;
    for (const q of reading.questions) {
      const r = gradeExercise(q, answers[q.id]);
      res[q.id] = r;
      total += r.score;
      recordAnswer(q, r, 'reading');
    }
    setResults(res);
    completeActivity('readings', reading.id, total / reading.questions.length, `Lectura: ${reading.title}`);
  };

  return (
    <div>
      <Link to="/reading" className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft size={15} /> Reading
      </Link>
      <PageHeader
        eyebrow={
          <span className="flex items-center gap-2">
            <LevelBadge level={reading.level} /> {GENRE_LABELS[reading.genre]} · {topicLabel(reading.grammarFocus[0] ?? 'reading-detail')}
          </span>
        }
        title={<span className="font-serif">{reading.title}</span>}
        subtitle={reading.intro}
        actions={progress?.completed ? <Badge tone="success">Completada · mejor {Math.round(progress.bestScore * 100)} %</Badge> : undefined}
      />

      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Pill active={mode === 'read'} onClick={() => { setMode('read'); setVerbsChecked(false); }}>
              <MousePointerClick size={14} /> Leer y consultar
            </Pill>
            <Pill active={mode === 'verbs'} onClick={() => { setMode('verbs'); setHighlight(false); setSelected(new Set()); setVerbsChecked(false); }}>
              Encuentra los verbos
            </Pill>
            <Pill active={highlight} onClick={() => mode === 'read' && setHighlight((h) => !h)}>
              <Highlighter size={14} /> Tiempos verbales
            </Pill>
            <Pill active={showTr} onClick={() => setShowTr((v) => !v)}>
              <Languages size={14} /> Traducción
            </Pill>
          </div>
          <Card>
            {mode === 'verbs' && (
              <Callout tone="info" className="mb-4" title="Encuentra los verbos">
                Toca todas las palabras que forman verbos (incluidos auxiliares como <em>do, does, is, can</em>). Luego comprueba.
              </Callout>
            )}
            <ReaderText
              reading={reading}
              vocab={data.vocab}
              mode={mode}
              showTranslation={showTr}
              highlight={highlight}
              selected={selected}
              checked={verbsChecked}
              onToggleSelect={(k) => setSelected((s) => {
                const n = new Set(s);
                if (n.has(k)) n.delete(k);
                else n.add(k);
                return n;
              })}
              onLookup={setLookup}
            />
            {mode === 'verbs' && (
              <div className="mt-5 flex flex-wrap items-center gap-3">
                {!verbsChecked ? (
                  <Button onClick={() => setVerbsChecked(true)} disabled={selected.size === 0}>
                    Comprobar verbos
                  </Button>
                ) : (
                  verbStats && (
                    <>
                      <span className="text-sm text-ink-soft">
                        Encontraste <strong className="text-success">{verbStats.hit}</strong> de {verbStats.total} formas verbales
                        {verbStats.wrong > 0 && <> · <strong className="text-danger">{verbStats.wrong}</strong> palabras no eran verbos</>}.
                      </span>
                      <Button variant="secondary" size="sm" onClick={() => { setMode('read'); setHighlight(true); setVerbsChecked(false); }}>
                        Ver los tiempos verbales
                      </Button>
                    </>
                  )
                )}
              </div>
            )}
          </Card>
          {lookupResult && (
            <div className="animate-pop flex items-start gap-3 rounded-3xl border border-line bg-surface p-4">
              <SpeakButton text={lookupResult.term} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-ink">
                  {lookupResult.term}
                  {lookupResult.word && <span className="ml-2 font-mono text-xs text-subtle">{lookupResult.word.ipa}</span>}
                </div>
                <div className="text-[15px] text-ink-soft">{lookupResult.es ?? 'Esta palabra no está en el glosario. Prueba con la traducción de la oración.'}</div>
                {lookupResult.note && <div className="mt-1 text-xs text-info">{lookupResult.note}</div>}
                {lookupResult.word && (
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={() => toggleDifficult(lookupResult.word!.id)} className={cn('inline-flex items-center gap-1 text-xs font-semibold', difficult.includes(lookupResult.word.id) ? 'text-warning' : 'text-muted hover:text-warning')}>
                      <Star size={13} fill={difficult.includes(lookupResult.word.id) ? 'currentColor' : 'none'} /> {difficult.includes(lookupResult.word.id) ? 'En difíciles' : 'Guardar para repasar'}
                    </button>
                    <Link to="/vocabulary" className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-brand">
                      <ListPlus size={13} /> Vocabulario
                    </Link>
                  </div>
                )}
              </div>
              <button type="button" onClick={() => setLookup(null)} aria-label="Cerrar" className="rounded-full p-1 text-muted hover:bg-surface-2">
                <X size={15} />
              </button>
            </div>
          )}
          <AudioPlayer id={`reading-${reading.id}`} lines={lines} />
          {reading.glossary.length > 0 && (
            <Card>
              <div className="label-mono mb-3">Vocabulario del texto</div>
              <div className="flex flex-wrap gap-2">
                {reading.glossary.map((g) => (
                  <span key={g.term} className="rounded-xl bg-surface-2 px-3 py-1.5 text-sm">
                    <span className="font-semibold text-ink">{g.term}</span> <span className="text-muted">· {g.es}</span>
                  </span>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div>
          <Card className="lg:sticky lg:top-6">
            <h2 className="text-lg font-semibold text-ink">Did you understand the text?</h2>
            <p className="mb-4 text-sm text-muted">Responde las preguntas de comprensión.</p>
            <div className="space-y-6">
              {reading.questions.map((q: Exercise, i) => (
                <div key={q.id} className="border-b border-dashed border-line pb-5 last:border-0">
                  <span className="mb-2 inline-block rounded-md bg-coral px-2 py-0.5 text-xs font-semibold text-white">Question {i + 1}</span>
                  <p className="mb-2 text-sm font-semibold text-ink-soft">{defaultPrompt(q)}</p>
                  <ExerciseView exercise={q} response={answers[q.id]} onChange={(r) => setAnswers((a) => ({ ...a, [q.id]: r }))} locked={Boolean(results)} result={results?.[q.id]} />
                  {results?.[q.id] && !isCorrectVerdict(results[q.id].verdict) && (
                    <div className="mt-3">
                      <FeedbackPanel exercise={q} result={results[q.id]} compact />
                    </div>
                  )}
                </div>
              ))}
            </div>
            {results ? (
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Badge tone="success" className="px-3 py-1 text-sm">
                  {reading.questions.filter((q) => isCorrectVerdict(results[q.id].verdict)).length}/{reading.questions.length} correctas
                </Badge>
                <Button variant="secondary" onClick={() => { setResults(null); setAnswers({}); }}>
                  Intentar de nuevo
                </Button>
              </div>
            ) : (
              <Button className="mt-5" block onClick={check} disabled={!allAnswered}>
                Comprobar respuestas
              </Button>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
