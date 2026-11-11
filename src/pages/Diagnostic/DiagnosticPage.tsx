import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, CircleCheck, CircleX, Compass, CircleQuestionMark } from 'lucide-react';
import type { Level, PlacementQuestion } from '../../types/content';
import { LEVELS } from '../../types/content';
import type { DiagnosticSummary, EvaluationAttempt } from '../../types/progress';
import { useAppStore } from '../../store/useAppStore';
import { useAsync } from '../../hooks/useAsync';
import { PageHeader } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { Badge, Callout, Card, ErrorBox, LevelBadge, Loading, ProgressBar } from '../../components/ui/primitives';
import { renderInline } from '../../components/ui/Markdown';
import { getManifest, loadPlacement, topicLabel } from '../../services/content/loader';
import { createRng, randomSeed, shuffle } from '../../utils/random';
import { nowIso } from '../../utils/dates';
import { uid } from '../../utils/ids';
import { cn } from '../../utils/cn';

const BLOCK_PASS = 0.7;
const PER_BLOCK = 10;

interface Answer {
  q: PlacementQuestion;
  choice: number | null; // null = "No lo sé"
  order: number[];
}

export default function DiagnosticPage() {
  const navigate = useNavigate();
  const data = useAppStore((s) => s.data);
  const saveDiagnostic = useAppStore((s) => s.saveDiagnostic);
  const updateProfile = useAppStore((s) => s.updateProfile);
  const { data: bank, loading, error } = useAsync(() => loadPlacement(), []);
  const [phase, setPhase] = useState<'intro' | 'running' | 'between' | 'done'>('intro');
  const [seed] = useState(randomSeed());
  const [levelIdx, setLevelIdx] = useState(0);
  const [qIdx, setQIdx] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [startedAt] = useState(nowIso());
  const [summary, setSummary] = useState<DiagnosticSummary | null>(null);

  const blocks = useMemo(() => {
    const rng = createRng(seed);
    const out: Record<string, PlacementQuestion[]> = {};
    for (const l of LEVELS) out[l] = shuffle((bank ?? []).filter((q) => q.level === l), rng).slice(0, PER_BLOCK);
    return out;
  }, [bank, seed]);

  const level = LEVELS[levelIdx];
  const block = blocks[level] ?? [];
  const question = block[qIdx];
  const order = useMemo(() => (question ? shuffle(question.options.map((_, i) => i), createRng(seed + qIdx + levelIdx * 100)) : []), [question, seed, qIdx, levelIdx]);

  const blockScore = (l: Level) => {
    const a = answers.filter((x) => x.q.level === l);
    return { correct: a.filter((x) => x.choice === x.q.answer).length, total: a.length };
  };

  const finish = (all: Answer[]) => {
    const byLevel: DiagnosticSummary['byLevel'] = {};
    for (const l of LEVELS) {
      const a = all.filter((x) => x.q.level === l);
      if (a.length) byLevel[l] = { correct: a.filter((x) => x.choice === x.q.answer).length, total: a.length };
    }
    let estimated: Level | 'pre-A1' = 'pre-A1';
    for (const l of LEVELS) {
      const s = byLevel[l];
      if (s && s.correct / s.total >= BLOCK_PASS) estimated = l;
      else break;
    }
    const topicStats = new Map<string, { c: number; t: number }>();
    for (const x of all) {
      const s = topicStats.get(x.q.topic) ?? { c: 0, t: 0 };
      s.t++;
      if (x.choice === x.q.answer) s.c++;
      topicStats.set(x.q.topic, s);
    }
    const strongTopics = Array.from(topicStats).filter(([, s]) => s.c === s.t).map(([t]) => t);
    const weakTopics = Array.from(topicStats).filter(([, s]) => s.c < s.t).map(([t]) => t);
    const idx = estimated === 'pre-A1' ? 0 : Math.min(LEVELS.length - 1, LEVELS.indexOf(estimated) + 1);
    const recommendedStart = estimated === 'B2' ? 'B2' : LEVELS[idx];
    const attemptId = uid('att');
    const correct = all.filter((x) => x.choice === x.q.answer).length;
    const sum: DiagnosticSummary = { attemptId, takenAt: nowIso(), estimatedLevel: estimated, byLevel, strongTopics, weakTopics, recommendedStart };
    const attempt: EvaluationAttempt = {
      id: attemptId,
      kind: 'diagnostic',
      targetId: 'placement',
      level: estimated === 'pre-A1' ? 'A1' : estimated,
      title: 'Diagnóstico inicial',
      number: data.attempts.filter((a) => a.kind === 'diagnostic').length + 1,
      startedAt,
      finishedAt: nowIso(),
      status: 'completed',
      seed,
      items: all.map((x) => ({ id: x.q.id, score: x.choice === x.q.answer ? 1 : 0, points: 1, topic: x.q.topic, verdict: x.choice === x.q.answer ? 'correct' : 'incorrect', response: x.choice === null ? undefined : { kind: 'choice', index: x.choice } })),
      score: correct,
      maxScore: all.length,
      percent: all.length ? correct / all.length : 0,
      topics: Object.fromEntries(Array.from(topicStats).map(([t, s]) => [t, { correct: s.c, total: s.t }])),
      passGrade: data.settings.passGrade,
      exigency: data.settings.exigency,
      durationSec: Math.round((Date.now() - new Date(startedAt).getTime()) / 1000),
      estimatedLevel: estimated,
    };
    saveDiagnostic(attempt, sum);
    setSummary(sum);
    setPhase('done');
  };

  const answer = (choice: number | null) => {
    const next = [...answers, { q: question, choice, order }];
    setAnswers(next);
    if (qIdx + 1 < block.length) {
      setQIdx(qIdx + 1);
      return;
    }
    const a = next.filter((x) => x.q.level === level);
    const ok = a.filter((x) => x.choice === x.q.answer).length / Math.max(1, a.length) >= BLOCK_PASS;
    if (ok && levelIdx + 1 < LEVELS.length && (blocks[LEVELS[levelIdx + 1]]?.length ?? 0) > 0) setPhase('between');
    else finish(next);
  };

  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} />;

  if (phase === 'intro')
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader eyebrow="Diagnóstico" title="¿Cuál es tu nivel de inglés?" subtitle="Una prueba adaptativa por bloques (A1 → B2) de gramática, vocabulario y comprensión. Dura entre 5 y 20 minutos." />
        <Card className="space-y-4">
          <ul className="space-y-2.5 text-[15px] text-ink-soft">
            <li className="flex gap-3"><Compass size={19} className="mt-0.5 shrink-0 text-brand" /> Empiezas con {PER_BLOCK} preguntas de A1. Si aciertas al menos el {Math.round(BLOCK_PASS * 100)} %, pasas al bloque siguiente.</li>
            <li className="flex gap-3"><CircleQuestionMark size={19} className="mt-0.5 shrink-0 text-brand" /> Si no sabes una respuesta, pulsa «No lo sé»: es mejor que adivinar y ayuda a detectar tus lagunas.</li>
            <li className="flex gap-3"><CircleCheck size={19} className="mt-0.5 shrink-0 text-brand" /> Al final verás tu nivel estimado, tus temas dominados y pendientes y una recomendación.</li>
          </ul>
          <Callout tone="info">El diagnóstico orienta, pero <strong>no aprueba módulos ni niveles</strong>: las evaluaciones oficiales siguen siendo obligatorias. Siempre puedes empezar desde A1.</Callout>
          <Button size="lg" iconRight={<ArrowRight size={16} />} onClick={() => setPhase('running')} disabled={!blocks.A1?.length}>
            Comenzar diagnóstico
          </Button>
          {data.profile.diagnostic && <p className="text-sm text-muted">Último resultado: nivel estimado {data.profile.diagnostic.estimatedLevel}.</p>}
        </Card>
      </div>
    );

  if (phase === 'between') {
    const s = blockScore(level);
    return (
      <div className="mx-auto max-w-xl py-6 text-center">
        <LevelBadge level={level} size="lg" />
        <h2 className="mt-4 text-2xl font-bold text-ink">Bloque {level} superado</h2>
        <p className="mt-2 text-muted">
          {s.correct} de {s.total} correctas. Sigamos con {LEVELS[levelIdx + 1]}.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="secondary" onClick={() => finish(answers)}>
            Terminar aquí
          </Button>
          <Button
            iconRight={<ArrowRight size={16} />}
            onClick={() => {
              setLevelIdx(levelIdx + 1);
              setQIdx(0);
              setPhase('running');
            }}
          >
            Continuar con {LEVELS[levelIdx + 1]}
          </Button>
        </div>
      </div>
    );
  }

  if (phase === 'done' && summary) {
    const recLevel = summary.recommendedStart;
    const recReady = getManifest(recLevel).modules.some((m) => m.status === 'ready');
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader eyebrow="Resultado del diagnóstico" title={summary.estimatedLevel === 'pre-A1' ? 'Nivel estimado: inicial (pre-A1)' : `Nivel estimado: ${summary.estimatedLevel}`} />
        <div className="grid gap-5 md:grid-cols-2">
          <Card>
            <h3 className="mb-4 font-semibold text-ink">Resultados por bloque</h3>
            <div className="space-y-3">
              {LEVELS.filter((l) => summary.byLevel[l]).map((l) => {
                const s = summary.byLevel[l];
                const r = s.correct / s.total;
                return (
                  <div key={l}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2"><LevelBadge level={l} /> {r >= BLOCK_PASS ? <Badge tone="success">Superado</Badge> : <Badge tone="danger">No superado</Badge>}</span>
                      <span className="font-mono text-xs text-muted">{s.correct}/{s.total}</span>
                    </div>
                    <ProgressBar value={r} size="sm" barClassName={r >= BLOCK_PASS ? 'bg-success' : 'bg-danger'} />
                  </div>
                );
              })}
            </div>
          </Card>
          <Card>
            <h3 className="mb-2 font-semibold text-ink">Recomendación</h3>
            <p className="text-[15px] text-ink-soft">
              {summary.estimatedLevel === 'pre-A1'
                ? 'Empieza desde A1: construirás una base sólida desde los fundamentos.'
                : summary.estimatedLevel === 'B2'
                  ? 'Tienes un nivel B2. Puedes trabajar los módulos de B2 para consolidarlo.'
                  : `Dominas buena parte de ${summary.estimatedLevel}. Te recomendamos empezar en ${recLevel}.`}
            </p>
            {!recReady && recLevel !== 'A1' && (
              <Callout tone="warning" className="mt-3">El contenido de {recLevel} está en preparación. Mientras tanto puedes repasar el nivel anterior y presentar su examen final.</Callout>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              {recLevel !== 'A1' && (
                <Button
                  onClick={() => {
                    updateProfile({ startLevel: recLevel, onboarded: true });
                    navigate(`/courses/${recLevel}`);
                  }}
                >
                  Empezar en {recLevel}
                </Button>
              )}
              <Button
                variant={recLevel === 'A1' ? 'primary' : 'secondary'}
                onClick={() => {
                  updateProfile({ startLevel: 'A1', onboarded: true });
                  navigate('/courses/A1');
                }}
              >
                Empezar desde A1
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted">Empezar en un nivel superior te da acceso a sus módulos, pero los niveles anteriores no cuentan como aprobados.</p>
          </Card>
          <Card>
            <h3 className="mb-3 flex items-center gap-2 font-semibold text-ink"><CircleCheck size={18} className="text-success" /> Temas dominados</h3>
            {summary.strongTopics.length ? <ul className="space-y-1 text-sm text-ink-soft">{summary.strongTopics.map((t) => <li key={t}>{topicLabel(t)}</li>)}</ul> : <p className="text-sm text-muted">—</p>}
          </Card>
          <Card>
            <h3 className="mb-3 flex items-center gap-2 font-semibold text-ink"><CircleX size={18} className="text-danger" /> Temas pendientes</h3>
            {summary.weakTopics.length ? <ul className="space-y-1 text-sm text-ink-soft">{summary.weakTopics.map((t) => <li key={t}>{topicLabel(t)}</li>)}</ul> : <p className="text-sm text-muted">—</p>}
          </Card>
        </div>
        <Card className="mt-5">
          <h3 className="mb-3 font-semibold text-ink">Revisión de respuestas</h3>
          <ol className="space-y-3">
            {answers.map((x, i) => {
              const ok = x.choice === x.q.answer;
              return (
                <li key={x.q.id} className="rounded-2xl bg-surface-2 px-4 py-3 text-sm">
                  <div className="flex items-start gap-2">
                    {ok ? <CircleCheck size={16} className="mt-0.5 shrink-0 text-success" /> : <CircleX size={16} className="mt-0.5 shrink-0 text-danger" />}
                    <span className="font-medium text-ink">
                      {i + 1}. {renderInline(x.q.question)}
                    </span>
                    <LevelBadge level={x.q.level} className="ml-auto" />
                  </div>
                  <p className="mt-1 pl-6 text-muted">
                    Tu respuesta: {x.choice === null ? 'No lo sé' : x.q.options[x.choice]} · Correcta: <span className="text-success">{x.q.options[x.q.answer]}</span>
                  </p>
                  <p className="mt-1 pl-6 text-ink-soft">{x.q.explanation}</p>
                </li>
              );
            })}
          </ol>
        </Card>
      </div>
    );
  }

  if (!question) return <Loading />;
  const answeredInBlock = qIdx;
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex items-center gap-3">
        <LevelBadge level={level} />
        <span className="text-sm font-semibold text-ink">
          Bloque {level} · pregunta {qIdx + 1} de {block.length}
        </span>
        <ProgressBar value={answeredInBlock / block.length} size="sm" className="ml-auto max-w-40" barClassName="bg-brand" />
      </div>
      <Card>
        {question.context && <p className="mb-3 rounded-2xl bg-surface-2 px-4 py-3 text-[15px] leading-relaxed text-ink-soft">{renderInline(question.context)}</p>}
        <p className="mb-5 text-[20px] font-medium text-ink">{renderInline(question.question)}</p>
        <div className="grid gap-2.5">
          {order.map((orig, i) => (
            <button
              key={orig}
              type="button"
              onClick={() => answer(orig)}
              className={cn('flex items-center gap-3 rounded-2xl border-2 border-line bg-surface px-4 py-3 text-left text-[15px] text-ink transition-colors hover:border-brand')}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-2 font-mono text-xs font-bold text-muted">{'abcd'[i]}</span>
              {question.options[orig]}
            </button>
          ))}
          <button type="button" onClick={() => answer(null)} className="mt-1 rounded-2xl border-2 border-dashed border-line px-4 py-3 text-sm font-semibold text-muted hover:text-ink">
            No lo sé
          </button>
        </div>
      </Card>
    </div>
  );
}
