import { useMemo } from 'react';
import { Link } from 'react-router';
import { ClipboardCheck, Crown, Lock } from 'lucide-react';
import { LEVELS } from '../../types/content';
import { useAppStore } from '../../store/useAppStore';
import { PageHeader } from '../../components/layout/AppShell';
import { ButtonLink } from '../../components/ui/Button';
import { Badge, Callout, Card, LevelBadge, TONE_TEXT } from '../../components/ui/primitives';
import { getManifest } from '../../services/content/loader';
import { isLevelPassed, levelExamAvailability, moduleState } from '../../services/progress/unlock';
import { formatGrade, gradeTone, percentNeeded } from '../../services/evaluation/scale';
import { cn } from '../../utils/cn';

export default function EvaluationsPage() {
  const data = useAppStore((s) => s.data);
  const active = data.activeExam;
  const settings = data.settings;
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of data.attempts) if (a.status === 'completed') m.set(`${a.kind}:${a.targetId}`, (m.get(`${a.kind}:${a.targetId}`) ?? 0) + 1);
    return m;
  }, [data.attempts]);

  return (
    <div>
      <PageHeader eyebrow="Evaluations" title="Evaluaciones" subtitle="Evaluaciones de módulo y exámenes finales integrales. Preguntas aleatorias de bancos amplios; cada intento es distinto y todas las notas quedan en el historial." />
      {active && active.kind !== 'lesson' && (
        <Callout tone="info" className="mb-5" title="Evaluación en curso">
          {active.title}.{' '}
          <Link to={`/evaluations/run/${active.kind}/${active.targetId}`} className="font-semibold text-info hover:underline">
            Reanudar
          </Link>
        </Callout>
      )}
      <Card className="mb-6">
        <div className="grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <div className="label-mono mb-1">Escala</div>
            <p className="text-ink-soft">1.0 a 5.0, truncada a un decimal.</p>
          </div>
          <div>
            <div className="label-mono mb-1">Aprobación</div>
            <p className="text-ink-soft">
              Nota ≥ <strong className="text-ink">{settings.passGrade.toFixed(1)}</strong> ({Math.round(percentNeeded(settings.passGrade, settings.exigency) * 100)} % de aciertos). Examen final: además ≥ {Math.round(settings.sectionMinimum * 100)} % en cada sección.
            </p>
          </div>
          <div>
            <div className="label-mono mb-1">Intentos</div>
            <p className="text-ink-soft">Ilimitados. Se priorizan preguntas no vistas. La nota vigente es la más alta; se conservan todas.</p>
          </div>
        </div>
      </Card>

      <div className="space-y-8">
        {LEVELS.map((level) => {
          const manifest = getManifest(level);
          const ready = manifest.modules.filter((m) => m.status === 'ready');
          if (!ready.length) return null;
          const examAvail = levelExamAvailability(level, data);
          const examPassed = isLevelPassed(data, level);
          return (
            <section key={level}>
              <div className="mb-3 flex items-center gap-3">
                <LevelBadge level={level} />
                <h2 className="text-lg font-semibold text-ink">Nivel {level}</h2>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {ready.map((m) => {
                  const st = moduleState(m, level, data);
                  const best = data.modules[m.id]?.bestGrade;
                  const n = counts.get(`module:${m.id}`) ?? 0;
                  return (
                    <div key={m.id} className={cn('card flex items-center gap-4 px-5 py-4', st === 'locked' && 'opacity-60')}>
                      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', st === 'passed' ? 'bg-success text-white' : 'bg-surface-2 text-muted')}>
                        {st === 'locked' ? <Lock size={16} /> : <ClipboardCheck size={18} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-ink">{m.title}</div>
                        <div className="text-xs text-muted">
                          {n} intento{n === 1 ? '' : 's'}
                          {best !== undefined && (
                            <>
                              {' '}· nota vigente <span className={cn('font-mono font-semibold', TONE_TEXT[gradeTone(best, settings.passGrade)])}>{formatGrade(best)}</span>
                            </>
                          )}
                        </div>
                      </div>
                      {st === 'passed' ? (
                        <Badge tone="success">Aprobado</Badge>
                      ) : st === 'locked' ? (
                        <Badge>Bloqueado</Badge>
                      ) : (
                        <ButtonLink to={`/module/${m.id}`} size="sm" variant="secondary">
                          Ir
                        </ButtonLink>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className={cn('mt-3 flex flex-wrap items-center gap-4 rounded-3xl px-5 py-4', examPassed ? 'bg-success-soft' : 'bg-ink text-on-ink')}>
                <Crown size={22} />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{manifest.finalExam.title}</div>
                  <div className={cn('text-sm', examPassed ? 'text-ink-soft' : 'opacity-70')}>
                    {examPassed ? 'Aprobado' : examAvail.ok ? 'Disponible' : examAvail.reason} · {counts.get(`level:${level}`) ?? 0} intentos
                  </div>
                </div>
                {examAvail.ok && (
                  <ButtonLink to={`/evaluations/run/level/${level}`} variant={examPassed ? 'secondary' : 'brand'}>
                    {examPassed ? 'Volver a presentar' : 'Presentar'}
                  </ButtonLink>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
