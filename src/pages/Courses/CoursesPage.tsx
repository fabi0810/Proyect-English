import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ChevronRight, Clock, Crown, Lock, Sparkles } from 'lucide-react';
import type { Level } from '../../types/content';
import { LEVELS } from '../../types/content';
import { useAppStore } from '../../store/useAppStore';
import { PageHeader } from '../../components/layout/AppShell';
import { Badge, Card, LevelBadge, ProgressBar, SegmentedControl } from '../../components/ui/primitives';
import { ButtonLink } from '../../components/ui/Button';
import { getLevelDefinition, getManifest } from '../../services/content/loader';
import { LEVEL_META } from '../../services/content/taxonomy';
import { isLevelPassed, isLevelUnlocked, levelExamAvailability, moduleState, type ModuleState } from '../../services/progress/unlock';
import { currentLevel, levelProgress } from '../../services/progress/stats';
import { formatGrade } from '../../services/evaluation/scale';
import { cn } from '../../utils/cn';

export function ModuleStateChip({ state, grade }: { state: ModuleState; grade?: number }) {
  if (state === 'passed') return <Badge tone="success">Aprobado · {formatGrade(grade)}</Badge>;
  if (state === 'in_progress') return <Badge tone="brand">En curso</Badge>;
  if (state === 'available') return <Badge tone="info">Disponible</Badge>;
  if (state === 'locked')
    return (
      <Badge>
        <Lock size={11} /> Bloqueado
      </Badge>
    );
  return <Badge tone="warning">En preparación</Badge>;
}

