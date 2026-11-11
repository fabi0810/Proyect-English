import type { ReactNode } from 'react';
import { CircleCheck, CircleX } from 'lucide-react';
import type { WritingAnalysis } from '../../services/writing/analyze';
import type { WritingIssue } from '../../types/progress';
import { diffWords, displayWords } from '../../services/exercises/normalize';
import { errorCatalog } from '../../services/content/catalog';
import { cn } from '../../utils/cn';
import { ProgressBar } from '../ui/primitives';

export function HighlightedText({ text, issues }: { text: string; issues: WritingIssue[] }) {
  const parts: ReactNode[] = [];
  let pos = 0;
  issues.forEach((i, k) => {
    if (i.start > pos) parts.push(<span key={`t${k}`}>{text.slice(pos, i.start)}</span>);
    parts.push(
      <mark
        key={`m${k}`}
        title={i.message}
        className={cn('rounded px-0.5', i.severity === 'error' ? 'bg-danger-soft text-danger underline decoration-wavy decoration-1' : i.severity === 'warning' ? 'bg-warning-soft text-warning' : 'bg-info-soft text-info')}
      >
        {text.slice(i.start, i.end) || '·'}
        <sup className="ml-0.5 font-mono text-[10px]">{k + 1}</sup>
      </mark>,
    );
    pos = Math.max(pos, i.end);
  });
  if (pos < text.length) parts.push(<span key="end">{text.slice(pos)}</span>);
  return <div className="text-[15.5px] leading-relaxed whitespace-pre-wrap text-ink">{parts}</div>;
}

export function TextDiff({ before, after }: { before: string; after: string }) {
  const ops = diffWords(displayWords(before), displayWords(after));
  return (
    <div className="flex flex-wrap gap-x-1 gap-y-0.5 text-[15px] leading-relaxed">
      {ops.map((o, i) =>
        o.op === 'ok' ? (
          <span key={i} className="text-ink-soft">{o.given}</span>
        ) : o.op === 'wrong' ? (
          <span key={i}>
            <span className="text-danger line-through">{o.given}</span> <span className="rounded bg-success-soft px-1 text-success">{o.expected}</span>
          </span>
        ) : o.op === 'extra' ? (
          <span key={i} className="text-danger line-through">{o.given}</span>
        ) : (
          <span key={i} className="rounded bg-success-soft px-1 text-success">{o.expected}</span>
        ),
      )}
    </div>
  );
}

const CRITERIA: { key: keyof WritingAnalysis['criteria']; label: string; weight: string }[] = [
  { key: 'task', label: 'Cumplimiento de la tarea', weight: '40 %' },
  { key: 'accuracy', label: 'Corrección gramatical', weight: '30 %' },
  { key: 'organization', label: 'Organización', weight: '15 %' },
  { key: 'length', label: 'Extensión', weight: '15 %' },
];

export function CorrectionReport({ analysis, original }: { analysis: WritingAnalysis; original: string }) {
  const pct = Math.round(analysis.score * 100);
  return (
    <div className="space-y-5">
      <div className="grid gap-5 md:grid-cols-[200px_1fr]">
        <div className="flex flex-col items-center justify-center rounded-3xl bg-surface-2 p-5 text-center">
          <div className={cn('font-mono text-5xl font-bold', pct >= 85 ? 'text-success' : pct >= 60 ? 'text-warning' : 'text-danger')}>{pct}</div>
          <div className="label-mono mt-1">Puntuación estimada</div>
          <div className="mt-3 text-xs text-muted">
            {analysis.wordCount} palabras · {analysis.sentenceCount} oraciones
          </div>
        </div>
        <div className="space-y-3">
          {CRITERIA.map((c) => (
            <div key={c.key}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="font-medium text-ink">
                  {c.label} <span className="text-muted">· {c.weight}</span>
                </span>
                <span className="font-mono text-xs text-muted">{Math.round(analysis.criteria[c.key] * 100)} %</span>
              </div>
              <ProgressBar value={analysis.criteria[c.key]} size="sm" barClassName={analysis.criteria[c.key] >= 0.8 ? 'bg-success' : analysis.criteria[c.key] >= 0.5 ? 'bg-warning' : 'bg-danger'} />
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-line p-4">
          <div className="label-mono mb-2">Requisitos de la tarea</div>
          <ul className="space-y-1.5 text-sm">
            {[...analysis.requirements, ...analysis.structures].map((r) => (
              <li key={r.label} className="flex items-start gap-2">
                {r.met ? <CircleCheck size={16} className="mt-0.5 shrink-0 text-success" /> : <CircleX size={16} className="mt-0.5 shrink-0 text-danger" />}
                <span className={r.met ? 'text-ink-soft' : 'text-ink'}>
                  {r.label}
                  {!r.met && r.feedback && <span className="block text-xs text-muted">{r.feedback}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-3xl border border-line p-4">
          <div className="label-mono mb-2">Conectores usados</div>
          {analysis.connectors.length ? (
            <div className="flex flex-wrap gap-1.5">
              {analysis.connectors.map((c) => (
                <span key={c} className="rounded-full bg-success-soft px-2.5 py-1 font-mono text-xs text-success">
                  {c}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">No se detectaron conectores. Une tus ideas con and, but, because, so…</p>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-line p-4">
        <div className="label-mono mb-3">Tu texto (original)</div>
        <HighlightedText text={original} issues={analysis.issues} />
      </div>

      {analysis.issues.length > 0 ? (
        <div className="rounded-3xl border border-line p-4">
          <div className="label-mono mb-3">Correcciones ({analysis.issues.length})</div>
          <ol className="space-y-3">
            {analysis.issues.map((i, k) => (
              <li key={k} className="flex gap-3 text-[14.5px]">
                <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold text-white', i.severity === 'error' ? 'bg-danger' : i.severity === 'warning' ? 'bg-warning' : 'bg-info')}>{k + 1}</span>
                <div>
                  <div>
                    <span className="font-mono text-danger">{i.excerpt}</span>
                    {i.suggestion !== undefined && i.suggestion !== '' && (
                      <>
                        {' '}→ <span className="font-mono text-success">{i.suggestion}</span>
                      </>
                    )}
                    {errorCatalog[i.ruleId] && <span className="ml-2 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted">{errorCatalog[i.ruleId].title}</span>}
                  </div>
                  <div className="text-ink-soft">{i.message}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <div className="rounded-3xl bg-success-soft px-4 py-3 text-sm text-ink">El corrector no encontró errores frecuentes. Revisa igualmente el vocabulario y el sentido.</div>
      )}

      {analysis.corrected !== original && (
        <div className="rounded-3xl border border-line p-4">
          <div className="label-mono mb-3">Versión corregida automáticamente (cambios resaltados)</div>
          <TextDiff before={original} after={analysis.corrected} />
        </div>
      )}
      <p className="text-xs text-muted">
        La corrección automática se basa en reglas para errores frecuentes de hispanohablantes: es una ayuda, no una corrección humana completa. Puede no detectar algunos errores de vocabulario o de sentido.
      </p>
    </div>
  );
}
