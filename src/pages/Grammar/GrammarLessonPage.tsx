import { Link, useParams } from 'react-router';
import { ArrowLeft, ArrowRight, GraduationCap } from 'lucide-react';
import { useAsync } from '../../hooks/useAsync';
import { PageHeader } from '../../components/layout/AppShell';
import { ButtonLink } from '../../components/ui/Button';
import { Card, ErrorBox, LevelBadge, Loading } from '../../components/ui/primitives';
import { TheoryBlocks } from '../../components/lessons/TheoryBlocks';
import { loadLevelModules, loadModule, moduleIdOfLesson } from '../../services/content/loader';

export default function GrammarLessonPage() {
  const { lessonId } = useParams() as { lessonId: string };
  const { data, error, loading } = useAsync(async () => {
    const mod = await loadModule(moduleIdOfLesson(lessonId));
    const all = await loadLevelModules(mod.level);
    const flat = all.flatMap((m) => m.lessons.map((l) => ({ id: l.id, title: l.title })));
    return { mod, flat };
  }, [lessonId]);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox error={error ?? 'No disponible'} />;
  const lesson = data.mod.lessons.find((l) => l.id === lessonId);
  if (!lesson) return <ErrorBox error={`Lección desconocida: ${lessonId}`} />;
  const i = data.flat.findIndex((l) => l.id === lessonId);
  const prev = data.flat[i - 1];
  const next = data.flat[i + 1];
  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/grammar" className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft size={15} /> Libro de gramática
      </Link>
      <PageHeader
        eyebrow={
          <span className="flex items-center gap-2">
            <LevelBadge level={data.mod.level} /> {data.mod.title}
          </span>
        }
        title={lesson.title}
        subtitle={lesson.objective}
        actions={
          <ButtonLink to={`/lesson/${lesson.id}`} variant="secondary" icon={<GraduationCap size={16} />}>
            Ir a la lección
          </ButtonLink>
        }
      />
      <Card>
        <TheoryBlocks blocks={lesson.theory} />
        <div className="mt-8 rounded-3xl bg-surface-2 px-5 py-4">
          <div className="label-mono mb-2">Resumen</div>
          <ul className="list-disc space-y-1.5 pl-5 text-[15px] text-ink-soft marker:text-brand">
            {lesson.summary.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      </Card>
      <div className="mt-6 flex justify-between gap-3">
        {prev ? (
          <ButtonLink to={`/grammar/${prev.id}`} variant="secondary" icon={<ArrowLeft size={16} />}>
            <span className="max-w-[40vw] truncate">{prev.title}</span>
          </ButtonLink>
        ) : (
          <span />
        )}
        {next && (
          <ButtonLink to={`/grammar/${next.id}`} variant="secondary" iconRight={<ArrowRight size={16} />}>
            <span className="max-w-[40vw] truncate">{next.title}</span>
          </ButtonLink>
        )}
      </div>
    </div>
  );
}
