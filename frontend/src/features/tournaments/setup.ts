/*
 * Design v2 "Create tournament" / "Multi-sport categories" wording and defaults (tested in setup.test.ts).
 */
import type { DrawFormat } from './types';

export interface FormatLike {
  code: string;
  name: string;
  playersPerSide: number;
}

/** The categories offered for a sport: "Men's Singles", "Mixed Doubles", ... with the format each uses. */
export function categoryOptions(formats: FormatLike[]): { name: string; format: string }[] {
  const out: { name: string; format: string }[] = [];
  for (const f of formats) {
    if (f.code === 'singles') out.push(...["Men's Singles", "Women's Singles", 'Open Singles'].map((name) => ({ name, format: f.code })));
    else if (f.code === 'doubles') out.push(...["Men's Doubles", "Women's Doubles", 'Mixed Doubles', 'Open Doubles'].map((name) => ({ name, format: f.code })));
    else out.push({ name: f.code === 'team' ? 'Open' : `Open ${f.name}`, format: f.code });
  }
  return out;
}

/** Groups for a groups → knockout draw: about four per group, at least two groups. */
export function groupCountFor(entries: number): number {
  return Math.max(2, Math.round(entries / 4));
}

/** Under the Entries stepper: "16-draw · 3 byes · 12 matches", "78 matches · each plays 12", "4 groups · top 2 advance". */
export function drawInfo(format: DrawFormat, entries: number, qualifiers = 2): string {
  const n = Math.max(0, Math.floor(entries));
  if (n < 2) return 'Add at least 2 entries';
  if (format === 'knockout') {
    let size = 2;
    while (size < n) size *= 2;
    const byes = size - n;
    return `${size}-draw · ${byes ? `${byes} ${byes === 1 ? 'bye' : 'byes'} · ` : ''}${n - 1} ${n === 2 ? 'match' : 'matches'}`;
  }
  if (format === 'round_robin') return `${(n * (n - 1)) / 2} matches · each plays ${n - 1}`;
  const groups = groupCountFor(n);
  const base = Math.floor(n / groups);
  const extra = n % groups;
  const groupMatches = extra * (((base + 1) * base) / 2) + (groups - extra) * ((base * (base - 1)) / 2);
  const ko = groups * qualifiers - 1;
  return `${groups} groups · top ${qualifiers} advance · ${groupMatches + ko} matches`;
}

const DRAW_SHORT: Record<DrawFormat, string> = { knockout: 'Knockout', round_robin: 'Round robin', groups_knockout: 'Groups → KO' };

/** A category row: "Knockout · 16 entries · Best of 3" (pairs for doubles). */
export function categoryMeta(c: { drawFormat: DrawFormat; maxEntries: number | null; playersPerSide: number; rules?: string | null }): string {
  const who = c.playersPerSide === 2 ? 'pairs' : c.playersPerSide > 2 ? 'teams' : 'entries';
  return [DRAW_SHORT[c.drawFormat], c.maxEntries ? `${c.maxEntries} ${who}` : null, c.rules ?? null].filter(Boolean).join(' · ');
}

/** "4 sports · 5 categories" under a multi-sport tournament name. */
export function multiSummary(categories: { sport: string }[]): string {
  const sports = new Set(categories.map((c) => c.sport)).size;
  if (!categories.length) return 'No categories yet';
  return `${sports} ${sports === 1 ? 'sport' : 'sports'} · ${categories.length} ${categories.length === 1 ? 'category' : 'categories'}`;
}
