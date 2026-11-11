/**
 * Ensamblado aleatorio de exámenes a partir de un banco de ejercicios.
 * Prioriza ítems "frescos" (no usados en intentos anteriores), reparte por lección/bloque,
 * equilibra dificultad, limita la repetición de un mismo tipo y evita ítems del mismo grupo.
 */
import type { Exercise } from '../../types/content';
import { createRng, shuffle } from '../../utils/random';

export interface AssembleOptions {
  size: number;
  seed: number;
  /** 0 = nunca usado … 3 = usado en el último intento */
  priority?: (ex: Exercise) => number;
  bucketOf?: (ex: Exercise) => string;
  maxTypeShare?: number;
  difficultyMix?: [number, number, number];
  minPerBucket?: number;
  /** Ordenar por dificultad ascendente (por defecto sí). */
  sortByDifficulty?: boolean;
}

interface Candidate {
  ex: Exercise;
  pr: number;
  r: number;
  bucket: string;
}

export function computeQuotas(sizes: Map<string, number>, total: number, minPer: number): Map<string, number> {
  const keys = Array.from(sizes.keys());
  const quotas = new Map<string, number>();
  if (keys.length === 0) return quotas;
  const cap = Array.from(sizes.values()).reduce((s, v) => s + v, 0);
  const target = Math.min(total, cap);
  const min = keys.length * minPer <= target ? minPer : Math.floor(target / keys.length);
  let assigned = 0;
  for (const k of keys) {
    const q = Math.min(sizes.get(k) ?? 0, min);
    quotas.set(k, q);
    assigned += q;
  }
  const remaining = target - assigned;
  if (remaining <= 0) return quotas;
  const spare = new Map(keys.map((k) => [k, (sizes.get(k) ?? 0) - (quotas.get(k) ?? 0)]));
  const spareTotal = Array.from(spare.values()).reduce((s, v) => s + v, 0);
  const shares = keys.map((k) => {
    const exact = spareTotal ? (remaining * (spare.get(k) ?? 0)) / spareTotal : 0;
    return { k, floor: Math.floor(exact), frac: exact - Math.floor(exact) };
  });
  let left = remaining;
  for (const s of shares) {
    const add = Math.min(s.floor, spare.get(s.k) ?? 0);
    quotas.set(s.k, (quotas.get(s.k) ?? 0) + add);
    left -= add;
  }
  shares.sort((a, b) => b.frac - a.frac);
  for (const s of shares) {
    if (left <= 0) break;
    if ((quotas.get(s.k) ?? 0) < (sizes.get(s.k) ?? 0)) {
      quotas.set(s.k, (quotas.get(s.k) ?? 0) + 1);
      left--;
    }
  }
  return quotas;
}

export function assemble(pool: Exercise[], opts: AssembleOptions): Exercise[] {
  const rng = createRng(opts.seed);
  const bucketOf = opts.bucketOf ?? ((ex: Exercise) => ex.lesson ?? ex.module ?? 'all');
  const priority = opts.priority ?? (() => 0);
  const mix = opts.difficultyMix ?? [0.3, 0.45, 0.25];
  const maxTypeShare = opts.maxTypeShare ?? 0.4;

  const candidates: Candidate[] = shuffle(pool, rng).map((ex, r) => ({ ex, pr: priority(ex), r, bucket: bucketOf(ex) }));
  const distinct = new Set(candidates.map((c) => c.ex.group ?? c.ex.id)).size;
  const size = Math.min(opts.size, distinct);
  const typeCap = Math.max(2, Math.ceil(size * maxTypeShare));

  const sizes = new Map<string, number>();
  for (const c of candidates) sizes.set(c.bucket, (sizes.get(c.bucket) ?? 0) + 1);
  const quotas = computeQuotas(sizes, size, opts.minPerBucket ?? 2);

  const selected: Candidate[] = [];
  const chosenIds = new Set<string>();
  const usedGroups = new Set<string>();
  const typeCount = new Map<string, number>();
  const bucketCount = new Map<string, number>();
  const diffCount = [0, 0, 0];

  const canTake = (c: Candidate, respectTypeCap: boolean) =>
    !chosenIds.has(c.ex.id) &&
    !(c.ex.group && usedGroups.has(c.ex.group)) &&
    (!respectTypeCap || (typeCount.get(c.ex.type) ?? 0) < typeCap);

  const take = (c: Candidate) => {
    selected.push(c);
    chosenIds.add(c.ex.id);
    if (c.ex.group) usedGroups.add(c.ex.group);
    typeCount.set(c.ex.type, (typeCount.get(c.ex.type) ?? 0) + 1);
    bucketCount.set(c.bucket, (bucketCount.get(c.bucket) ?? 0) + 1);
    diffCount[(c.ex.difficulty ?? 2) - 1]++;
  };

  const diffPenalty = (c: Candidate) => {
    const d = (c.ex.difficulty ?? 2) - 1;
    return diffCount[d] + 1 > mix[d] * size + 0.5 ? 1 : 0;
  };
  const bucketRatio = (c: Candidate) => (bucketCount.get(c.bucket) ?? 0) / Math.max(1, quotas.get(c.bucket) ?? 1);

  const maxTier = candidates.reduce((m, c) => Math.max(m, c.pr), 0);
  for (let tier = 0; tier <= maxTier && selected.length < size; tier++) {
    const tierItems = candidates.filter((c) => c.pr === tier);
    for (const [bucket, quota] of quotas) {
      while ((bucketCount.get(bucket) ?? 0) < quota && selected.length < size) {
        const cands = tierItems.filter((c) => c.bucket === bucket && canTake(c, true));
        if (cands.length === 0) break;
        cands.sort((a, b) => diffPenalty(a) - diffPenalty(b) || a.r - b.r);
        take(cands[0]);
      }
    }
    while (selected.length < size) {
      const cands = tierItems.filter((c) => canTake(c, true));
      if (cands.length === 0) break;
      cands.sort((a, b) => bucketRatio(a) - bucketRatio(b) || diffPenalty(a) - diffPenalty(b) || a.r - b.r);
      take(cands[0]);
    }
  }
  if (selected.length < size) {
    const rest = candidates.filter((c) => canTake(c, false)).sort((a, b) => a.pr - b.pr || a.r - b.r);
    for (const c of rest) {
      if (selected.length >= size) break;
      if (canTake(c, false)) take(c);
    }
  }

  const isGroup = (e: Exercise) => e.type === 'reading_comprehension' || e.type === 'listening_comprehension';
  const ordered =
    opts.sortByDifficulty === false
      ? selected
      : selected.slice().sort((a, b) => Number(isGroup(a.ex)) - Number(isGroup(b.ex)) || a.ex.difficulty - b.ex.difficulty || a.r - b.r);
  return ordered.map((c) => c.ex);
}
