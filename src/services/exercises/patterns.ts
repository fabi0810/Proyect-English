/**
 * Expansión de patrones de respuesta:
 *   {a|b}  alternativas      "I {usually|normally} walk"
 *   [x]    parte opcional    "I am 20 [years old]"
 * Se pueden anidar: "{It's|It is} [{very|really}] cold".
 */

export const MAX_VARIANTS = 2000;

export class PatternError extends Error {}

function cleanSpaces(s: string): string {
  return s
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,!?;:])/g, '$1')
    .trim();
}

export function expandPattern(pattern: string, limit = MAX_VARIANTS): string[] {
  let pos = 0;

  const combine = (left: string[], right: string[]): string[] => {
    const out: string[] = [];
    for (const l of left) for (const r of right) out.push(l + r);
    if (out.length > limit) throw new PatternError(`El patrón genera más de ${limit} variantes: ${pattern}`);
    return out;
  };

  const parseSeq = (stop: string): string[] => {
    let results = [''];
    while (pos < pattern.length) {
      const ch = pattern[pos];
      if (stop.includes(ch)) break;
      if (ch === '{') {
        pos++;
        results = combine(results, parseAlternatives());
      } else if (ch === '[') {
        pos++;
        const inner = parseSeq(']');
        if (pattern[pos] !== ']') throw new PatternError(`Falta "]" en: ${pattern}`);
        pos++;
        results = combine(results, ['', ...inner]);
      } else if (ch === '}' || ch === ']' || ch === '|') {
        throw new PatternError(`Carácter inesperado "${ch}" en la posición ${pos}: ${pattern}`);
      } else {
        const start = pos;
        while (pos < pattern.length && !'{}[]|'.includes(pattern[pos])) pos++;
        const literal = pattern.slice(start, pos);
        results = results.map((r) => r + literal);
      }
    }
    return results;
  };

  const parseAlternatives = (): string[] => {
    const all: string[] = [];
    for (;;) {
      all.push(...parseSeq('|}'));
      if (pattern[pos] === '|') {
        pos++;
        continue;
      }
      if (pattern[pos] === '}') {
        pos++;
        break;
      }
      throw new PatternError(`Falta "}" en: ${pattern}`);
    }
    return all;
  };

  const out = parseSeq('');
  if (pos !== pattern.length) throw new PatternError(`No se pudo interpretar: ${pattern}`);
  return Array.from(new Set(out.map(cleanSpaces).filter((s) => s.length > 0)));
}

/** Expande una lista de patrones. La primera variante del primer patrón es la respuesta modelo. */
export function expandAll(patterns: string[], limit = MAX_VARIANTS): string[] {
  const out: string[] = [];
  for (const p of patterns) out.push(...expandPattern(p, limit));
  return Array.from(new Set(out));
}

/** Respuesta modelo (primera variante). */
export function canonicalAnswer(patterns: string[]): string {
  if (patterns.length === 0) return '';
  try {
    return expandPattern(patterns[0])[0] ?? patterns[0];
  } catch {
    return patterns[0];
  }
}
