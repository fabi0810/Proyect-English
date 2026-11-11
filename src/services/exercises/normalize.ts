/**
 * Normalización de respuestas de texto.
 * - Minúsculas, apóstrofos y guiones unificados, sin signos de puntuación.
 * - Contracciones inglesas expandidas a forma canónica; las ambiguas generan variantes.
 * - Comparación opcional sin tildes (respuestas en español).
 */

const CONTRACTIONS: Record<string, string[]> = {
  "i'm": ['i am'],
  "you're": ['you are'],
  "we're": ['we are'],
  "they're": ['they are'],
  "he's": ['he is', 'he has'],
  "she's": ['she is', 'she has'],
  "it's": ['it is', 'it has'],
  "that's": ['that is', 'that has'],
  "there's": ['there is', 'there has'],
  "here's": ['here is'],
  "what's": ['what is', 'what has', 'what does'],
  "where's": ['where is', 'where has'],
  "who's": ['who is', 'who has'],
  "how's": ['how is', 'how has'],
  "when's": ['when is'],
  "why's": ['why is'],
  "isn't": ['is not'],
  "aren't": ['are not'],
  "wasn't": ['was not'],
  "weren't": ['were not'],
  "don't": ['do not'],
  "doesn't": ['does not'],
  "didn't": ['did not'],
  "haven't": ['have not'],
  "hasn't": ['has not'],
  "hadn't": ['had not'],
  "won't": ['will not'],
  "wouldn't": ['would not'],
  "can't": ['cannot'],
  "couldn't": ['could not'],
  "shouldn't": ['should not'],
  "mustn't": ['must not'],
  "needn't": ['need not'],
  "mightn't": ['might not'],
  "shan't": ['shall not'],
  "i've": ['i have'],
  "you've": ['you have'],
  "we've": ['we have'],
  "they've": ['they have'],
  "could've": ['could have'],
  "should've": ['should have'],
  "would've": ['would have'],
  "might've": ['might have'],
  "must've": ['must have'],
  "i'll": ['i will'],
  "you'll": ['you will'],
  "he'll": ['he will'],
  "she'll": ['she will'],
  "it'll": ['it will'],
  "we'll": ['we will'],
  "they'll": ['they will'],
  "that'll": ['that will'],
  "there'll": ['there will'],
  "i'd": ['i would', 'i had'],
  "you'd": ['you would', 'you had'],
  "he'd": ['he would', 'he had'],
  "she'd": ['she would', 'she had'],
  "we'd": ['we would', 'we had'],
  "they'd": ['they would', 'they had'],
  "it'd": ['it would', 'it had'],
  "let's": ['let us'],
};

const MAX_TEXT_VARIANTS = 64;

export function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '');
}

/** Normalización básica (sin expandir contracciones). */
export function basicNormalize(s: string): string {
  return s
    .normalize('NFC')
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[“”«»]/g, '"')
    .replace(/[‐‑‒–—―-]/g, ' ')
    .replace(/[.,!?;:¡¿"()[\]{}…/\\*_]/g, ' ')
    .replace(/(^|\s)'+|'+(\s|$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b([ap]) m\b/g, '$1m');
}

/** Variantes normalizadas de un texto (por contracciones ambiguas). */
export function normalizedVariants(s: string, opts: { accents?: boolean } = {}): string[] {
  let base = basicNormalize(s);
  if (!opts.accents) base = stripAccents(base);
  const tokens = base.split(' ').filter(Boolean);
  let variants: string[] = [''];
  for (const tok of tokens) {
    const exp = CONTRACTIONS[tok] ?? [tok];
    const next: string[] = [];
    for (const v of variants) for (const e of exp) next.push(v ? `${v} ${e}` : e);
    variants = next.length > MAX_TEXT_VARIANTS ? next.slice(0, MAX_TEXT_VARIANTS) : next;
  }
  return Array.from(new Set(variants.map((v) => v.replace(/\bcan not\b/g, 'cannot'))));
}

/** Forma normalizada principal (primera variante). */
export function normalize(s: string, opts: { accents?: boolean } = {}): string {
  return normalizedVariants(s, opts)[0] ?? '';
}

/** ¿Coinciden dos textos tras normalizar (alguna variante en común)? */
export function textsMatch(a: string, b: string, opts: { accents?: boolean } = {}): boolean {
  const va = new Set(normalizedVariants(a, opts));
  return normalizedVariants(b, opts).some((v) => va.has(v));
}

/** Conjunto de todas las variantes normalizadas de una lista de respuestas ya expandidas. */
export function buildAnswerSet(answers: string[], opts: { accents?: boolean } = {}): Map<string, string> {
  const map = new Map<string, string>();
  for (const a of answers) for (const v of normalizedVariants(a, opts)) if (!map.has(v)) map.set(v, a);
  return map;
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Distancia de edición por palabras. */
export function wordDistance(a: string[], b: string[]): number {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

export type WordDiffOp = { op: 'ok' | 'missing' | 'extra' | 'wrong'; given?: string; expected?: string };

/** Alineación palabra a palabra (para mostrar qué falta, sobra o cambia). */
export function diffWords(given: string[], expected: string[]): WordDiffOp[] {
  const n = given.length;
  const m = expected.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (given[i - 1] === expected[j - 1] ? 0 : 1));
  const ops: WordDiffOp[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && given[i - 1] === expected[j - 1] && dp[i][j] === dp[i - 1][j - 1]) {
      ops.push({ op: 'ok', given: given[i - 1], expected: expected[j - 1] });
      i--;
      j--;
    } else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
      ops.push({ op: 'wrong', given: given[i - 1], expected: expected[j - 1] });
      i--;
      j--;
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      ops.push({ op: 'extra', given: given[i - 1] });
      i--;
    } else {
      ops.push({ op: 'missing', expected: expected[j - 1] });
      j--;
    }
  }
  return ops.reverse();
}

/** Palabras originales (con mayúsculas) para mostrar en diferencias. */
export function displayWords(s: string): string[] {
  return s
    .replace(/[“”«»"]/g, '')
    .split(/\s+/)
    .map((w) => w.replace(/^[¿¡(]+|[.,!?;:)]+$/g, ''))
    .filter(Boolean);
}
