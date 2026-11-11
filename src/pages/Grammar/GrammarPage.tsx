import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { BookA, ChevronRight, Search } from 'lucide-react';
import type { Level, Module } from '../../types/content';
import { LEVELS } from '../../types/content';
import { useAsync } from '../../hooks/useAsync';
import { PageHeader } from '../../components/layout/AppShell';
import { Badge, Card, EmptyState, LevelBadge, Loading } from '../../components/ui/primitives';
import { getManifest, loadLevelModules, topics } from '../../services/content/loader';
import { basicNormalize, stripAccents } from '../../services/exercises/normalize';

function norm(s: string) {
  return stripAccents(basicNormalize(s));
}

export default function GrammarPage() {
  const [q, setQ] = useState('');
  const { data, loading } = useAsync(async () => {
    const out: Record<string, Module[]> = {};
    for (const l of LEVELS) out[l] = await loadLevelModules(l);
    return out;
  }, []);

  const query = norm(q);
  const filtered = useMemo(() => {
    if (!data) return {} as Record<Level, Module[]>;
    const out = {} as Record<Level, Module[]>;
    for (const level of LEVELS) {
      out[level] = data[level]
        .map((m) => ({
          ...m,
          lessons: m.lessons.filter((l) => {
            if (!query) return true;
            const topicText = Object.entries(topics)
              .filter(([, t]) => t.lesson === l.id)
              .map(([, t]) => t.label)
              .join(' ');
            const hay = norm(`${m.title} ${m.titleEs} ${l.title} ${l.titleEs} ${l.objective} ${topicText} ${l.summary.join(' ')}`);
            return query.split(' ').every((w) => hay.includes(w));
          }),
        }))
        .filter((m) => m.lessons.length > 0);
    }
    return out;
  }, [data, query]);

  return (
    <div>
      <PageHeader eyebrow="Grammar" title="Libro de gramática" subtitle="Consulta la teoría de cualquier lección en cualquier momento: reglas, tablas, ejemplos con audio, excepciones y errores frecuentes." />
      <div className="relative mb-6 max-w-xl">
        <Search size={18} className="absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar: to be, plural, there is, posesivos…" className="input pl-11" aria-label="Buscar en el libro de gramática" />
      </div>
      {loading ? (
        <Loading />
      ) : (
        <div className="space-y-8">
          {LEVELS.map((level) => {
            const mods = filtered[level] ?? [];
            const planned = getManifest(level).modules.filter((m) => m.status === 'planned').length;
            if (!mods.length && (query || planned === 0)) return null;
            return (
              <section key={level}>
                <div className="mb-3 flex items-center gap-3">
                  <LevelBadge level={level} />
                  <h2 className="text-lg font-semibold text-ink">{level}</h2>
                  {planned > 0 && <Badge tone="warning">{planned} módulos en preparación</Badge>}
                </div>
                {mods.length === 0 ? (
                  <EmptyState icon={<BookA size={20} />} title={`La teoría de ${level} está en preparación`} className="py-8" />
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {mods.map((m) => (
                      <Card key={m.id} className="!p-5">
                        <div className="mb-3">
                          <div className="font-semibold text-ink">{m.title}</div>
                          <div className="text-sm text-muted">{m.titleEs}</div>
                        </div>
                        <ul className="space-y-1">
                          {m.lessons.map((l) => (
                            <li key={l.id}>
                              <Link to={`/grammar/${l.id}`} className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm text-ink-soft hover:bg-surface-2 hover:text-ink">
                                <span>
                                  {l.title} <span className="text-muted">· {l.titleEs}</span>
                                </span>
                                <ChevronRight size={15} className="shrink-0 text-muted" />
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </Card>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
          {query && LEVELS.every((l) => !(filtered[l] ?? []).length) && <EmptyState icon={<Search size={20} />} title="Sin resultados" />}
        </div>
      )}
    </div>
  );
}
