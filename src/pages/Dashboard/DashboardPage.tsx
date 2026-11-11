import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight,
  Brain,
  CalendarDays,
  ChevronRight,
  CircleAlert,
  Compass,
  Flame,
  GraduationCap,
  Library,
  Lock,
  Repeat,
  Sparkles,
  Trophy,
  Zap,
} from 'lucide-react';
import { LEVELS } from '../../types/content';
import { useAppStore } from '../../store/useAppStore';
import { useAsync } from '../../hooks/useAsync';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Badge, Card, CardTitle, EmptyState, LevelBadge, ProgressBar, TONE_TEXT } from '../../components/ui/primitives';
import { errorCatalog } from '../../services/content/catalog';
import { getManifest, loadVocabulary, topicLabel, topics } from '../../services/content/loader';
import { LEVEL_META, SKILL_LABELS } from '../../services/content/taxonomy';
import { ACHIEVEMENTS } from '../../services/progress/achievements';
import {
  averageGrade,
  currentLevel,
  frequentErrors,
  levelProgress,
  overallProgress,
  skillAccuracy,
  streak,
  unresolvedMistakes,
  weakTopics,
  weekActivity,
  wordsLearned,
} from '../../services/progress/stats';
import { moduleState, nextStep } from '../../services/progress/unlock';
import { formatGrade, gradeTone } from '../../services/evaluation/scale';
import { isDue } from '../../services/vocabulary/srs';
import { dayKey, formatDuration, relativeDay } from '../../utils/dates';
import { cn } from '../../utils/cn';

