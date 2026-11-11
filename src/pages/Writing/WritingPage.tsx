import { useState } from 'react';
import { Link } from 'react-router';
import { ChevronRight, PenLine } from 'lucide-react';
import type { Level } from '../../types/content';
import { LEVELS } from '../../types/content';
import { useAppStore } from '../../store/useAppStore';
import { useAsync } from '../../hooks/useAsync';
import { PageHeader } from '../../components/layout/AppShell';
import { Badge, Card, CardTitle, EmptyState, LevelBadge, Loading, Pill } from '../../components/ui/primitives';
import { hasLevelFile, loadWritingTasks } from '../../services/content/loader';
import { currentLevel } from '../../services/progress/stats';
import { formatDate } from '../../utils/dates';
import { renderInline } from '../../components/ui/Markdown';

export default function WritingPage() {
  const data = useAppStore((s) => s.data);
  const [level, setLevel] = useState<Level>(currentLevel(data));
  const { data: tasks, loading } = useAsync(() => loadWritingTasks(level), [level]);
  const subs = data.writings.slice().reverse();
  return (
    <div>
      <PageHeader eyebrow="Writing" title="Laboratorio de escritura" subtitle="Escribe, recibe correcciones explicadas en español, compara tu original con la versión corregida y reescribe tu texto." />
      <div className="mb-5 flex flex-wrap gap-2">
        {LEVELS.map((l) => (
          <Pill key={l} active={level === l} onClick={() => setLevel(l)} className={!hasLevelFile('writing', l) ? 'opacity-40' : ''}>
            {l}
          </Pill>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div>
          {loading ? (
            <Loading />
          ) : !tasks?.length ? (
            <EmptyState icon={<PenLine size={20} />} title={`Las tareas de escritura de ${level} están en preparación`} />
          ) : (
            <div className="grid gap-3">
              {tasks.map((t) => {
                const mine = data.writings.filter((w) => w.taskId === t.id);
                const best = mine.length ? Math.max(...mine.map((w) => w.score)) : undefined;
                return (
                  <Link key={t.id} to={`/writing/${t.id}`} className="card flex items-center gap-4 px-5 py-4 transition-colors hover:border-ink-soft/30">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                      <PenLine size={19} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <LevelBadge level={t.level ?? level} />
                        <h3 className="truncate font-semibold text-ink">{t.title}</h3>
                      </div>
                      <p className="mt-1 line-clamp-1 text-sm text-muted">{renderInline(t.task)}</p>
                    </div>
                    <span className="hidden font-mono text-xs text-subtle sm:inline">
                      {t.minWords}–{t.maxWords} palabras
                    </span>
                    {best !== undefined && <Badge tone={best >= 0.85 ? 'success' : 'warning'}>{Math.round(best * 100)}</Badge>}
                    <ChevronRight size={17} className="text-muted" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>
        <Card>
          <CardTitle>Mis textos</CardTitle>
          {subs.length === 0 ? (
            <p className="text-sm text-muted">Aquí aparecerán tus textos con su corrección. Se conserva siempre tu versión original.</p>
          ) : (
            <ul className="space-y-2">
              {subs.slice(0, 20).map((w) => (
                <li key={w.id}>
                  <Link to={`/writing/${w.taskId}?sub=${w.id}`} className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-surface-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{w.title}</span>
                      <span className="block text-xs text-muted">
                        {formatDate(w.createdAt)} · {w.wordCount} palabras {w.revision ? '· reescrito' : ''}
                      </span>
                    </span>
                    <span className="font-mono text-sm font-semibold text-ink">{Math.round(w.score * 100)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
