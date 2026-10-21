import { z } from 'zod';
import type { FixtureResultType } from './advance.js';

/** Ordered tiebreakers stored on tournament_events.tiebreakers. Seed, then entry id, settle anything left. */
export const tiebreakerSchema = z.enum(['match_wins', 'head_to_head', 'major_diff', 'minor_diff', 'major_won', 'minor_won']);
export type Tiebreaker = z.infer<typeof tiebreakerSchema>;
export const tiebreakersSchema = z.array(tiebreakerSchema).min(1).max(6);

export const DEFAULT_TIEBREAKERS: Tiebreaker[] = ['match_wins', 'head_to_head', 'major_diff', 'minor_diff'];

/**
 * One decided group match, from the match's ScoreSummary totals. major = games/sets,
 * minor = points/games. Walkovers carry the format's walkover score; retirements the score
 * at the time of retiring.
 */
export interface GroupResult {
  entry1Id: string;
  entry2Id: string;
  /** Null only for a double walkover (both lose). */
  winnerEntryId: string | null;
  type: FixtureResultType;
  major: [number, number];
  minor: [number, number];
}

export interface StandingRow {
  entryId: string;
  rank: number;
  /**
   * The tiebreaker that last split this entry from others level with it ("head_to_head"), "seed"
   * when only the seed/id fallback did, or null when it was never level with anyone.
   */
  tiebreak: Tiebreaker | 'seed' | null;
  played: number;
  won: number;
  lost: number;
  majorWon: number;
  majorLost: number;
  minorWon: number;
  minorLost: number;
}

function tally(entryIds: readonly string[], results: readonly GroupResult[]): Map<string, StandingRow> {
  const rows = new Map(
    entryIds.map((id): [string, StandingRow] => [id, { entryId: id, rank: 0, tiebreak: null, played: 0, won: 0, lost: 0, majorWon: 0, majorLost: 0, minorWon: 0, minorLost: 0 }]),
  );
  for (const r of results) {
    const one = rows.get(r.entry1Id);
    const two = rows.get(r.entry2Id);
    if (!one || !two) continue;
    for (const [row, mine] of [
      [one, 0],
      [two, 1],
    ] as const) {
      row.played += 1;
      if (r.winnerEntryId === row.entryId) row.won += 1;
      else row.lost += 1;
      row.majorWon += r.major[mine];
      row.majorLost += r.major[1 - mine]!;
      row.minorWon += r.minor[mine];
      row.minorLost += r.minor[1 - mine]!;
    }
  }
  return rows;
}

const VALUE: Record<Exclude<Tiebreaker, 'head_to_head'>, (row: StandingRow) => number> = {
  match_wins: (r) => r.won,
  major_diff: (r) => r.majorWon - r.majorLost,
  minor_diff: (r) => r.minorWon - r.minorLost,
  major_won: (r) => r.majorWon,
  minor_won: (r) => r.minorWon,
};

/** Splits ids into buckets of equal value, best first. */
function partition(ids: string[], value: (id: string) => number): string[][] {
  const sorted = [...ids].sort((a, b) => value(b) - value(a));
  const buckets: string[][] = [];
  for (const id of sorted) {
    const last = buckets.at(-1);
    if (last && value(last[0]!) === value(id)) last.push(id);
    else buckets.push([id]);
  }
  return buckets;
}

/**
 * Ranks a group. Each tiebreaker splits the entries still level. `head_to_head` builds a
 * mini-league of only the matches between the tied entries. Whenever a step leaves a smaller
 * tie, that tie is resolved again from the first tiebreaker (BWF/ITTF practice: a 3-way tie that
 * becomes a 2-way tie is decided by the direct match). Anything still level falls back to seed,
 * then entry id.
 */
export function rankGroup(
  entryIds: readonly string[],
  results: readonly GroupResult[],
  tiebreakers: readonly Tiebreaker[] = DEFAULT_TIEBREAKERS,
  seeds: ReadonlyMap<string, number | null> = new Map(),
): StandingRow[] {
  const overall = tally(entryIds, results);
  const decidedBy = new Map<string, Tiebreaker | 'seed'>();

  const fallback = (ids: string[]) => {
    for (const id of ids) decidedBy.set(id, 'seed');
    return [...ids].sort((a, b) => (seeds.get(a) ?? Infinity) - (seeds.get(b) ?? Infinity) || a.localeCompare(b));
  };

  const resolve = (ids: string[], k: number): string[] => {
    if (ids.length <= 1) return ids;
    if (k >= tiebreakers.length) return fallback(ids);
    const tb = tiebreakers[k]!;
    if (tb === 'head_to_head') {
      const among = new Set(ids);
      const mini = tally(ids, results.filter((r) => among.has(r.entry1Id) && among.has(r.entry2Id)));
      return split(partition(ids, (id) => mini.get(id)!.won));
    }
    return split(partition(ids, (id) => VALUE[tb](overall.get(id)!)));

    function split(buckets: string[][]): string[] {
      // The first tiebreaker (usually match wins) is the ranking itself, not a tiebreak.
      if (buckets.length > 1 && k > 0) for (const id of ids) decidedBy.set(id, tb);
      return buckets.flatMap((b) => (b.length < ids.length ? resolve(b, 0) : resolve(b, k + 1)));
    }
  };

  return resolve([...entryIds], 0).map((id, i) => ({ ...overall.get(id)!, rank: i + 1, tiebreak: decidedBy.get(id) ?? null }));
}
