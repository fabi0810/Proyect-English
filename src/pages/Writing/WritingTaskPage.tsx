import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { ArrowLeft, Eye, Lightbulb, RefreshCw, SpellCheck } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useAsync } from '../../hooks/useAsync';
import { PageHeader } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { Callout, Card, ErrorBox, LevelBadge, Loading } from '../../components/ui/primitives';
import { renderInline } from '../../components/ui/Markdown';
import { CorrectionReport, TextDiff } from '../../components/writing/CorrectionReport';
import { levelOfId, loadWritingTasks } from '../../services/content/loader';
import { analyzeWriting } from '../../services/writing/analyze';
import { countWords } from '../../utils/text';
import { uid } from '../../utils/ids';
import { nowIso } from '../../utils/dates';
import { cn } from '../../utils/cn';

export default function WritingTaskPage() {
  const { taskId } = useParams() as { taskId: string };
  const [params] = useSearchParams();
  const level = levelOfId(taskId) ?? 'A1';
  const { data: tasks, loading, error } = useAsync(() => loadWritingTasks(level), [level]);
  const writings = useAppStore((s) => s.data.writings);
  const saveWriting = useAppStore((s) => s.saveWriting);
  const reviseWriting = useAppStore((s) => s.reviseWriting);
  const existing = useMemo(() => writings.find((w) => w.id === params.get('sub')), [writings, params]);
  const [text, setText] = useState('');
  const [subId, setSubId] = useState<string | null>(existing?.id ?? null);
  const [revision, setRevision] = useState('');
  const [showRevision, setShowRevision] = useState(false);
  const [showModel, setShowModel] = useState(false);

  if (loading) return <Loading />;
  const task = tasks?.find((t) => t.id === taskId);
  if (error || !task) return <ErrorBox error={error ?? 'Tarea no encontrada'} />;
  const sub = writings.find((w) => w.id === (subId ?? existing?.id));
  const analysis = sub ? analyzeWriting(sub.original, task) : null;
  const revAnalysis = sub?.revision ? analyzeWriting(sub.revision, task) : null;
  const words = countWords(text);

  const submit = () => {
    const a = analyzeWriting(text, task);
    const id = uid('w');
    saveWriting({
      id,
      taskId: task.id,
      level: task.level ?? level,
      title: task.title ?? 'Texto',
      createdAt: nowIso(),
      original: text,
      corrected: a.corrected,
      issues: a.issues,
      score: a.score,
      criteria: a.criteria,
      wordCount: a.wordCount,
    });
    setSubId(id);
    setRevision(a.corrected);
  };

  return (
    <div>
      <Link to="/writing" className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft size={15} /> Writing
      </Link>
      <PageHeader eyebrow={<span className="flex items-center gap-2"><LevelBadge level={task.level ?? level} /> Tarea de escritura</span>} title={task.title ?? 'Escritura'} />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <Card>
            <p className="text-[16px] leading-relaxed text-ink">{renderInline(task.task)}</p>
            <ul className="mt-4 space-y-1.5 text-sm text-ink-soft">
              {task.requirements.map((r) => (
                <li key={r.label} className="flex gap-2">
                  <span className="text-brand">•</span> {r.label}
                </li>
              ))}
              <li className="flex gap-2">
                <span className="text-brand">•</span> Extensión: {task.minWords}–{task.maxWords} palabras
              </li>
            </ul>
          </Card>

          {!sub ? (
            <Card>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={12}
                lang="en"
                spellCheck
                placeholder="Write your text here…"
                className="input resize-y text-[16px] leading-relaxed"
                aria-label="Tu texto"
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <span className={cn('font-mono text-sm', words >= task.minWords && words <= task.maxWords ? 'text-success' : 'text-muted')}>
                  {words} / {task.minWords}–{task.maxWords} palabras
                </span>
                <Button icon={<SpellCheck size={16} />} disabled={words < 3} onClick={submit}>
                  Corregir mi texto
                </Button>
              </div>
            </Card>
          ) : (
            <>
              {analysis && <CorrectionReport analysis={analysis} original={sub.original} />}
              <Card>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold text-ink">Reescribe tu texto</h3>
                  {!showRevision && !sub.revision && (
                    <Button size="sm" variant="secondary" icon={<RefreshCw size={14} />} onClick={() => { setShowRevision(true); setRevision(sub.corrected); }}>
                      Reescribir
                    </Button>
                  )}
                </div>
                {sub.revision && revAnalysis ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted">
                      Puntuación: original <strong className="text-ink">{Math.round(sub.score * 100)}</strong> → reescrito <strong className="text-success">{Math.round(revAnalysis.score * 100)}</strong>
                    </p>
                    <div className="rounded-2xl bg-surface-2 p-4">
                      <div className="label-mono mb-2">Original → reescritura</div>
                      <TextDiff before={sub.original} after={sub.revision} />
                    </div>
                    {revAnalysis.issues.length > 0 && <Callout tone="warning" title="Aún quedan aspectos por revisar">{revAnalysis.issues.map((i) => `«${i.excerpt}»: ${i.message}`).join(' · ')}</Callout>}
                  </div>
                ) : showRevision ? (
                  <>
                    <p className="mb-2 text-sm text-muted">Partimos de la versión corregida: mejórala con tus propias palabras (añade conectores, detalles…). Tu original se conserva.</p>
                    <textarea value={revision} onChange={(e) => setRevision(e.target.value)} rows={10} lang="en" spellCheck className="input resize-y text-[16px] leading-relaxed" aria-label="Reescritura" />
                    <Button className="mt-3" onClick={() => reviseWriting(sub.id, revision, analyzeWriting(revision, task).score)} disabled={countWords(revision) < 3}>
                      Guardar y comparar
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted">Reescribir aplicando las correcciones es la mejor forma de fijarlas.</p>
                )}
              </Card>
              <Button variant="secondary" onClick={() => { setSubId(null); setText(''); setShowRevision(false); }}>
                Escribir un texto nuevo para esta tarea
              </Button>
            </>
          )}
        </div>
        <div className="space-y-4">
          {task.tips && task.tips.length > 0 && (
            <Card>
              <h3 className="mb-3 flex items-center gap-2 font-semibold text-ink">
                <Lightbulb size={17} className="text-success" /> Consejos
              </h3>
              <ul className="space-y-2 text-sm text-ink-soft">
                {task.tips.map((t) => (
                  <li key={t}>{renderInline(t)}</li>
                ))}
              </ul>
            </Card>
          )}
          {task.model && (
            <Card>
              <h3 className="mb-2 font-semibold text-ink">Texto modelo</h3>
              {showModel || sub ? (
                <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-ink-soft">{task.model}</p>
              ) : (
                <Button size="sm" variant="secondary" icon={<Eye size={14} />} onClick={() => setShowModel(true)}>
                  Ver modelo (mejor después de escribir)
                </Button>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
