import { CircleCheck, CircleX } from 'lucide-react';
import type { TheoryBlock } from '../../types/content';
import { Md, renderInline } from '../ui/Markdown';
import { Callout } from '../ui/primitives';
import { SpeakButton } from '../ui/SpeakButton';
import { useAppStore } from '../../store/useAppStore';

function BlockTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-3 text-[17px] font-semibold tracking-tight text-ink">{children}</h3>;
}

export function TheoryBlockView({ block }: { block: TheoryBlock }) {
  const showEs = useAppStore((s) => s.data.settings.showSpanishSupport);
  switch (block.type) {
    case 'text':
      return (
        <section>
          {block.title && <BlockTitle>{block.title}</BlockTitle>}
          <Md text={block.body} />
        </section>
      );
    case 'rule':
      return (
        <section className="rounded-3xl border border-brand/20 bg-brand-soft/60 px-5 py-4">
          <div className="label-mono mb-1 !text-brand">Regla</div>
          <h3 className="text-[17px] font-semibold text-ink">{block.title}</h3>
          {block.formula && <div className="mt-3 rounded-2xl bg-surface px-4 py-3 font-mono text-[15px] font-semibold text-ink shadow-sm">{block.formula}</div>}
          {block.body && <Md text={block.body} className="mt-3" />}
        </section>
      );
    case 'table':
      return (
        <section>
          {block.title && <BlockTitle>{block.title}</BlockTitle>}
          <div className="overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[480px] border-collapse text-left text-[14.5px]">
              <thead>
                <tr className="bg-surface-2">
                  {block.headers.map((h) => (
                    <th key={h} className="px-4 py-2.5 font-semibold text-ink">
                      {renderInline(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, i) => (
                  <tr key={i} className="border-t border-line">
                    {row.map((cell, j) => (
                      <td key={j} className={j === 0 ? 'px-4 py-2.5 font-medium text-ink' : 'px-4 py-2.5 text-ink-soft'}>
                        {renderInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {block.caption && <p className="mt-2 text-sm text-muted">{renderInline(block.caption)}</p>}
        </section>
      );
    case 'examples':
      return (
        <section>
          {block.title && <BlockTitle>{block.title}</BlockTitle>}
          <ul className="space-y-2">
            {block.items.map((it, i) => (
              <li key={i} className="flex items-start gap-3 rounded-2xl bg-surface-2 px-4 py-3">
                <SpeakButton text={it.en.replace(/\*\*|==|`/g, '')} size="xs" className="mt-0.5" />
                <div className="min-w-0">
                  <div className="text-[16px] font-medium text-ink">{renderInline(it.en)}</div>
                  {showEs && <div className="text-[14px] text-muted">{renderInline(it.es)}</div>}
                  {it.note && <div className="mt-1 text-[13px] text-info">{renderInline(it.note)}</div>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      );
    case 'compare':
      return (
        <section>
          {block.title && <BlockTitle>{block.title}</BlockTitle>}
          <div className="space-y-2.5">
            {block.items.map((it, i) => (
              <div key={i} className="rounded-2xl border border-line bg-surface p-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="flex items-start gap-2 rounded-xl bg-danger-soft px-3 py-2">
                    <CircleX size={17} className="mt-0.5 shrink-0 text-danger" />
                    <span className="font-mono text-[14.5px] text-danger line-through decoration-danger/40">{it.wrong}</span>
                  </div>
                  <div className="flex items-start gap-2 rounded-xl bg-success-soft px-3 py-2">
                    <CircleCheck size={17} className="mt-0.5 shrink-0 text-success" />
                    <span className="font-mono text-[14.5px] text-success">{it.right}</span>
                  </div>
                </div>
                <p className="mt-2.5 text-[14.5px] text-ink-soft">{renderInline(it.why)}</p>
              </div>
            ))}
          </div>
        </section>
      );
    case 'tip':
      return <Callout tone="tip" title={block.title}>{renderInline(block.body)}</Callout>;
    case 'warning':
      return <Callout tone="warning" title={block.title}>{renderInline(block.body)}</Callout>;
    case 'exception':
      return <Callout tone="exception" title={block.title}>{renderInline(block.body)}</Callout>;
    case 'glossary':
      return (
        <section className="rounded-3xl border border-dashed border-line px-5 py-4">
          <div className="label-mono mb-2">{block.title ?? 'Términos gramaticales'}</div>
          <dl className="space-y-2">
            {block.items.map((g) => (
              <div key={g.term} className="text-[14.5px]">
                <dt className="inline font-semibold text-ink">{g.term}: </dt>
                <dd className="inline text-ink-soft">{renderInline(g.definition)}</dd>
              </div>
            ))}
          </dl>
        </section>
      );
    case 'vocab':
      return (
        <section>
          {block.title && <BlockTitle>{block.title}</BlockTitle>}
          <div className="grid gap-2 sm:grid-cols-2">
            {block.items.map((v) => (
              <div key={v.en} className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-3 py-2.5">
                <SpeakButton text={v.en} size="xs" />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-ink">{v.en}</div>
                  <div className="text-[13px] text-muted">
                    {v.es}
                    {v.ipa && <span className="ml-2 font-mono text-[11px] text-subtle">{v.ipa}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      );
    case 'dialogue':
      return (
        <section>
          {block.title && <BlockTitle>{block.title}</BlockTitle>}
          <div className="rounded-3xl bg-surface-2 p-4">
            <div className="mb-3 flex items-center gap-2">
              <SpeakButton text={block.lines.map((l) => ({ text: l.en, speaker: l.speaker }))} id={`dlg-${block.lines[0]?.en}`} size="sm" label="Escuchar diálogo" />
              <span className="text-sm text-muted">Escuchar el diálogo completo</span>
            </div>
            <div className="space-y-2">
              {block.lines.map((l, i) => (
                <div key={i} className={i % 2 ? 'flex justify-end' : 'flex'}>
                  <div className={i % 2 ? 'max-w-[85%] rounded-2xl rounded-tr-md bg-ink px-4 py-2.5 text-on-ink' : 'max-w-[85%] rounded-2xl rounded-tl-md bg-surface px-4 py-2.5 text-ink'}>
                    <div className="text-[11px] font-semibold opacity-60">{l.speaker}</div>
                    <div className="text-[15px]">{l.en}</div>
                    {showEs && <div className="text-[13px] opacity-60">{l.es}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      );
  }
}

export function TheoryBlocks({ blocks }: { blocks: TheoryBlock[] }) {
  return (
    <div className="space-y-7">
      {blocks.map((b, i) => (
        <TheoryBlockView key={i} block={b} />
      ))}
    </div>
  );
}
