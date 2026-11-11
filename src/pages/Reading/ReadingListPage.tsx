import { useState } from 'react';
import { Link } from 'react-router';
import { BookOpen, CircleCheck } from 'lucide-react';
import type { Level } from '../../types/content';
import { LEVELS } from '../../types/content';
import { useAppStore } from '../../store/useAppStore';
import { useAsync } from '../../hooks/useAsync';
import { PageHeader } from '../../components/layout/AppShell';
import { Badge, EmptyState, LevelBadge, Loading, Pill } from '../../components/ui/primitives';
import { hasLevelFile, loadReadings } from '../../services/content/loader';
import { GENRE_LABELS } from '../../services/content/taxonomy';
import { currentLevel } from '../../services/progress/stats';
import { countWords } from '../../utils/text';

export default function ReadingListPage() {
  const data = useAppStore((s) => s.data);
  const [level, setLevel] = useState<Level>(currentLevel(data));
  const { data: readings, loading } = useAsync(() => loadReadings(level), [level]);
  return (
    <div>
      <PageHeader eyebrow="Reading" title="Comprensión lectora" subtitle="Textos graduados con audio, glosario al tocar cada palabra, traducción por oración, identificación de verbos y tiempos, y preguntas de comprensión." />
      <div className="mb-5 flex flex-wrap gap-2">
        {LEVELS.map((l) => (
          <Pill key={l} active={level === l} onClick={() => setLevel(l)} className={!hasLevelFile('readings', l) ? 'opacity-40' : ''}>
            {l}
          </Pill>
        ))}
      </div>
      {loading ? (
        <Loading />
      ) : !readings?.length ? (
        <EmptyState icon={<BookOpen size={20} />} title={`Las lecturas de ${level} están en preparación`} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {readings.map((r) => {
            const p = data.readings[r.id];
            const words = countWords(r.paragraphs.flatMap((pp) => pp.sentences.map((s) => s.en)).join(' '));
            return (
              <Link key={r.id} to={`/reading/${r.id}`} className="card card-pad flex flex-col transition-transform hover:-translate-y-0.5">
                <div className="mb-3 flex items-center gap-2">
                  <LevelBadge level={r.level} />
                  <Badge tone="coral">{GENRE_LABELS[r.genre]}</Badge>
                  {p?.completed && <CircleCheck size={18} className="ml-auto text-success" />}
                </div>
                <h3 className="font-serif text-xl font-bold text-ink">{r.title}</h3>
                <p className="mt-1 line-clamp-2 flex-1 text-sm text-muted">{r.intro ?? r.paragraphs[0]?.sentences[0]?.en}</p>
                <div className="mt-4 flex items-center justify-between text-xs text-muted">
                  <span>{words} palabras · {r.questions.length} preguntas</span>
                  {p && <span className="font-mono">mejor {Math.round(p.bestScore * 100)} %</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