function Onboarding() {
  const updateProfile = useAppStore((s) => s.updateProfile);
  const [name, setName] = useState('');
  return (
    <Card className="mb-6 overflow-hidden !p-0">
      <div className="grid gap-0 md:grid-cols-[1.2fr_1fr]">
        <div className="p-6 sm:p-8">
          <Badge tone="brand" className="mb-3">
            Bienvenida
          </Badge>
          <h2 className="text-2xl font-bold tracking-tight text-ink">Configura tu punto de partida</h2>
          <p className="mt-2 text-[15px] text-ink-soft">
            Esta plataforma te lleva de A1 a B2 con lecciones, práctica, evaluaciones exigentes y seguimiento. Todo se guarda en este navegador; puedes exportar una copia cuando quieras.
          </p>
          <label className="mt-5 block">
            <span className="mb-1.5 block text-sm font-semibold text-ink">¿Cómo te llamas? (opcional)</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" className="input max-w-sm" />
          </label>
        </div>
        <div className="flex flex-col justify-center gap-3 bg-surface-2 p-6 sm:p-8">
          <Link
            to="/diagnostic"
            onClick={() => updateProfile({ name: name.trim(), onboarded: true })}
            className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-4 hover:border-brand"
          >
            <Compass className="text-brand" />
            <span className="flex-1">
              <span className="block font-semibold text-ink">Hacer el diagnóstico</span>
              <span className="block text-sm text-muted">Estima tu nivel (A1–B2) en unos 15 minutos.</span>
            </span>
            <ChevronRight size={18} className="text-muted" />
          </Link>
          <Button
            variant="primary"
            size="lg"
            iconRight={<ArrowRight size={16} />}
            onClick={() => updateProfile({ name: name.trim(), onboarded: true, startLevel: 'A1' })}
          >
            Empezar desde A1
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const data = useAppStore((s) => s.data);
  const level = currentLevel(data);
  const step = useMemo(() => nextStep(data), [data]);
  const manifest = getManifest(step.level);
  const { data: vocab } = useAsync(() => loadVocabulary(level), [level]);

  const week = weekActivity(data);
  const days = streak(data);
  const today = data.activity[dayKey()];
  const todayMin = Math.round((today?.seconds ?? 0) / 60);
  const avg = averageGrade(data);
  const overall = overallProgress(data);
  const learned = wordsLearned(data);
  const due = Object.values(data.vocab.cards).filter((c) => isDue(c)).length;
  const newWords = vocab ? vocab.filter((w) => !data.vocab.cards[w.id]).length : 0;
  const mistakes = unresolvedMistakes(data).length;
  const skills = skillAccuracy(data, level);
  const errors = frequentErrors(data, 4);
  const weak = weakTopics(data, 4);
  const lastAttempts = data.attempts.filter((a) => a.status === 'completed' && (a.kind === 'module' || a.kind === 'level')).slice(-5).reverse();
  const recent = data.events.slice(-6).reverse();
  const recentAch = Object.entries(data.achievements)
    .sort((a, b) => b[1].unlockedAt.localeCompare(a[1].unlockedAt))
    .slice(0, 3)
    .map(([id]) => ACHIEVEMENTS.find((a) => a.id === id))
    .filter(Boolean);

  const stepModule = manifest.modules.find((m) => m.id === step.moduleId);
  const upcoming = stepModule ? manifest.modules.filter((m) => m.order > stepModule.order).slice(0, 2) : [];
  const moduleLessons = stepModule ? Object.entries(data.lessons).filter(([id, l]) => id.startsWith(`${stepModule.id}-l`) && l.status === 'completed').length : 0;

  return (
    <div>
      {!data.profile.onboarded && <Onboarding />}
      <h1 className="mt-2 mb-6 text-[32px] leading-tight font-semibold tracking-tight sm:text-[42px]">
        <span className="text-subtle">{data.profile.name ? 'Welcome back,' : 'Welcome,'}</span>{' '}
        <span className="text-ink">{data.profile.name || 'learner'}!</span>
      </h1>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div className="grid gap-5 md:grid-cols-2">
            <Card>
              <CardTitle action={<ButtonLink to={`/courses/${step.level}`} variant="ghost" size="sm" iconRight={<ChevronRight size={15} />}>Curso</ButtonLink>}>
                Self-study course
              </CardTitle>
              <Link to={step.link} className="block rounded-2xl bg-brand p-4 text-white transition-transform hover:-translate-y-0.5 dark:text-bg">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="rounded-md bg-warning px-1.5 py-0.5 text-[11px] font-bold text-white">{step.kind === 'level-exam' ? 'Examen' : step.level}</span>
                    <div className="mt-2 text-[17px] font-semibold">{step.label}</div>
                  </div>
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/40">
                    <GraduationCap size={18} />
                  </span>
                </div>
                {stepModule && (
                  <>
                    <ProgressBar value={moduleLessons / (stepModule.lessons ?? 3)} size="sm" className="mt-4 !bg-white/25" barClassName="bg-yellow-300" />
                    <div className="mt-2 flex justify-between text-xs opacity-85">
                      <span>{step.kind === 'planned' ? 'En preparación' : 'Continuar'}</span>
                      <span>Módulo {stepModule.order}/{manifest.modules.length}</span>
                    </div>
                  </>
                )}
              </Link>
              <div className="mt-3 space-y-2">
                {upcoming.map((m) => {
                  const st = moduleState(m, step.level, data);
                  return (
                    <div key={m.id} className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2 px-4 py-3 text-sm">
                      <span className="truncate text-ink-soft">{m.title}</span>
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface text-muted">{st === 'locked' || st === 'planned' ? <Lock size={13} /> : <ChevronRight size={14} />}</span>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card>
              <CardTitle action={<ButtonLink to="/diagnostic" variant="secondary" size="sm" icon={<Compass size={14} />}>{data.profile.diagnostic ? 'Repetir test' : 'Diagnóstico'}</ButtonLink>}>Level</CardTitle>
              <div className="flex items-end gap-3">
                <span className={cn('text-6xl leading-none font-semibold tracking-tight', LEVEL_META[level].text)}>{level}</span>
                <span className="pb-1 text-xs leading-tight text-muted">
                  {LEVEL_META[level].name}
                  <br />
                  {data.profile.diagnostic ? `Diagnóstico: ${data.profile.diagnostic.estimatedLevel}` : 'Nivel en curso'}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                {(['grammar', 'vocabulary', 'reading', 'listening'] as const).map((sk) => {
                  const s = skills[sk];
                  const ratio = s && s.total ? s.correct / s.total : 0;
                  return (
                    <div key={sk} className="rounded-2xl bg-surface-2 px-3 py-2.5">
                      <div className="text-[13px] font-medium text-ink">{SKILL_LABELS[sk]}</div>
                      <div className="mt-2 flex items-center gap-2">
                        <ProgressBar value={ratio} size="sm" barClassName={ratio >= 0.8 ? 'bg-success' : ratio >= 0.6 ? 'bg-warning' : 'bg-brand'} />
                        <span className="font-mono text-[11px] text-muted">{s?.total ? `${Math.round(ratio * 100)}%` : '—'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          <Card>
            <CardTitle action={<span className="font-mono text-sm text-muted">{Math.round(overall * 100)} % total</span>}>Progreso A1 → B2</CardTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              {LEVELS.map((l) => {
                const p = levelProgress(data, l);
                return (
                  <Link key={l} to={`/courses/${l}`} className="flex items-center gap-3 rounded-2xl px-1 py-1 hover:bg-surface-2">
                    <LevelBadge level={l} />
                    <div className="min-w-0 flex-1">
                      <ProgressBar value={p.ratio} size="sm" barClassName={LEVEL_META[l].color} />
                    </div>
                    <span className="w-16 text-right font-mono text-xs text-muted">
                      {p.passedModules}/{p.modules} mód.
                    </span>
                  </Link>
                );
              })}
            </div>
          </Card>

          <Card>
            <CardTitle action={<ButtonLink to="/history" variant="ghost" size="sm" iconRight={<ChevronRight size={15} />}>Historial</ButtonLink>}>Evaluaciones recientes</CardTitle>
            {lastAttempts.length === 0 ? (
              <p className="text-sm text-muted">Aún no has presentado evaluaciones de módulo. Completa las lecciones de un módulo para presentar su evaluación.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[460px] text-sm">
                  <thead>
                    <tr className="bg-surface-2 text-left text-xs text-muted">
                      <th className="rounded-l-xl px-3 py-2 font-medium">Evaluación</th>
                      <th className="px-3 py-2 font-medium">Intento</th>
                      <th className="px-3 py-2 font-medium">Nota</th>
                      <th className="rounded-r-xl px-3 py-2 font-medium">Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lastAttempts.map((a) => (
                      <tr key={a.id} className="border-b border-line last:border-0">
                        <td className="px-3 py-2.5">
                          <Link to={`/evaluations/result/${a.id}`} className="font-medium text-ink hover:underline">
                            {a.title.replace('Evaluación: ', '')}
                          </Link>
                        </td>
                        <td className="px-3 py-2.5 font-mono">{a.number}</td>
                        <td className={cn('px-3 py-2.5 font-mono font-semibold', TONE_TEXT[gradeTone(a.grade, a.passGrade)])}>{formatGrade(a.grade)}</td>
                        <td className="px-3 py-2.5">{a.passed ? <Badge tone="success">Aprobado</Badge> : <Badge tone="danger">No aprobado</Badge>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <div className="grid gap-5 md:grid-cols-2">
            <Card>
              <CardTitle>Errores frecuentes</CardTitle>
              {errors.length === 0 ? (
                <p className="text-sm text-muted">Sin errores pendientes. Los errores que cometas aparecerán aquí con su explicación.</p>
              ) : (
                <ul className="space-y-2.5">
                  {errors.map((e) => (
                    <li key={e.tag} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-ink-soft">{errorCatalog[e.tag]?.title ?? e.tag}</span>
                      <Badge tone="danger">{e.count}</Badge>
                    </li>
                  ))}
                </ul>
              )}
              {mistakes > 0 && (
                <ButtonLink to="/mistakes" variant="secondary" size="sm" className="mt-4" icon={<CircleAlert size={14} />}>
                  Repasar {mistakes} errores
                </ButtonLink>
              )}
            </Card>
            <Card>
              <CardTitle>Temas pendientes</CardTitle>
              {weak.length === 0 ? (
                <p className="text-sm text-muted">No hay temas con errores sin resolver.</p>
              ) : (
                <ul className="space-y-2.5">
                  {weak.map((w) => (
                    <li key={w.topic} className="flex items-center justify-between gap-3 text-sm">
                      {topics[w.topic]?.lesson ? (
                        <Link to={`/grammar/${topics[w.topic].lesson}`} className="text-ink-soft hover:text-info hover:underline">
                          {topicLabel(w.topic)}
                        </Link>
                      ) : (
                        <span className="text-ink-soft">{topicLabel(w.topic)}</span>
                      )}
                      <span className="font-mono text-xs text-muted">{w.count} fallos</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>

        <div className="space-y-5">
          <Card>
            <CardTitle action={<CalendarDays size={18} className="text-muted" />}>Activity</CardTitle>
            <div className="flex items-end gap-2">
              <span className="text-5xl leading-none font-semibold tracking-tight text-ink">{days}</span>
              <span className="pb-1 text-xs leading-tight text-muted">
                {days === 1 ? 'día' : 'días'}
                <br />
                seguidos
              </span>
              <Flame size={22} className={cn('ml-auto', days > 0 ? 'text-warning' : 'text-subtle')} />
            </div>
            <div className="mt-4 flex justify-between gap-1.5">
              {week.map((d) => (
                <div
                  key={d.key}
                  title={`${d.key}: ${formatDuration(d.seconds)}`}
                  className={cn('flex h-10 flex-1 items-center justify-center rounded-xl text-xs font-semibold', d.active ? 'bg-brand text-white' : 'border border-line text-subtle')}
                >
                  {d.active ? <Zap size={16} fill="currentColor" /> : new Date(`${d.key}T12:00`).toLocaleDateString('es', { weekday: 'narrow' }).toUpperCase()}
                </div>
              ))}
            </div>
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-xs text-muted">
                <span>Hoy: {todayMin} min</span>
                <span>Meta: {data.settings.dailyGoalMinutes} min</span>
              </div>
              <ProgressBar value={todayMin / Math.max(1, data.settings.dailyGoalMinutes)} size="sm" barClassName="bg-warning" />
            </div>
          </Card>

          <Card>
            <CardTitle>Daily tasks</CardTitle>
            <ul className="space-y-3">
              {[
                { icon: <Repeat size={17} />, label: 'Repasar palabras', sub: `${due} pendientes`, to: '/vocabulary/review', value: due },
                { icon: <Sparkles size={17} />, label: 'Aprender palabras nuevas', sub: `${newWords} disponibles en ${level}`, to: '/vocabulary/review?mode=new', value: Math.min(newWords, 10) },
                { icon: <CircleAlert size={17} />, label: 'Corregir errores', sub: `${mistakes} sin resolver`, to: '/mistakes', value: mistakes },
                { icon: <Brain size={17} />, label: 'Continuar el curso', sub: step.label, to: step.link, value: undefined },
              ].map((t) => (
                <li key={t.label}>
                  <Link to={t.to} className="flex items-center gap-3 rounded-2xl px-1 py-1 hover:bg-surface-2">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line text-ink-soft">{t.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] text-muted">{t.sub}</span>
                      <span className="block truncate text-sm font-semibold text-ink">{t.label}</span>
                    </span>
                    {t.value !== undefined && <span className="rounded-lg bg-surface-2 px-2 py-1 font-mono text-sm text-ink">{t.value}</span>}
                  </Link>
                </li>
              ))}
            </ul>
            <ButtonLink to={due > 0 ? '/vocabulary/review' : step.link} block className="mt-4">
              Go to tasks
            </ButtonLink>
          </Card>

          <Card>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-2xl bg-surface-2 px-3 py-3">
                <div className={cn('font-mono text-2xl font-bold', TONE_TEXT[gradeTone(avg, data.settings.passGrade)])}>{formatGrade(avg)}</div>
                <div className="label-mono mt-0.5">Promedio</div>
              </div>
              <Link to="/vocabulary" className="rounded-2xl bg-surface-2 px-3 py-3 hover:bg-surface-3">
                <div className="font-mono text-2xl font-bold text-success">{learned}</div>
                <div className="label-mono mt-0.5">Palabras</div>
              </Link>
            </div>
            {recentAch.length > 0 ? (
              <div className="mt-4 space-y-2">
                {recentAch.map((a) => (
                  <Link key={a!.id} to="/achievements" className="flex items-center gap-2.5 rounded-xl px-1 py-1 text-sm hover:bg-surface-2">
                    <Trophy size={16} className="text-warning" />
                    <span className="text-ink-soft">{a!.title}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted">Tus logros aparecerán aquí.</p>
            )}
          </Card>

          <Card>
            <CardTitle>Actividad reciente</CardTitle>
            {recent.length === 0 ? (
              <EmptyState icon={<Library size={20} />} title="Sin actividad todavía" className="py-6" />
            ) : (
              <ul className="space-y-3">
                {recent.map((e) => (
                  <li key={e.id} className="text-sm">
                    {e.link ? (
                      <Link to={e.link} className="font-medium text-ink hover:underline">
                        {e.title}
                      </Link>
                    ) : (
                      <span className="font-medium text-ink">{e.title}</span>
                    )}
                    <div className="text-xs text-muted">
                      {relativeDay(e.ts)}
                      {e.detail ? ` · ${e.detail}` : ''}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
