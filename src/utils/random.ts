/** PRNG determinista (mulberry32): mismos exámenes para la misma semilla. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

/** Barajado Fisher–Yates (devuelve una copia). */
export function shuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Permutación de índices 0..n-1. */
export function permutation(n: number, rng: () => number = Math.random): number[] {
  return shuffle(
    Array.from({ length: n }, (_, i) => i),
    rng,
  );
}

/** Permutación que no deja todos los elementos en su sitio (para "ordenar palabras"). */
export function derangedPermutation(n: number, rng: () => number = Math.random): number[] {
  if (n < 2) return permutation(n, rng);
  for (let tries = 0; tries < 20; tries++) {
    const p = permutation(n, rng);
    if (p.some((v, i) => v !== i)) return p;
  }
  return Array.from({ length: n }, (_, i) => (i + 1) % n);
}

export function pickOne<T>(items: readonly T[], rng: () => number = Math.random): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.floor(rng() * items.length)];
}

/** Hash FNV-1a de 32 bits (semillas estables a partir de ids). */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
