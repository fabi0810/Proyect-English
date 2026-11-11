import { Fragment, type ReactNode } from 'react';
import { cn } from '../../utils/cn';

/**
 * Markdown ligero y seguro (sin HTML): **negrita**, *cursiva*, `código`, ==resaltado==,
 * listas con "- " y párrafos separados por línea en blanco.
 */
const INLINE = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|==[^=]+==)/g;

export function renderInline(text: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    if (!part) return null;
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} className="font-semibold text-ink">{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`'))
      return (
        <code key={i} className="rounded-md bg-brand-soft px-1.5 py-0.5 font-mono text-[0.88em] text-brand">
          {part.slice(1, -1)}
        </code>
      );
    if (part.startsWith('==') && part.endsWith('==')) return <mark key={i} className="rounded bg-highlight px-1 text-ink">{part.slice(2, -2)}</mark>;
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <em key={i}>{part.slice(1, -1)}</em>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export function Md({ text, className }: { text: string; className?: string }) {
  const blocks = text.split(/\n\s*\n/);
  return (
    <div className={cn('prose-lesson text-[15px] leading-relaxed text-ink-soft', className)}>
      {blocks.map((block, bi) => {
        const lines = block.split('\n');
        if (lines.every((l) => /^\s*[-•]\s+/.test(l)))
          return (
            <ul key={bi} className="my-2 list-disc space-y-1 pl-5 marker:text-brand">
              {lines.map((l, li) => (
                <li key={li}>{renderInline(l.replace(/^\s*[-•]\s+/, ''))}</li>
              ))}
            </ul>
          );
        return (
          <p key={bi}>
            {lines.map((l, li) => (
              <Fragment key={li}>
                {li > 0 && <br />}
                {renderInline(l)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
