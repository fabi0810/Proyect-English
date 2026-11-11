import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useAsync } from '../../hooks/useAsync';
import { PageHeader } from '../../components/layout/AppShell';
import { EmptyState, ErrorBox, Loading } from '../../components/ui/primitives';
import { ExamResultView } from '../../components/evaluations/ExamResultView';
import { resolveExercises } from '../../services/evaluation/prepare';
import { topicBuckets } from '../../services/evaluation/results';
import { formatDateTime } from '../../utils/dates';

export default function ResultPage() {
  const { attemptId } = useParams() as { attemptId: string };
  const attempts = useAppStore((s) => s.data.attempts);
  const attempt = useMemo(() => attempts.find((a) => a.id === attemptId), [attempts, attemptId]);
  const { data: exercises, error, loading } = useAsync(
    () => (attempt ? resolveExercises(attempt.items.map((i) => i.id), attempt.generated) : Promise.resolve(new Map())),
    [attempt?.id],
  );
  if (!attempt) return <EmptyState title="Intento no encontrado" action={<Link to="/history" className="font-semibold text-info">Ver historial</Link>} />;
  if (attempt.status === 'abandoned') return <EmptyState title="Evaluación abandonada">Este intento se abandonó y no tiene nota.</EmptyState>;
  const pending = topicBuckets(attempt.topics).pending;
  const practiceLink = pending.length ? `/practice?topics=${pending.join(',')}${attempt.kind === 'module' ? `&from=${attempt.targetId}` : ''}` : undefined;
  const retryLink = attempt.kind === 'module' || attempt.kind === 'level' ? `/evaluations/run/${attempt.kind}/${attempt.targetId}` : undefined;
  const continueLink = attempt.kind === 'module' ? `/module/${attempt.targetId}` : attempt.kind === 'level' ? `/courses/${attempt.level}` : undefined;
  return (
    <div>
      <Link to="/evaluations" className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft size={15} /> Evaluaciones
      </Link>
      <PageHeader eyebrow={`Resultado · ${formatDateTime(attempt.finishedAt)}`} title={attempt.title} />
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox error={error} />
      ) : (
        <ExamResultView
          attempt={attempt}
          exercises={exercises ?? new Map()}
          retryLink={retryLink}
          practiceLink={practiceLink}
          continueLink={continueLink}
          continueLabel={attempt.kind === 'module' ? 'Volver al módulo' : 'Ver el nivel'}
        />
      )}
    </div>
  );
}
