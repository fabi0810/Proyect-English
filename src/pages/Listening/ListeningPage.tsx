import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import type { GradeResult, Response } from '../../types/exercise';
import { isCorrectVerdict } from '../../types/exercise';
import { useAppStore } from '../../store/useAppStore';
import { useAsync } from '../../hooks/useAsync';
import { PageHeader } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { Badge, Card, ErrorBox, LevelBadge, Loading } from '../../components/ui/primitives';
import { AudioPlayer } from '../../components/listening/AudioPlayer';
import { ExerciseView } from '../../components/exercises/ExerciseView';
import { FeedbackPanel } from '../../components/exercises/FeedbackPanel';
import { levelOfId, loadListening } from '../../services/content/loader';
import { gradeExercise, isResponseComplete } from '../../services/exercises/grade';
import { defaultPrompt } from '../../services/exercises/prompts';

export default function ListeningPage() {
  const { id } = useParams() as { id: string };
  const level = levelOfId(id) ?? 'A1';
  const { data: list, error, loading } = useAsync(() => loadListening(level), [level]);
  const recordAnswer = useAppStore((s) => s.recordAnswer);
  const completeActivity = useAppStore((s) => s.completeActivity);
  const showEs = useAppStore((s) => s.data.settings.showSpanishSupport);
  const [transcript, setTranscript] = useState(false);
  const [answers, setAnswers] = useState<Record<string, Response | undefined>>({});
  const [results, setResults] = useState<Record<string, GradeResult> | null>(null);
  if (loading) return <Loading />;
  const act = list?.find((a) => a.id === id);
  if (error || !act) return <ErrorBox error={error ?? 'Actividad no encontrada'} />;
  const allAnswered = act.questions.every((q) => isResponseComplete(q, answers[q.id]));

  const check = () => {
    const res: Record<string, GradeResult> = {};
    let total = 0;
    for (const q of act.questions) {
      const r = gradeExercise(q, answers[q.id]);
      res[q.id] = r;
      total += r.score;
      recordAnswer(q, r, 'listening');
    }
    setResults(res);
    setTranscript(true);
    completeActivity('listening', act.id, total / act.questions.length, `Listening: ${act.title}`);
  };

  return (
    <div>
      <Link to="/listening" className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft size={15} /> Listening
      </Link>
      <PageHeader
        eyebrow={
          <span className="flex items-center gap-2">
            <LevelBadge level={act.level} /> {act.kind === 'dialogue' ? 'Conversación' : act.kind === 'monologue' ? 'Monólogo' : 'Anuncio'}
          </span>
        }
        title={act.title}
        subtitle={act.intro}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-4">
          <AudioPlayer id={`listening-${act.id}`} lines={act.lines.map((l) => ({ text: l.text, speaker: l.speaker }))} audioUrl={act.audioUrl} audioCredit={act.audioCredit} />
          <Card>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-ink">Transcripción</h3>
              <Button size="sm" variant="ghost" icon={transcript ? <EyeOff size={15} /> : <Eye size={15} />} onClick={() => setTranscript((t) => !t)}>
                {transcript ? 'Ocultar' : 'Mostrar'}
              </Button>
            </div>
            {transcript ? (
              <div className="mt-3 space-y-2 text-[15.5px]">
                {act.lines.map((l, i) => (
                  <p key={i}>
                    <span className="font-semibold text-brand">{l.speaker}: </span>
                    <span className="text-ink">{l.text}</span>
                    {showEs && l.es && <span className="block text-sm text-muted">{l.es}</span>}
                  </p>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted">Intenta responder primero solo escuchando. Puedes bajar la velocidad o repetir el audio las veces que quieras.</p>
            )}
          </Card>
        </div>
        <Card>
          <div className="space-y-6">
            {act.questions.map((q, i) => (
              <div key={q.id} className="border-b border-dashed border-line pb-5 last:border-0">
                <span className="mb-2 inline-block rounded-md bg-coral px-2 py-0.5 text-xs font-semibold text-white">Task {i + 1}</span>
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
                {act.questions.filter((q) => isCorrectVerdict(results[q.id].verdict)).length}/{act.questions.length} correctas
              </Badge>
              <Button variant="secondary" onClick={() => { setResults(null); setAnswers({}); setTranscript(false); }}>
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
  );
}
