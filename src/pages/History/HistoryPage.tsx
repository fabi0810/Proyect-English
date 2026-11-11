import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Download, GraduationCap, RotateCcw } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { LEVELS } from '../../types/content';
import type { ArchivedCourse, AttemptKind, EvaluationAttempt } from '../../types/progress';
import { useAppStore } from '../../store/useAppStore';
import { PageHeader } from '../../components/layout/AppShell';
import { ButtonLink, Button } from '../../components/ui/Button';
import { Badge, Card, CardTitle, EmptyState, LevelBadge, Pill, Stat, TONE_TEXT } from '../../components/ui/primitives';
import { buildAcademicReport } from '../../services/progress/report';
import { formatGrade, gradeTone } from '../../services/evaluation/scale';
import { isLevelPassed } from '../../services/progress/unlock';
import { downloadJson } from '../../services/storage/backup';
import { formatDate, formatDateTime, formatDuration, lastDays } from '../../utils/dates';
import { cn } from '../../utils/cn';
import type { AcademicReport } from '../../types/progress';

const KIND_LABEL: Record<AttemptKind, string> = { lesson: 'Lección', module: 'Módulo', level: 'Examen final', diagnostic: 'Diagnóstico' };

function AttemptsTable({ attempts }: { attempts: EvaluationAttempt[] }) {
  if (!attempts.length) return <p className="text-sm text-muted">No hay intentos con este filtro.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="bg-surface-2 text-left text-xs text-muted">
            <th className="rounded-l-xl px-3 py-2.5 font-medium">Evaluación</th>
            <th className="px-3 py-2.5 font-medium">Tipo</th>
            <th className="px-3 py-2.5 text-right font-medium">Intento</th>
            <th className="px-3 py-2.5 text-right font-medium">Nota</th>
            <th className="px-3 py-2.5 text-right font-medium">Aciertos</th>
            <th className="px-3 py-2.5 font-medium">Resultado</th>
            <th className="rounded-r-xl px-3 py-2.5 font-medium">Fecha</th>
          </tr>
        </thead>
        <tbody>
          {attempts.map((a) => (
            <tr key={a.id} className="border-b border-line last:border-0">
              <td className="px-3 py-2.5">
                {a.status === 'completed' && a.kind !== 'diagnostic' && a.kind !== 'lesson' ? (
                  <Link to={`/evaluations/result/${a.id}`} className="font-medium text-ink hover:underline">
                    {a.title}
                  </Link>
                ) : a.kind === 'lesson' ? (
                  <Link to={`/lesson/${a.targetId}`} className="font-medium text-ink hover:underline">
                    {a.title.replace('Evaluación de la lección: ', '')}
                  </Link>
                ) : (
                  <span className="font-medium text-ink">{a.title}</span>
                )}
              </td>
              <td className="px-3 py-2.5 text-muted">
                <span className="flex items-center gap-1.5">
                  <LevelBadge level={a.level} /> {KIND_LABEL[a.kind]}
                </span>
              </td>
              <td className="px-3 py-2.5 text-right font-mono">{a.number}</td>
              <td className={cn('px-3 py-2.5 text-right font-mono font-semibold', TONE_TEXT[gradeTone(a.grade, a.passGrade)])}>{a.status === 'completed' && a.kind !== 'diagnostic' ? formatGrade(a.grade) : '—'}</td>
              <td className="px-3 py-2.5 text-right font-mono text-muted">{a.status === 'completed' ? `${Math.round(a.percent * 100)} %` : '—'}</td>
              <td className="px-3 py-2.5">
                {a.status === 'abandoned' ? (
                  <Badge>Abandonado</Badge>
                ) : a.kind === 'diagnostic' ? (
                  <Badge tone="info">Nivel {a.estimatedLevel}</Badge>
                ) : a.passed ? (
                  <Badge tone="success">Aprobado</Badge>
                ) : (
                  <Badge tone="danger">No aprobado</Badge>
                )}
              </td>
              <td className="px-3 py-2.5 whitespace-nowrap text-muted">{formatDateTime(a.finishedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ReportView({ report }: { report: AcademicReport }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat value={formatGrade(report.overallAverage)} label="Promedio general" tone="brand" />
        <Stat value={report.evaluationsCount} label="Evaluaciones" />
        <Stat value={report.attemptsCount} label="Intentos" />
        <Stat value={formatDuration(report.studySeconds)} label="Tiempo de estudio" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="bg-surface-2 text-left text-xs text-muted">
              <th className="rounded-l-xl px-3 py-2.5 font-medium">Nivel</th>
              <th className="px-3 py-2.5 text-right font-medium">Módulos</th>
              <th className="px-3 py-2.5 text-right font-medium">Prom. módulos</th>
              <th className="px-3 py-2.5 text-right font-medium">Examen final</th>
              <th className="rounded-r-xl px-3 py-2.5 text-right font-medium">Nota final</th>
            </tr>
          </thead>
          <tbody>
            {LEVELS.map((l) => {
              const r = report.levels[l];
              return (
                <tr key={l} className="border-b border-line last:border-0">
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-2">
                      <LevelBadge level={l} /> {r?.passed ? <Badge tone="success">Completado</Badge> : <Badge>Pendiente</Badge>}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono">
                    {r?.modulesPassed ?? 0}/{r?.modulesTotal ?? 0}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono">{formatGrade(r?.modulesAverage)}</td>
                  <td className="px-3 py-2.5 text-right font-mono">{formatGrade(r?.examGrade)}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold text-ink">{formatGrade(r?.finalGrade)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">Nota final del nivel = 40 % promedio de las notas vigentes de los módulos + 60 % nota vigente del examen final (solo si el examen está aprobado).</p>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl bg-success-soft p-4">
          <div className="label-mono mb-2 !text-success">Fortalezas</div>
          {report.strengths.length ? <ul className="list-disc space-y-1 pl-5 text-sm text-ink">{report.strengths.map((s) => <li key={s}>{s}</li>)}</ul> : <p className="text-sm text-muted">Se calcularán con más datos.</p>}
        </div>
        <div className="rounded-3xl bg-danger-soft p-4">
          <div className="label-mono mb-2 !text-danger">Debilidades</div>
          {report.weaknesses.length ? <ul className="list-disc space-y-1 pl-5 text-sm text-ink">{report.weaknesses.map((s) => <li key={s}>{s}</li>)}</ul> : <p className="text-sm text-muted">Sin debilidades destacadas por ahora.</p>}
        </div>
      </div>
      <p className="text-sm text-muted">
        {report.daysActive} días de estudio · {report.wordsLearned} palabras aprendidas · {report.passedCount} evaluaciones aprobadas
      </p>
    </div>
  );
}

export default function HistoryPage() {
  const data = useAppStore((s) => s.data);
  const getArchives = useAppStore((s) => s.getArchives);
  const [tab, setTab] = useState<'grades' | 'time' | 'report' | 'archives'>('grades');
  const [kind, setKind] = useState<AttemptKind | 'all'>('all');
  const [archives, setArchives] = useState<ArchivedCourse[]>([]);
  useEffect(() => {
    void getArchives().then(setArchives);
  }, [getArchives]);

  const attempts = useMemo(() => data.attempts.filter((a) => kind === 'all' || a.kind === kind).slice().reverse(), [data.attempts, kind]);
  const report = useMemo(() => buildAcademicReport(data), [data]);
  const gradeSeries = useMemo(
    () =>
      data.attempts
        .filter((a) => a.status === 'completed' && (a.kind === 'module' || a.kind === 'level'))
        .map((a, i) => ({ n: i + 1, grade: a.grade ?? 0, label: a.title })),
    [data.attempts],
  );
  const timeSeries = useMemo(() => lastDays(30).map((k) => ({ day: k.slice(5), min: Math.round((data.activity[k]?.seconds ?? 0) / 60) })), [data.activity]);
  const byArea = useMemo(() => {
    const acc = new Map<string, number>();
    for (const d of Object.values(data.activity)) for (const [k, v] of Object.entries(d.byArea ?? {})) acc.set(k, (acc.get(k) ?? 0) + v);
    return Array.from(acc).sort((a, b) => b[1] - a[1]);
  }, [data.activity]);
  const b2Done = isLevelPassed(data, 'B2');

  return (
    <div>
      <PageHeader eyebrow="History" title="Historial académico" subtitle="Todas tus calificaciones e intentos (nunca se sobrescriben), tu tiempo de estudio y tu informe académico." />
      <div className="mb-5 flex flex-wrap gap-2">
        <Pill active={tab === 'grades'} onClick={() => setTab('grades')}>Calificaciones</Pill>
        <Pill active={tab === 'time'} onClick={() => setTab('time')}>Tiempo de estudio</Pill>
        <Pill active={tab === 'report'} onClick={() => setTab('report')}>Informe académico</Pill>
        <Pill active={tab === 'archives'} onClick={() => setTab('archives')} count={archives.length}>Cursos anteriores</Pill>
      </div>

      {tab === 'grades' && (
        <div className="space-y-5">
          {gradeSeries.length > 1 && (
            <Card>
              <CardTitle>Evolución de notas</CardTitle>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={gradeSeries} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                    <XAxis dataKey="n" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                    <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                    <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }} formatter={(v) => [Number(v).toFixed(1), 'Nota']} labelFormatter={(_, p) => (p?.[0]?.payload as { label?: string } | undefined)?.label ?? ''} />
                    <ReferenceLine y={data.settings.passGrade} stroke="var(--warning)" strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="grade" stroke="var(--brand)" strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
          <Card>
            <div className="mb-4 flex flex-wrap gap-2">
              {(['all', 'module', 'level', 'lesson', 'diagnostic'] as const).map((k) => (
                <Pill key={k} active={kind === k} onClick={() => setKind(k)}>
                  {k === 'all' ? 'Todas' : KIND_LABEL[k]}
                </Pill>
              ))}
            </div>
            <AttemptsTable attempts={attempts} />
          </Card>
        </div>
      )}

      {tab === 'time' && (
        <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
          <Card>
            <CardTitle action={<span className="font-mono text-sm text-muted">total {formatDuration(report.studySeconds)}</span>}>Minutos por día (30 días)</CardTitle>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timeSeries} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--muted)' }} interval={4} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} allowDecimals={false} />
                  <Tooltip cursor={{ fill: 'var(--surface-2)' }} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }} formatter={(v) => [`${v} min`, 'Estudio']} />
                  <ReferenceLine y={data.settings.dailyGoalMinutes} stroke="var(--warning)" strokeDasharray="4 4" />
                  <Bar dataKey="min" fill="var(--brand)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card>
            <CardTitle>Por sección</CardTitle>
            {byArea.length === 0 ? (
              <p className="text-sm text-muted">Sin datos todavía.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {byArea.map(([area, sec]) => (
                  <li key={area} className="flex justify-between">
                    <span className="text-ink-soft capitalize">{area}</span>
                    <span className="font-mono text-muted">{formatDuration(sec)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-xs text-muted">Se cuenta el tiempo con la pestaña visible y actividad en los últimos 2 minutos.</p>
          </Card>
        </div>
      )}

      {tab === 'report' && (
        <Card>
          <CardTitle action={<Button size="sm" variant="secondary" icon={<Download size={14} />} onClick={() => downloadJson(report, `informe-academico-curso-${report.courseNumber}.json`)}>Exportar</Button>}>
            Informe académico · curso n.º {report.courseNumber}
          </CardTitle>
          {b2Done && (
            <div className="mb-5 flex flex-wrap items-center gap-3 rounded-3xl bg-success-soft px-5 py-4">
              <GraduationCap className="text-success" />
              <div className="flex-1 text-sm text-ink">
                <strong>¡Has completado el nivel B2!</strong> Puedes comenzar de nuevo desde A1 conservando una copia de todo tu historial.
              </div>
              <ButtonLink to="/settings#reset" variant="secondary" icon={<RotateCcw size={15} />}>
                Reiniciar el curso
              </ButtonLink>
            </div>
          )}
          <ReportView report={report} />
        </Card>
      )}

      {tab === 'archives' &&
        (archives.length === 0 ? (
          <EmptyState title="No hay cursos anteriores">Cuando reinicies el curso, el historial completo se archivará aquí.</EmptyState>
        ) : (
          <div className="space-y-4">
            {archives
              .slice()
              .sort((a, b) => b.archivedAt.localeCompare(a.archivedAt))
              .map((a) => (
                <Card key={a.id}>
                  <CardTitle action={<Button size="sm" variant="secondary" icon={<Download size={14} />} onClick={() => downloadJson(a, `curso-${a.courseNumber}-archivado.json`)}>Exportar</Button>}>
                    Curso n.º {a.courseNumber} · archivado el {formatDate(a.archivedAt)}
                  </CardTitle>
                  <ReportView report={a.report} />
                </Card>
              ))}
          </div>
        ))}
    </div>
  );
}