export default function CoursesPage() {
  const params = useParams();
  const navigate = useNavigate();
  const data = useAppStore((s) => s.data);
  const level = (LEVELS.includes(params.level as Level) ? params.level : currentLevel(data)) as Level;
  const manifest = getManifest(level);
  const def = getLevelDefinition(level);
  const progress = levelProgress(data, level);
  const unlocked = isLevelUnlocked(level, data);
  const examAvail = levelExamAvailability(level, data);
  const examPassed = isLevelPassed(data, level);
  const examBest = useMemo(
    () => Math.max(0, ...data.attempts.filter((a) => a.kind === 'level' && a.targetId === level && a.status === 'completed').map((a) => a.grade ?? 0)),
    [data.attempts, level],
  );
  const ready = manifest.modules.filter((m) => m.status === 'ready').length;

  return (
    <div>
      <PageHeader eyebrow="My Courses" title="Ruta A1 → B2" subtitle="Cada módulo combina lecciones, práctica y una evaluación. Aprueba un módulo para desbloquear el siguiente." />
      <SegmentedControl
        className="mb-6"
        value={level}
        onChange={(l) => navigate(`/courses/${l}`)}
        options={LEVELS.map((l) => ({
          value: l,
          label: (
            <span className="flex items-center gap-2">
              <LevelBadge level={l} /> <span className="hidden sm:inline">{LEVEL_META[l].name}</span>
            </span>
          ),
        }))}
      />

      <div className="mb-6 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <div className="flex items-start gap-4">
            <LevelBadge level={level} size="lg" />
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-ink">
                {LEVEL_META[level].name} <span className="font-medium text-muted">· {LEVEL_META[level].nameEs}</span>
              </h2>
              <p className="mt-1 text-[15px] text-ink-soft">{def?.objective}</p>
            </div>
          </div>
          <p className="mt-4 rounded-2xl bg-surface-2 px-4 py-3 text-[14px] leading-relaxed text-ink-soft">
            <span className="label-mono mb-1 block">Descriptor MCER</span>
            {def?.cefrGlobal}
          </p>
        </Card>
        <Card>
          <div className="flex items-baseline justify-between">
            <h3 className="font-semibold text-ink">Progreso del nivel</h3>
            <span className="font-mono text-sm text-muted">
              {progress.done}/{progress.total}
            </span>
          </div>
          <ProgressBar value={progress.ratio} className="mt-3" barClassName={LEVEL_META[level].color} />
          <p className="mt-3 text-sm text-muted">
            {progress.passedModules} de {progress.modules} módulos aprobados · examen final {examPassed ? 'aprobado' : 'pendiente'}
          </p>
          {ready < manifest.modules.length && (
            <p className="mt-3 rounded-xl bg-warning-soft px-3 py-2 text-xs text-ink-soft">
              Contenido disponible: {ready} de {manifest.modules.length} módulos. El resto está en preparación.
            </p>
          )}
          {def && (
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer font-semibold text-ink">Lo que podrás hacer (can-do)</summary>
              <ul className="mt-2 space-y-1.5 text-ink-soft">
                {Object.values(def.canDo)
                  .flat()
                  .map((c) => (
                    <li key={c} className="flex gap-2">
                      <Sparkles size={14} className="mt-1 shrink-0 text-brand" /> {c}
                    </li>
                  ))}
              </ul>
            </details>
          )}
        </Card>
      </div>

      {!unlocked && (
        <div className="mb-5 rounded-2xl border border-line bg-surface-2 px-4 py-3 text-sm text-ink-soft">
          <Lock size={14} className="mr-1 inline" /> Este nivel se desbloquea al aprobar el examen final del nivel anterior (o eligiéndolo como nivel de inicio tras el diagnóstico).
        </div>
      )}

      <div className="space-y-2.5">
        {manifest.modules.map((m) => {
          const state = moduleState(m, level, data);
          const clickable = state !== 'locked' && state !== 'planned';
          const inner = (
            <div
              className={cn(
                'flex items-center gap-4 rounded-3xl border bg-surface px-4 py-4 transition-colors sm:px-5',
                state === 'planned' ? 'border-dashed border-line' : 'border-line',
                clickable && 'hover:border-ink-soft/30',
                state === 'locked' && 'opacity-60',
              )}
            >
              <span
                className={cn(
                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl font-mono text-sm font-bold',
                  state === 'passed' ? 'bg-success text-white' : state === 'in_progress' ? 'bg-brand text-white' : 'bg-surface-2 text-muted',
                )}
              >
                {String(m.order).padStart(2, '0')}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h3 className="font-semibold text-ink">{m.title}</h3>
                  <span className="text-sm text-muted">{m.titleEs}</span>
                </div>
                <p className="mt-0.5 line-clamp-1 text-sm text-muted">{m.summary}</p>
              </div>
              <div className="hidden items-center gap-1 font-mono text-xs text-subtle md:flex">
                <Clock size={13} /> {m.estimatedMinutes} min
              </div>
              <ModuleStateChip state={state} grade={data.modules[m.id]?.bestGrade} />
              {clickable && <ChevronRight size={18} className="shrink-0 text-muted" />}
            </div>
          );
          return clickable ? (
            <Link key={m.id} to={`/module/${m.id}`} className="block">
              {inner}
            </Link>
          ) : (
            <div key={m.id}>{inner}</div>
          );
        })}

        <div className={cn('flex flex-wrap items-center gap-4 rounded-3xl px-5 py-5', examPassed ? 'bg-success-soft' : 'bg-ink text-on-ink')}>
          <span className={cn('flex h-11 w-11 items-center justify-center rounded-2xl', examPassed ? 'bg-success text-white' : 'bg-white/10')}>
            <Crown size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold">{manifest.finalExam.title}</h3>
            <p className={cn('text-sm', examPassed ? 'text-ink-soft' : 'opacity-70')}>
              {examPassed ? `Aprobado · mejor nota ${examBest.toFixed(1)}` : examAvail.ok ? 'Disponible: combina todas las destrezas del nivel.' : examAvail.reason}
            </p>
          </div>
          {examAvail.ok && (
            <ButtonLink to={`/evaluations/run/level/${level}`} variant={examPassed ? 'secondary' : 'brand'}>
              {examPassed ? 'Volver a presentar' : 'Presentar examen'}
            </ButtonLink>
          )}
        </div>
      </div>
    </div>
  );
}
