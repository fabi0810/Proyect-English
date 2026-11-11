import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, BookOpen, CircleCheck, ClipboardCheck, Dumbbell, Lock, CirclePlay, Target } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useAsync } from '../../hooks/useAsync';
import { PageHeader } from '../../components/layout/AppShell';
import { Badge, Card, CardTitle, ErrorBox, LevelBadge, Loading, ProgressBar, TONE_TEXT } from '../../components/ui/primitives';
import { ButtonLink } from '../../components/ui/Button';
import { findModuleSummary, loadModule } from '../../services/content/loader';
import { lessonState, moduleEvaluationAvailability, moduleState } from '../../services/progress/unlock';
import { modulePool } from '../../services/evaluation/builders';
import { formatGrade, gradeTone } from '../../services/evaluation/scale';
import { formatDate } from '../../utils/dates';
import { cn } from '../../utils/cn';
import { ModuleStateChip } from './CoursesPage';

export default function ModulePage() {
  const { moduleId } = useParams() as { moduleId: string };
  const data = useAppStore((s) => s.data);
  const summary = findModuleSummary(moduleId);
  const { data: mod, error, loading } = useAsync(() => loadModule(moduleId), [moduleId]);
  const attempts = useMemo(() => data.attempts.filter((a) => a.kind === 'module' && a.targetId === moduleId), [data.attempts, moduleId]);

  if (!summary) return <ErrorBox error={`Módulo desconocido: ${moduleId}`} />;
  if (loading) return <Loading />;
  if (error || !mod) return <ErrorBox error={error ?? 'No disponible'} />;

  const state = moduleState(summary, summary.level, data);
  const avail = moduleEvaluationAvailability(mod, data);
  const completed = mod.lessons.filter((l) => data.lessons[l.id]?.status === 'completed').length;
  const pool = modulePool(mod).length;

  return (
    <div>
      <Link to={`/courses/${mod.level}`} className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft size={15} /> {mod.level} · My Courses
      </Link>
      <PageHeader
        eyebrow={
          <span className="flex items-center gap-2">
            <LevelBadge level={mod.level} /> Módulo {summary.order}
          </span>
        }
        title={mod.title}
        subtitle={`${mod.titleEs} — ${mod.description}`}
        actions={<ModuleStateChip state={state} grade={data.modules[moduleId]?.bestGrade} />}
      />

      {state === 'locked' && (
        <div className="mb-5 rounded-2xl border border-line bg-surface-2 px-4 py-3 text-sm text-ink-soft">
          <Lock size={14} className="mr-1 inline" /> Módulo bloqueado: aprueba el módulo anterior. Puedes leer la teoría en <Link to="/grammar" className="font-semibold text-info">Grammar</Link>.
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <Card>
            <CardTitle action={<span className="font-mono text-sm text-muted">{completed}/{mod.lessons.length}</span>}>Lecciones</CardTitle>
            <ProgressBar value={completed / mod.lessons.length} size="sm" className="mb-4" barClassName="bg-success" />
            <div className="space-y-2.5">
              {mod.lessons.map((l, i) => {
                const st = state === 'locked' ? 'locked' : lessonState(mod, i, data);
                const prog = data.lessons[l.id];
                const body = (
                  <div className={cn('flex items-center gap-4 rounded-2xl border border-line px-4 py-3.5', st === 'locked' ? 'opacity-55' : 'hover:bg-surface-2')}>
                    <span
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                        st === 'completed' ? 'bg-success text-white' : st === 'in_progress' ? 'bg-brand text-white' : 'bg-surface-2 text-muted',
                      )}
                    >
                      {st === 'completed' ? <CircleCheck size={18} /> : st === 'locked' ? <Lock size={16} /> : <CirclePlay size={18} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-ink">
                        {i + 1}. {l.title}
                      </div>
                      <div className="text-sm text-muted">{l.titleEs}</div>
                    </div>
                    {prog && prog.quizAttempts > 0 && <span className="font-mono text-xs text-muted">mejor {Math.round(prog.quizBest * 100)} %</span>}
                    {st === 'completed' ? <Badge tone="success">Completada</Badge> : st === 'in_progress' ? <Badge tone="brand">En curso</Badge> : st === 'available' ? <Badge tone="info">Empezar</Badge> : null}
                  </div>
                );
                return st === 'locked' ? (
                  <div key={l.id}>{body}</div>
                ) : (
                  <Link key={l.id} to={`/lesson/${l.id}`} className="block">
                    {body}
                  </Link>
                );
              })}
            </div>
          </Card>

          <Card>
            <CardTitle>Objetivos del módulo</CardTitle>
            <ul className="space-y-2">
              {mod.objectives.map((o) => (
                <li key={o} className="flex gap-2.5 text-[15px] text-ink-soft">
                  <Target size={17} className="mt-0.5 shrink-0 text-brand" /> {o}
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="bg-ink text-on-ink">
            <div className="mb-2 flex items-center gap-2">
              <ClipboardCheck size={20} />
              <h2 className="text-lg font-semibold">Evaluación del módulo</h2>
            </div>
            <p className="text-sm opacity-75">
              15 preguntas aleatorias de un banco de {pool}. Nota mínima {data.settings.passGrade.toFixed(1)}. Cada intento usa preguntas distintas.
            </p>
            <div className="mt-5">
              {avail.ok ? (
                <ButtonLink to={`/evaluations/run/module/${mod.id}`} variant="brand" block>
                  {attempts.length ? 'Presentar de nuevo' : 'Presentar evaluación'}
                </ButtonLink>
              ) : (
                <p className="rounded-xl bg-white/10 px-3 py-2 text-sm">{avail.reason}</p>
              )}
            </div>
          </Card>

          <Card>
            <CardTitle>Intentos</CardTitle>
            {attempts.length === 0 ? (
              <p className="text-sm text-muted">Aún no has presentado esta evaluación.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th className="pb-2 font-medium">#</th>
                    <th className="pb-2 font-medium">Nota</th>
                    <th className="pb-2 font-medium">Resultado</th>
                    <th className="pb-2 font-medium">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((a) => (
                    <tr key={a.id} className="border-t border-line">
                      <td className="py-2 font-mono">{a.number}</td>
                      <td className={cn('py-2 font-mono font-semibold', TONE_TEXT[gradeTone(a.grade, a.passGrade)])}>
                        {a.status === 'completed' ? (
                          <Link to={`/evaluations/result/${a.id}`} className="hover:underline">
                            {formatGrade(a.grade)}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-2">{a.status === 'abandoned' ? <Badge>Abandonado</Badge> : a.passed ? <Badge tone="success">Aprobado</Badge> : <Badge tone="danger">No aprobado</Badge>}</td>
                      <td className="py-2 text-muted">{formatDate(a.finishedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card>
            <CardTitle>Practicar</CardTitle>
            <div className="flex flex-col gap-2">
              <ButtonLink to={`/practice?module=${mod.id}`} variant="secondary" icon={<Dumbbell size={16} />}>
                Práctica del módulo
              </ButtonLink>
              <ButtonLink to={`/grammar/${mod.lessons[0].id}`} variant="secondary" icon={<BookOpen size={16} />}>
                Teoría (libro de gramática)
              </ButtonLink>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
