import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Play } from 'lucide-react';
import type { Exercise, VocabCategory, VocabWord } from '../../types/content';
import { useAppStore } from '../../store/useAppStore';
import { useAsync } from '../../hooks/useAsync';
import { PageHeader } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { Card, EmptyState, Loading, Pill } from '../../components/ui/primitives';
import { ExercisePlayer } from '../../components/exercises/ExercisePlayer';
import { loadAllVocabulary } from '../../services/content/loader';
import { CATEGORY_LABELS_ES } from '../../services/content/taxonomy';
import { vocabQuestion } from '../../services/vocabulary/quiz';
import { currentLevel } from '../../services/progress/stats';
import { createRng, randomSeed, shuffle } from '../../utils/random';

type Kind = 'meaning' | 'english' | 'listening' | 'spelling';
const KIND_LABEL: Record<Kind, string> = { meaning: 'Significado (EN→ES)', english: 'Reconocer en inglés (ES→EN)', listening: 'Escuchar y reconocer', spelling: 'Escribir la palabra' };

function buildQuiz(words: VocabWord[], bank: VocabWord[], kinds: Kind[], size: number, seed: number): Exercise[] {
  const rng = createRng(seed);
  const out: Exercise[] = [];
  for (const w of shuffle(words, rng)) {
    if (out.length >= size) break;
    const kind = kinds[Math.floor(rng() * kinds.length)];
    if (kind === 'spelling') {
      out.push({
        id: `vq-${w.id}-spell`,
        type: 'translation',
        direction: 'es-en',
        unit: 'word',
        topic: `vocab-${w.category}`,
        skill: 'vocabulary',
        difficulty: 2,
        level: w.level,
        prompt: 'Escribe la palabra en inglés.',
        source: w.translation,
        answers: [w.word],
        explanation: `«${w.translation}» = ${w.word} (${w.ipa}). Ejemplo: ${w.example}`,
      });
      continue;
    }
    const q = vocabQuestion(w, bank, kind === 'english' ? 'es-en' : 'en-es', rng);
    if (!q) continue;
    if (kind === 'listening') {
      out.push({ ...q, id: `${q.id}-audio`, audio: w.word, hideText: true, prompt: 'Escucha la palabra y elige su significado.' });
    } else out.push(q);
  }
  return out;
}

export default function VocabQuizPage() {
  const data = useAppStore((s) => s.data);
  const { data: all, loading } = useAsync(() => loadAllVocabulary(), []);
  const [source, setSource] = useState<string>('level');
  const [kinds, setKinds] = useState<Kind[]>(['meaning', 'english', 'listening', 'spelling']);
  const [size, setSize] = useState(10);
  const [quiz, setQuiz] = useState<Exercise[] | null>(null);
  const level = currentLevel(data);

  const pool = useMemo(() => {
    if (!all) return [];
    const levelWords = all.filter((w) => w.level === level);
    if (source === 'level') return levelWords;
    if (source === 'studied') return all.filter((w) => data.vocab.cards[w.id]);
    if (source === 'difficult') return all.filter((w) => data.vocab.difficult.includes(w.id));
    if (source.startsWith('cat:')) return levelWords.filter((w) => w.category === (source.slice(4) as VocabCategory));
    if (source.startsWith('list:')) {
      const list = data.vocab.lists.find((l) => l.id === source.slice(5));
      return all.filter((w) => list?.words.includes(w.id));
    }
    return levelWords;
  }, [all, source, level, data.vocab]);

  const categories = useMemo(() => Array.from(new Set((all ?? []).filter((w) => w.level === level).map((w) => w.category))), [all, level]);

  if (loading) return <Loading />;

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/vocabulary" className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft size={15} /> Vocabulary
      </Link>
      <PageHeader eyebrow="Quiz Me" title="Quiz de vocabulario" subtitle="Practica traducción, reconocimiento, escucha y ortografía. Las respuestas se verifican con el banco de vocabulario." />
      {quiz ? (
        quiz.length ? (
          <ExercisePlayer exercises={quiz} context="vocab" finishLabel="Nuevo quiz" onFinish={() => setQuiz(null)} />
        ) : (
          <EmptyState title="No hay suficientes palabras para este quiz" action={<Button onClick={() => setQuiz(null)}>Volver</Button>} />
        )
      ) : (
        <Card className="space-y-6">
          <div>
            <div className="mb-2 text-sm font-semibold text-ink">Palabras</div>
            <div className="flex flex-wrap gap-2">
              <Pill active={source === 'level'} onClick={() => setSource('level')}>
                Nivel {level}
              </Pill>
              <Pill active={source === 'studied'} onClick={() => setSource('studied')}>
                Ya estudiadas
              </Pill>
              <Pill active={source === 'difficult'} onClick={() => setSource('difficult')}>
                ★ Difíciles
              </Pill>
              {data.vocab.lists.map((l) => (
                <Pill key={l.id} active={source === `list:${l.id}`} onClick={() => setSource(`list:${l.id}`)}>
                  {l.name}
                </Pill>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {categories.map((c) => (
                <Pill key={c} active={source === `cat:${c}`} onClick={() => setSource(`cat:${c}`)}>
                  {CATEGORY_LABELS_ES[c]}
                </Pill>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">{pool.length} palabras disponibles.</p>
          </div>
          <div>
            <div className="mb-2 text-sm font-semibold text-ink">Tipos de pregunta</div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
                <Pill key={k} active={kinds.includes(k)} onClick={() => setKinds((ks) => (ks.includes(k) ? (ks.length > 1 ? ks.filter((x) => x !== k) : ks) : [...ks, k]))}>
                  {KIND_LABEL[k]}
                </Pill>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-sm font-semibold text-ink">Número de preguntas</div>
            <div className="flex gap-2">
              {[5, 10, 20].map((n) => (
                <Pill key={n} active={size === n} onClick={() => setSize(n)}>
                  {n}
                </Pill>
              ))}
            </div>
          </div>
          <Button size="lg" icon={<Play size={16} />} disabled={pool.length < 4 || !all} onClick={() => all && setQuiz(buildQuiz(pool, all, kinds, size, randomSeed()))}>
            Empezar quiz
          </Button>
        </Card>
      )}
    </div>
  );
}
