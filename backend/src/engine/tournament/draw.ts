import type { EntryInput } from './types.js';

/** Deterministic PRNG (mulberry32) so a draw can be reproduced from its seed. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Seeds first (1, 2, 3 ...), then the unseeded entries in random order. */
export function seedOrder(entries: readonly EntryInput[], random: () => number): EntryInput[] {
  const seeded = entries.filter((e) => e.seed !== null).sort((a, b) => a.seed! - b.seed!);
  return [...seeded, ...shuffle(entries.filter((e) => e.seed === null), random)];
}

export function nextPowerOfTwo(n: number): number {
  let size = 1;
  while (size < n) size *= 2;
  return size;
}

/**
 * Standard bracket order of seed numbers for a draw of `size` lines: 1 v 16, 8 v 9, 5 v 12 ...
 * so seeds 1 and 2 can only meet in the final. [1, 8, 4, 5, 2, 7, 3, 6] for 8.
 */
export function bracketOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const m = order.length * 2;
    order = order.flatMap((s) => [s, m + 1 - s]);
  }
  return order;
}

/** Snake seeding into groups: A1 B1 C1 C2 B2 A2 A3 ... Returns entry lists per group. */
export function snakeGroups<T>(ordered: readonly T[], groupCount: number): T[][] {
  const groups: T[][] = Array.from({ length: groupCount }, () => []);
  ordered.forEach((item, i) => {
    const row = Math.floor(i / groupCount);
    const col = row % 2 === 0 ? i % groupCount : groupCount - 1 - (i % groupCount);
    groups[col]!.push(item);
  });
  return groups;
}

/** Round-robin rounds by the circle method; null pairs are skipped (that entry rests). */
export function circleRounds<T>(items: readonly T[]): Array<Array<[T, T]>> {
  const list: Array<T | null> = [...items];
  if (list.length % 2 === 1) list.push(null);
  const n = list.length;
  const rounds: Array<Array<[T, T]>> = [];
  for (let r = 0; r < n - 1; r += 1) {
    const pairs: Array<[T, T]> = [];
    for (let i = 0; i < n / 2; i += 1) {
      const a = list[i];
      const b = list[n - 1 - i];
      if (a !== null && a !== undefined && b !== null && b !== undefined) pairs.push(r % 2 === 0 || i > 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    // Keep the first fixed, rotate the rest clockwise.
    list.splice(1, 0, list.pop()!);
  }
  return rounds;
}

export function roundName(round: number, totalRounds: number): string {
  const left = totalRounds - round;
  if (left === 0) return 'Final';
  if (left === 1) return 'Semi-final';
  if (left === 2) return 'Quarter-final';
  return `Round of ${2 ** (left + 1)}`;
}

export function groupName(index: number): string {
  return `Group ${String.fromCharCode(65 + index)}`;
}
