import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, ClipboardCheck, ListChecks, Shuffle, TimerOff } from 'lucide-react';
import type { Exercise, Level } from '../../types/content';
import type { AttemptKind } from '../../types/progress';
import { useAppStore } from '../../store/useAppStore';
import { PageHeader } from '../../components/layout/AppShell';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Callout, Card, ErrorBox, Loading } from '../../components/ui/primitives';
import { ConfirmDialog } from '../../components/ui/Modal';
import { ExamRunner } from '../../components/evaluations/ExamRunner';
import { findModuleSummary, getManifest, loadModule } from '../../services/content/loader';
import { prepareExam, resolveExercises } from '../../services/evaluation/prepare';
import { levelExamAvailability, moduleEvaluationAvailability } from '../../services/progress/unlock';
import { percentNeeded } from '../../services/evaluation/scale';
import { MODULE_EVAL_SIZE } from '../../services/evaluation/builders';

export default function ExamPage() {
  const { kind, targetId } = useParams() as { kind: AttemptKind; targetId: string };
  const navigate = useNavigate();
  const data = useAppStore((s) => s.data);
  const active = data.activeExam;
  const startExam = useAppStore((s) => s.startExam);
  const submitExam = useAppStore((s) => s.submitExam);
  const abandonExam = useAppStore((s) => s.abandonExam);
  const [exercises, setExercises] = useState<Map<string, Exercise> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<{ ok: boolean; reason?: string } | null>(null);
  const [starting, setStarting] = useState(false);
  const [replaceOther, setReplaceOther] = useState(false);

  const isThis = active && active.kind === kind && active.targetId === targetId;
  const other = active && !isThis ? active : null;
  const settings = data.settings;
  const previous = useMemo(() => data.attempts.filter((a) => a.kind === kind && a.targetId === targetId && a.status === 'completed'), [data.attempts, kind, targetId]);

  const title = useMemo(() => {
    if (kind === 'module') return `Evaluación: ${findModuleSummary(targetId)?.title ?? targetId}`;
    if (kind === 'level') return getManifest(targetId as Level).finalExam.title;
    return 'Evaluación';
  }, [kind, targetId]);

  useEffect(() => {
    let alive = true;
    if (isThis && active) {
      resolveExercises(
        active.items.map((i) => i.id),
        active.generated,
      ).then((m) => alive && setExercises(m), (e: Error) => alive && setError(e.message));
    } else setExercises(null);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isThis, active?.attemptId]);

  useEffect(() => {
    let alive = true;
    if (kind === 'module')
      loadModule(targetId).then(
        (m) => alive && setAvailability(moduleEvaluationAvailability(m, data)),
        (e: Error) => alive && setError(e.message),
      );
    else if (kind === 'level') setAvailability(levelExamAvailability(targetId as Level, data));
    else setAvailability({ ok: false, reason: 'Las evaluaciones de lección se presentan dentro de cada lección.' });
    return () => {
      alive = false;
    };
  }, [kind, targetId, data]);

  const begin = async () => {
    setStarting(true);
    try {
      if (other) abandonExam();
      const built = await prepareExam(kind, targetId, useAppStore.getState().data);
      if (!built.exercises.length) throw new Error('No hay preguntas suficientes para esta evaluación.');
      startExam(built);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStarting(false);
    }
  };

  if (error) return <ErrorBox error={error} />;

  if (isThis && active) {
    if (!exercises) return <Loading label="Preparando la evaluación…" />;
    return (
      <div>
        <PageHeader eyebrow={kind === 'level' ? 'Examen final' : 'Evaluación de módulo'} title={active.title} subtitle="Las respuestas y explicaciones se muestran al entregar." />
        <ExamRunner
          exam={active}
          exercises={exercises}
          onSubmit={() => {
            const attempt = submitExam(exercises);
            if (attempt) navigate(`/evaluations/result/${attempt.id}`, { replace: true });
          }}
          onAbandon={() => {
            abandonExam();
            navigate('/evaluations');
          }}
        />
      </div>
    );
  }

  const count = kind === 'level' ? getManifest(targetId as Level).finalExam.sections.reduce((s, x) => s + x.count, 0) : MODULE_EVAL_SIZE;
  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/evaluations" className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft size={15} /> Evaluaciones
      </Link>
      <PageHeader eyebrow={kind === 'level' ? 'Examen final integral' : 'Evaluación de módulo'} title={title} />
      <Card>
        <ul className="grid gap-3 text-[15px] text-ink-soft sm:grid-cols-2">
          <li className="flex gap-3"><ListChecks className="shrink-0 text-brand" size={20} /> {kind === 'level' ? `≈ ${count} ítems en 7 secciones (gramática, vocabulario, lectura, audio, traducción, construcción y escritura)` : `${count} preguntas de todas las lecciones del módulo`}</li>
          <li className="flex gap-3"><Shuffle className="shrink-0 text-brand" size={20} /> Preguntas aleatorias; cada intento prioriza preguntas que no has visto.</li>
          <li className="flex gap-3"><TimerOff className="shrink-0 text-brand" size={20} /> Sin límite de tiempo. Sin respuestas hasta entregar.</li>
          <li className="flex gap-3"><ClipboardCheck className="shrink-0 text-brand" size={20} /> Aprobación: nota ≥ {settings.passGrade.toFixed(1)} ({Math.round(percentNeeded(settings.passGrade, settings.exigency) * 100)} %){kind === 'level' ? ` y ≥ ${Math.round(settings.sectionMinimum * 100)} % en cada sección` : ''}.</li>
        </ul>
        {previous.length > 0 && (
          <p className="mt-5 text-sm text-muted">
            Intentos anteriores: {previous.length} · mejor nota {Math.max(...previous.map((a) => a.grade ?? 0)).toFixed(1)}
          </p>
        )}
        <div className="mt-6">
          {!availability ? (
            <Loading label="Comprobando requisitos…" className="py-4" />
          ) : availability.ok ? (
            <Button size="lg" onClick={() => (other ? setReplaceOther(true) : void begin())} disabled={starting}>
              {starting ? 'Preparando…' : previous.length ? 'Comenzar nuevo intento' : 'Comenzar evaluación'}
            </Button>
          ) : (
            <Callout tone="warning" title="Aún no disponible">
              {availability.reason}{' '}
              {kind === 'module' && (
                <Link to={`/module/${targetId}`} className="font-semibold text-info underline-offset-2 hover:underline">
                  Ir al módulo
                </Link>
              )}
            </Callout>
          )}
        </div>
      </Card>
      {other && (
        <Callout tone="info" className="mt-4" title="Tienes otra evaluación en curso">
          {other.title}.{' '}
          <ButtonLink to={`/evaluations/run/${other.kind}/${other.targetId}`} size="sm" variant="secondary" className="ml-2">
            Reanudarla
          </ButtonLink>
        </Callout>
      )}
      <ConfirmDialog
        open={replaceOther}
        title="Hay otra evaluación en curso"
        confirmLabel="Abandonarla y comenzar"
        danger
        onCancel={() => setReplaceOther(false)}
        onConfirm={() => {
          setReplaceOther(false);
          void begin();
        }}
      >
        Si comienzas esta evaluación, «{other?.title}» quedará registrada como abandonada.
      </ConfirmDialog>
    </div>
  );
}
