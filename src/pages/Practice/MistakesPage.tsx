import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { BookOpen, CircleAlert, CircleCheck, Play } from 'lucide-react';
import type { Exercise } from '../../types/content';
import { useAppStore } from '../../store/useAppStore';
import { useAsync } from '../../hooks/useAsync';
import { PageHeader } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { Badge, Card, CardTitle, EmptyState, Loading, Pill, Stat } from '../../components/ui/primitives';
import { ExercisePlayer } from '../../components/exercises/ExercisePlayer';
import { AnswerChip } from '../../components/exercises/FeedbackPanel';
import { errorCatalog } from '../../services/content/catalog';
import { findExercises, topicLabel } from '../../services/content/loader';
import { formatDate } from '../../utils/dates';

export default function MistakesPage() {
  const mistakes = useAppStore((s) => s.data.mistakes);
  const [tag, setTag] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const [session, setSession] = useState<Exercise[] | null>(null);
  const list = useMemo(() => Object.values(mistakes).sort((a, b) => b.count - a.count || b.lastAt.localeCompare(a.lastAt)), [mistakes]);
  const unresolved = list.filter((m) => !m.resolved);
  const ids = useMemo(() => list.map((m) => m.itemId), [list]);
  const { data: exMap, loading } = useAsync(() => findExercises(ids), [ids.join('|')]);

  const byTag = useMemo(() => {
    const c = new Map<string, number>();
    for (const m of unresolved) for (const t of m.errorTags.length ? m.errorTags : ['otros']) c.set(t, (c.get(t) ?? 0) + 1);
    return Array.from(c).sort((a, b) => b[1] - a[1]);
  }, [unresolved]);

  const shown = list.filter((m) => (showResolved ? m.resolved : !m.resolved) && (!tag || m.errorTags.includes(tag) || (tag === 'otros' && !m.errorTags.length)));

  const startReview = () => {
    if (!exMap) return;
    const items = unresolved
      .filter((m) => !tag || m.errorTags.includes(tag))
      .map((m) => exMap.get(m.itemId))
      .filter(Boolean) as Exercise[];
    setSession(items.slice(0, 15));
  };

  if (session)
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader eyebrow="My Mistakes" title="Repaso de errores" subtitle="Un error se resuelve tras dos aciertos seguidos en la misma pregunta." />
        <ExercisePlayer exercises={session} context="mistakes" retryMistakes={false} finishLabel="Volver a mis errores" onFinish={() => setSession(null)} />
      </div>
    );

  return (
    <div>
      <PageHeader
        eyebrow="My Mistakes"
        title="Mis errores"
        subtitle="Cada respuesta incorrecta queda registrada con su explicación. Repásalos hasta resolverlos: los más frecuentes y recientes aparecen primero."
        actions={
          <Button icon={<Play size={16} />} onClick={startReview} disabled={!unresolved.length || loading}>
            Repasar errores
          </Button>
        }
      />
      <div className="mb-6 grid grid-cols-3 gap-3">
        <Stat value={unresolved.length} label="Sin resolver" tone="danger" />
        <Stat value={list.length - unresolved.length} label="Resueltos" tone="success" />
        <Stat value={unresolved.reduce((s, m) => s + m.count, 0)} label="Fallos totales" />
      </div>

      {list.length === 0 ? (
        <EmptyState icon={<CircleCheck size={20} />} title="Aún no hay errores registrados">
          Cuando falles una pregunta en lecciones, prácticas o evaluaciones, aparecerá aquí con su explicación.
        </EmptyState>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <Card className="h-fit">
            <CardTitle>Tipos de error</CardTitle>
            <div className="flex flex-col gap-1.5">
              <button type="button" onClick={() => setTag(null)} className={`flex items-center justify-between rounded-xl px-3 py-2 text-left text-sm ${!tag ? 'bg-ink text-on-ink' : 'hover:bg-surface-2'}`}>
                Todos <span className="font-mono text-xs">{unresolved.length}</span>
              </button>
              {byTag.map(([t, n]) => (
                <button key={t} type="button" onClick={() => setTag(t)} className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm ${tag === t ? 'bg-ink text-on-ink' : 'text-ink-soft hover:bg-surface-2'}`}>
                  <span>{errorCatalog[t]?.title ?? t}</span>
                  <span className="font-mono text-xs">{n}</span>
                </button>
              ))}
            </div>
            {tag && errorCatalog[tag] && (
              <div className="mt-4 rounded-2xl bg-surface-2 p-3 text-sm">
                <p className="text-ink-soft">{errorCatalog[tag].explanation}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <AnswerChip tone="wrong">{errorCatalog[tag].example.wrong}</AnswerChip>
                  <AnswerChip tone="right">{errorCatalog[tag].example.right}</AnswerChip>
                </div>
                {errorCatalog[tag].lesson && (
                  <Link to={`/grammar/${errorCatalog[tag].lesson}`} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-info">
                    <BookOpen size={13} /> Leer la explicación
                  </Link>
                )}
              </div>
            )}
          </Card>
          <div>
            <div className="mb-3 flex gap-2">
              <Pill active={!showResolved} onClick={() => setShowResolved(false)}>Sin resolver</Pill>
              <Pill active={showResolved} onClick={() => setShowResolved(true)}>Resueltos</Pill>
            </div>
            {loading ? (
              <Loading />
            ) : (
              <div className="space-y-2.5">
                {shown.length === 0 && <EmptyState icon={<CircleAlert size={20} />} title="Nada por aquí" className="py-8" />}
                {shown.slice(0, 100).map((m) => {
                  const ex = exMap?.get(m.itemId);
                  return (
                    <div key={m.itemId} className="card px-5 py-4">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge tone="info">{topicLabel(m.topic)}</Badge>
                        {m.errorTags.slice(0, 2).map((t) => (
                          <Badge key={t} tone="danger">{errorCatalog[t]?.title ?? t}</Badge>
                        ))}
                        <span className="ml-auto font-mono text-xs text-muted">×{m.count} · {formatDate(m.lastAt)}</span>
                      </div>
                      {ex && 'question' in ex && <p className="mb-2 text-[15px] text-ink">{ex.question}</p>}
                      {ex && ex.type === 'translation' && <p className="mb-2 text-[15px] text-ink">{ex.source}</p>}
                      <div className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
                        <AnswerChip tone="wrong">{m.lastResponse || '—'}</AnswerChip>
                        <span>→</span>
                        <AnswerChip tone="right">{m.expected}</AnswerChip>
                      </div>
                      {ex && <p className="mt-2 text-sm text-muted">{ex.explanation}</p>}
                      {m.resolved && <p className="mt-2 text-xs font-semibold text-success">Resuelto el {formatDate(m.resolvedAt)}</p>}
                      {!m.resolved && m.correctStreak > 0 && <p className="mt-2 text-xs text-warning">1 acierto más para resolverlo</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
