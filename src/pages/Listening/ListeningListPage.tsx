import { useState } from 'react';
import { Link } from 'react-router';
import { CircleCheck, Headphones } from 'lucide-react';
import type { Level } from '../../types/content';
import { LEVELS } from '../../types/content';
import { useAppStore } from '../../store/useAppStore';
import { useAsync } from '../../hooks/useAsync';
import { PageHeader } from '../../components/layout/AppShell';
import { Badge, Callout, EmptyState, LevelBadge, Loading, Pill } from '../../components/ui/primitives';
import { hasLevelFile, loadListening } from '../../services/content/loader';
import { currentLevel } from '../../services/progress/stats';
import { isSpeechSupported } from '../../services/speech/tts';

const KIND: Record<string, string> = { dialogue: 'Conversación', monologue: 'Monólogo', announcement: 'Anuncio' };

export default function ListeningListPage() {
  const data = useAppStore((s) => s.data);
  const [level, setLevel] = useState<Level>(currentLevel(data));
  const { data: list, loading } = useAsync(() => loadListening(level), [level]);
  return (
    <div>
      <PageHeader eyebrow="Listening" title="Comprensión auditiva" subtitle="Escucha conversaciones y mensajes con distintas voces y velocidades. Responde, completa y transcribe." />
      {!isSpeechSupported() && (
        <Callout tone="warning" className="mb-5" title="Sin síntesis de voz">
          Tu navegador no admite la Web Speech API. Puedes leer las transcripciones, pero para practicar la escucha usa Chrome, Edge o Safari.
        </Callout>
      )}
      <div className="mb-5 flex flex-wrap gap-2">
        {LEVELS.map((l) => (
          <Pill key={l} active={level === l} onClick={() => setLevel(l)} className={!hasLevelFile('listening', l) ? 'opacity-40' : ''}>
            {l}
          </Pill>
        ))}
      </div>
      {loading ? (
        <Loading />
      ) : !list?.length ? (
        <EmptyState icon={<Headphones size={20} />} title={`Las actividades de ${level} están en preparación`} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((a) => {
            const p = data.listening[a.id];
            const speakers = new Set(a.lines.map((l) => l.speaker)).size;
            return (
              <Link key={a.id} to={`/listening/${a.id}`} className="card card-pad flex flex-col transition-transform hover:-translate-y-0.5">
                <div className="mb-3 flex items-center gap-2">
                  <LevelBadge level={a.level} />
                  <Badge tone="info">{KIND[a.kind]}</Badge>
                  {p?.completed && <CircleCheck size={18} className="ml-auto text-success" />}
                </div>
                <h3 className="text-lg font-semibold text-ink">{a.title}</h3>
                <p className="mt-1 line-clamp-2 flex-1 text-sm text-muted">{a.intro}</p>
                <div className="mt-4 flex items-center justify-between text-xs text-muted">
                  <span>
                    {speakers} {speakers === 1 ? 'voz' : 'voces'} · {a.questions.length} ejercicios
                  </span>
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
