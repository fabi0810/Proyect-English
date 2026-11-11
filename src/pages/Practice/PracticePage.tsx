import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Dumbbell, Play, Sparkles } from 'lucide-react';
import type { Exercise, ExerciseType, Level, Module } from '../../types/content';
import { LEVELS } from '../../types/content';
import { useAppStore } from '../../store/useAppStore';
import { useAsync } from '../../hooks/useAsync';
import { PageHeader } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { Card, EmptyState, Loading, Pill } from '../../components/ui/primitives';
import { ExercisePlayer } from '../../components/exercises/ExercisePlayer';
import { loadLevelModules, topicLabel } from '../../services/content/loader';
import { TYPE_LABELS } from '../../services/exercises/prompts';
import { currentLevel } from '../../services/progress/stats';
import { createRng, randomSeed, shuffle } from '../../utils/random';

const PRACTICE_TYPES: ExerciseType[] = ['multiple_choice', 'fill_blank', 'word_order', 'sentence_building', 'error_identification', 'error_correction', 'translation', 'matching', 'true_false', 'tense_identification', 'open_answer', 'dictation'];

/** Pool de práctica: guiada + independiente (no se usan los pools de evaluación). */
function practicePool(mods: Module[]): Exercise[] {
  return mods.flatMap((m) => m.lessons.flatMap((l) => [...l.guided, ...l.independent]));
}

/** Modo adaptativo: prioriza temas con errores sin resolver y ítems con baja precisión. */
function adaptiveOrder(pool: Exercise[], stats: Record<string, { seen: number; correct: number }>, weakTopics: Set<string>, rng: () => number): Exercise[] {
  const scored = pool.map((e) => {
    const s = stats[e.id];
    const acc = s && s.seen ? s.correct / s.seen : 0.5;
    const weight = (weakTopics.has(e.topic) ? 2 : 0) + (1 - acc) + (s ? 0 : 0.3) + rng() * 0.5;
    return { e, weight };
  });
  return scored.sort((a, b) => b.weight - a.weight).map((x) => x.e);
}

export default function PracticePage() {
  const [params] = useSearchParams();
  const data = useAppStore((s) => s.data);
  const logEvent = useAppStore((s) => s.logEvent);
  const presetTopics = params.get('topics')?.split(',').filter(Boolean) ?? [];
  const presetModule = params.get('module') ?? params.get('from') ?? '';
  const [level, setLevel] = useState<Level>((presetModule ? (presetModule.slice(0, 2).toUpperCase() as Level) : currentLevel(data)));
  const [moduleIds, setModuleIds] = useState<string[]>(presetModule ? [presetModule] : []);
  const [types, setTypes] = useState<ExerciseType[]>([]);
  const [topicsSel] = useState<string[]>(presetTopics);
  const [adaptive, setAdaptive] = useState(true);
  const [size, setSize] = useState(12);
  const [session, setSession] = useState<Exercise[] | null>(null);
  const { data: mods, loading } = useAsync(() => loadLevelModules(level), [level]);

  const weak = useMemo(() => new Set(Object.values(data.mistakes).filter((m) => !m.resolved).map((m) => m.topic)), [data.mistakes]);
  const pool = useMemo(() => {
    const chosen = (mods ?? []).filter((m) => !moduleIds.length || moduleIds.includes(m.id));
    return practicePool(chosen).filter((e) => (!types.length || types.includes(e.type)) && (!topicsSel.length || topicsSel.includes(e.topic)));
  }, [mods, moduleIds, types, topicsSel]);

  const start = () => {
    const rng = createRng(randomSeed());
    const ordered = adaptive ? adaptiveOrder(pool, data.itemStats, weak, rng) : shuffle(pool, rng);
    setSession(ordered.slice(0, size));
  };

  if (session)
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader eyebrow="Practice" title="Sesión de práctica" />
        <ExercisePlayer
          exercises={session}
          context="practice"
          finishLabel="Terminar"
          onFinish={(s) => {
            logEvent({ type: 'practice', title: 'Sesión de práctica', detail: `${s.correct}/${s.total} correctas`, link: presetModule ? `/module/${presetModule}` : '/practice' });
            setSession(null);
          }}
        />
      </div>
    );

  return (
    <div>
      <PageHeader eyebrow="Practice" title="Práctica personalizada" subtitle="Elige nivel, módulos y tipos de ejercicio. El modo adaptativo prioriza tus temas débiles y las preguntas que más fallas." />
      {presetTopics.length > 0 && (
        <div className="mb-4 rounded-2xl bg-brand-soft px-4 py-3 text-sm text-ink">
          Repaso dirigido de: <strong>{presetTopics.map(topicLabel).join(', ')}</strong>
        </div>
      )}
      <Card className="space-y-6">
        <div>
          <div className="mb-2 text-sm font-semibold text-ink">Nivel</div>
          <div className="flex flex-wrap gap-2">
            {LEVELS.map((l) => (
              <Pill key={l} active={level === l} onClick={() => { setLevel(l); setModuleIds([]); }}>
                {l}
              </Pill>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 text-sm font-semibold text-ink">Módulos {moduleIds.length ? `(${moduleIds.length})` : '(todos)'}</div>
          {loading ? (
            <Loading className="py-3" />
          ) : !mods?.length ? (
            <p className="text-sm text-muted">No hay módulos con contenido en {level} todavía.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {mods.map((m) => (
                <Pill key={m.id} active={moduleIds.includes(m.id)} onClick={() => setModuleIds((ids) => (ids.includes(m.id) ? ids.filter((x) => x !== m.id) : [...ids, m.id]))}>
                  {m.title}
                </Pill>
              ))}
            </div>
          )}
        </div>
        <div>
          <div className="mb-2 text-sm font-semibold text-ink">Tipos de ejercicio {types.length ? '' : '(todos)'}</div>
          <div className="flex flex-wrap gap-2">
            {PRACTICE_TYPES.map((t) => (
              <Pill key={t} active={types.includes(t)} onClick={() => setTypes((ts) => (ts.includes(t) ? ts.filter((x) => x !== t) : [...ts, t]))}>
                {TYPE_LABELS[t]}
              </Pill>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <div className="mb-2 text-sm font-semibold text-ink">Preguntas</div>
            <div className="flex gap-2">
              {[8, 12, 20].map((n) => (
                <Pill key={n} active={size === n} onClick={() => setSize(n)}>
                  {n}
                </Pill>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-sm font-semibold text-ink">Orden</div>
            <div className="flex gap-2">
              <Pill active={adaptive} onClick={() => setAdaptive(true)}>
                <Sparkles size={14} /> Adaptativo
              </Pill>
              <Pill active={!adaptive} onClick={() => setAdaptive(false)}>
                Aleatorio
              </Pill>
            </div>
          </div>
        </div>
        {pool.length === 0 && !loading ? (
          <EmptyState icon={<Dumbbell size={20} />} title="No hay ejercicios con esta selección" className="py-8" />
        ) : (
          <Button size="lg" icon={<Play size={16} />} onClick={start} disabled={!pool.length}>
            Empezar ({Math.min(size, pool.length)} de {pool.length} disponibles)
          </Button>
        )}
        <p className="text-xs text-muted">La práctica usa los ejercicios de práctica guiada e independiente; las preguntas de evaluación se reservan para los exámenes.</p>
      </Card>
    </div>
  );
}
