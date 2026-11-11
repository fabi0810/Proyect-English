import { useMemo, useState } from 'react';
import { Languages, Play } from 'lucide-react';
import type { Level, TranslationExercise } from '../../types/content';
import { LEVELS } from '../../types/content';
import { useAppStore } from '../../store/useAppStore';
import { useAsync } from '../../hooks/useAsync';
import { PageHeader } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { Callout, Card, EmptyState, Loading, Pill } from '../../components/ui/primitives';
import { ExercisePlayer } from '../../components/exercises/ExercisePlayer';
import { loadLevelModules, loadTranslations, moduleExercises } from '../../services/content/loader';
import { currentLevel } from '../../services/progress/stats';
import { randomSeed, createRng, shuffle } from '../../utils/random';

type Unit = 'all' | 'word' | 'expression' | 'sentence' | 'paragraph';
const UNIT_LABEL: Record<Unit, string> = { all: 'Todo', word: 'Palabras', expression: 'Expresiones', sentence: 'Oraciones', paragraph: 'Párrafos' };

export default function TranslationPage() {
  const data = useAppStore((s) => s.data);
  const [level, setLevel] = useState<Level>(currentLevel(data));
  const [unit, setUnit] = useState<Unit>('all');
  const [direction, setDirection] = useState<'both' | 'en-es' | 'es-en'>('both');
  const [onlyFailed, setOnlyFailed] = useState(false);
  const [session, setSession] = useState<TranslationExercise[] | null>(null);
  const { data: bank, loading } = useAsync(async () => {
    const [own, mods] = await Promise.all([loadTranslations(level), loadLevelModules(level)]);
    const fromModules = mods.flatMap(moduleExercises).filter((e): e is TranslationExercise => e.type === 'translation');
    return [...own, ...fromModules];
  }, [level]);

  const pool = useMemo(
    () =>
      (bank ?? []).filter(
        (t) =>
          (unit === 'all' || (t.unit ?? 'sentence') === unit) &&
          (direction === 'both' || t.direction === direction) &&
          (!onlyFailed || (data.itemStats[t.id] && data.itemStats[t.id].lastVerdict !== 'correct')),
      ),
    [bank, unit, direction, onlyFailed, data.itemStats],
  );

  return (
    <div>
      <PageHeader eyebrow="Translation" title="Entrenador de traducción" subtitle="Escribe tu propia traducción. La app la compara con las respuestas válidas, marca diferencias palabra a palabra, acepta alternativas y explica la diferencia entre traducción literal y natural." />
      {session ? (
        <div className="mx-auto max-w-3xl">
          <ExercisePlayer exercises={session} context="translation" finishLabel="Nueva sesión" onFinish={() => setSession(null)} />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <Card className="space-y-6">
            <div>
              <div className="mb-2 text-sm font-semibold text-ink">Nivel</div>
              <div className="flex flex-wrap gap-2">
                {LEVELS.map((l) => (
                  <Pill key={l} active={level === l} onClick={() => setLevel(l)}>
                    {l}
                  </Pill>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-sm font-semibold text-ink">Qué traducir</div>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(UNIT_LABEL) as Unit[]).map((u) => (
                  <Pill key={u} active={unit === u} onClick={() => setUnit(u)}>
                    {UNIT_LABEL[u]}
                  </Pill>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-sm font-semibold text-ink">Dirección</div>
              <div className="flex flex-wrap gap-2">
                <Pill active={direction === 'both'} onClick={() => setDirection('both')}>Ambas</Pill>
                <Pill active={direction === 'en-es'} onClick={() => setDirection('en-es')}>Inglés → Español</Pill>
                <Pill active={direction === 'es-en'} onClick={() => setDirection('es-en')}>Español → Inglés</Pill>
                <Pill active={onlyFailed} onClick={() => setOnlyFailed((v) => !v)}>Solo las que fallé</Pill>
              </div>
            </div>
            {loading ? (
              <Loading className="py-4" />
            ) : pool.length === 0 ? (
              <EmptyState icon={<Languages size={20} />} title="No hay traducciones con estos filtros" className="py-8" />
            ) : (
              <Button size="lg" icon={<Play size={16} />} onClick={() => setSession(shuffle(pool, createRng(randomSeed())).slice(0, 10))}>
                Empezar ({Math.min(10, pool.length)} de {pool.length})
              </Button>
            )}
          </Card>
          <div className="space-y-4">
            <Callout tone="info" title="Cómo se evalúa">
              Se aceptan varias traducciones correctas (contracciones, sinónimos y órdenes alternativos declarados). Si solo hay una errata menor se acepta con una nota; si tu frase contiene las ideas clave pero con otra estructura, obtienes crédito parcial y una comparación.
            </Callout>
            <Callout tone="tip" title="Traducir no es sustituir palabras">
              «Tengo 20 años» no es «I have 20 years», sino «I am 20». Busca cómo lo diría un hablante nativo. Las notas de cada ejercicio explican estas diferencias.
            </Callout>
            <Callout tone="warning" title="¿Tu respuesta es válida y no se aceptó?">
              Usa «Mi respuesta también es válida»: se registrará para revisar el banco de respuestas (no se usa en evaluaciones).
            </Callout>
          </div>
        </div>
      )}
    </div>
  );
}
