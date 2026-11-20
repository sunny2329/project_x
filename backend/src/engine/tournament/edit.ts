/*
 * Changing a draw that is already under way: late entries, withdrawals and removals.
 *
 * Every change edits the slot sources of the fixtures that have not been played, then `rebuild`
 * works the whole bracket out again from those sources plus the results that stand. A change that
 * would alter a played or live match is refused (TournamentError CONFLICT), so history never moves.
 */
import { TournamentError, type SlotSource } from './types.js';
import type { FixtureNode, FixtureResultType } from './advance.js';

export interface Decided {
  winnerEntryId: string | null;
  type: FixtureResultType;
}

export interface RebuildOptions {
  /** Fixtures with a result that stands, by key. */
  decided: ReadonlyMap<string, Decided>;
  /** Fixtures being played right now. Their two entries can't change. */
  live: ReadonlySet<string>;
  /** Withdrawn or disqualified entries: a bye wherever they would go next. */
  withdrawn: ReadonlySet<string>;
}

/** A knockout fixture with its place in the bracket. */
export interface BracketFixture extends FixtureNode {
  round: number;
  position: number;
  roundName: string | null;
}

export const PLAY_IN = 'Play-in';

const fixed = (key: string, o: RebuildOptions) => o.decided.has(key) || o.live.has(key);

/**
 * The state of a knockout bracket worked out from its slot sources and the results that stand.
 * Group-rank slots keep the entry already filled in (the group stage decides those).
 */
export function rebuild<T extends FixtureNode>(input: readonly T[], options: RebuildOptions): T[] {
  const byKey = new Map(input.map((n) => [n.key, n]));
  const nodes = input.map((n): T => ({ ...n, entries: [null, null], byes: [false, false], status: 'pending', winnerEntryId: null }));
  const find = new Map(nodes.map((n) => [n.key, n]));

  // A withdrawn entry still counts in matches it played (or is playing); anywhere else it is a bye.
  const put = (node: T, i: number, entryId: string | null) => {
    if (entryId !== null && options.withdrawn.has(entryId) && !fixed(node.key, options)) entryId = null;
    node.entries[i] = entryId;
    node.byes[i] = entryId === null;
  };
  const send = (link: FixtureNode['next'], entryId: string | null) => {
    if (!link) return;
    const target = find.get(link.fixtureKey);
    if (!target) throw new TournamentError('INVALID_RESULT', `Fixture ${link.fixtureKey} is missing.`);
    put(target, link.slot - 1, entryId);
  };

  for (const node of nodes) {
    node.slots.forEach((source: SlotSource, i) => {
      if (source.kind === 'entry') put(node, i, source.entryId);
      else if (source.kind === 'bye') put(node, i, null);
      else if (source.kind === 'group_rank') {
        const before = byKey.get(node.key)!;
        if (before.entries[i] !== null || before.byes[i]) put(node, i, before.entries[i] ?? null);
      }
    });
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes) {
      if (node.status !== 'pending') continue;
      const known = [0, 1].every((i) => node.entries[i] !== null || node.byes[i]);
      if (!known) continue;
      changed = true;
      const [a, b] = node.entries;
      const result = options.decided.get(node.key);
      if (result || options.live.has(node.key)) {
        if (a === null || b === null) throw conflict();
        if (!result) {
          node.status = 'live';
          continue;
        }
        node.status = 'completed';
        node.winnerEntryId = result.winnerEntryId;
        if (result.type === 'double_walkover' || result.winnerEntryId === null) {
          send(node.next, null);
          send(node.loserNext, null);
          continue;
        }
        if (result.winnerEntryId !== a && result.winnerEntryId !== b) throw conflict();
        send(node.next, result.winnerEntryId);
        send(node.loserNext, result.type === 'played' || result.type === 'retired' ? (result.winnerEntryId === a ? b : a) : null);
        continue;
      }
      if (a !== null && b !== null) {
        node.status = 'ready';
      } else {
        node.status = 'bye';
        node.winnerEntryId = a ?? b;
        send(node.next, node.winnerEntryId);
        send(node.loserNext, null);
      }
    }
  }

  // Played and live matches keep exactly the entries they had.
  for (const node of nodes) {
    if (!fixed(node.key, options)) continue;
    const before = byKey.get(node.key)!;
    if (node.status === 'pending' || node.entries[0] !== before.entries[0] || node.entries[1] !== before.entries[1]) throw conflict();
  }
  return nodes;
}

function conflict(): TournamentError {
  return new TournamentError('CONFLICT', 'That change would alter a match that has already been played or is being played.');
}

/** Lower = stronger. Seeds first by number, unseeded entries last. */
export type Strength = (entryId: string) => number;

export interface LateEntryResult {
  nodes: BracketFixture[];
  /** A play-in fixture created for the entry (its winner takes the slot it was cut from). */
  created: BracketFixture | null;
}

/**
 * Puts a late entry into a knockout bracket. It takes a free bye in the earliest round when one
 * can still be filled (the weakest bye-holder plays it); otherwise it gets a play-in match against
 * the weakest entry whose first match hasn't started, and the winner takes that entry's place.
 */
export function addLateEntry(input: readonly BracketFixture[], entryId: string, options: RebuildOptions, strength: Strength, newKey: string): LateEntryResult {
  if (input.some((n) => n.slots.some((s) => s.kind === 'entry' && s.entryId === entryId))) {
    throw new TournamentError('INVALID_CONFIG', 'This entry is already in the draw.');
  }
  const weakness = (id: string | null) => (id === null ? Infinity : strength(id));
  const open = input.filter((n) => !fixed(n.key, options));

  // 1. A bye nobody has used yet.
  const byes = open
    .flatMap((n) => n.slots.flatMap((s, i) => (s.kind === 'bye' ? [{ node: n, i }] : [])))
    .sort((x, y) => x.node.round - y.node.round || weakness(otherEntry(y.node, y.i)) - weakness(otherEntry(x.node, x.i)) || y.node.position - x.node.position);
  for (const { node, i } of byes) {
    const nodes = withSlot(input, node.key, i, { kind: 'entry', entryId });
    const result = attempt(nodes, options);
    if (result) return { nodes: result, created: null };
  }

  // 2. A play-in against the weakest entry still waiting for its first match.
  const slots = open
    .flatMap((n) => n.slots.flatMap((s, i) => (s.kind === 'entry' && !options.withdrawn.has(s.entryId) ? [{ node: n, i, opponent: s.entryId }] : [])))
    // Main-draw lines before play-ins (a play-in of a play-in only when nothing else is left).
    .sort((x, y) => playIn(x.node) - playIn(y.node) || x.node.round - y.node.round || weakness(y.opponent) - weakness(x.opponent) || y.node.position - x.node.position);
  for (const { node, i, opponent } of slots) {
    const round = node.round - 1;
    const position = Math.max(0, ...input.filter((n) => n.round === round).map((n) => n.position)) + 1;
    const playIn: BracketFixture = {
      key: newKey,
      round,
      position,
      roundName: PLAY_IN,
      slots: [
        { kind: 'entry', entryId: opponent },
        { kind: 'entry', entryId },
      ],
      entries: [null, null],
      byes: [false, false],
      status: 'pending',
      winnerEntryId: null,
      next: { fixtureKey: node.key, slot: (i + 1) as 1 | 2 },
      loserNext: null,
    };
    const nodes = [...withSlot(input, node.key, i, { kind: 'winner', fixtureKey: newKey }), playIn];
    const result = attempt(nodes, options);
    if (result) return { nodes: result, created: result.find((n) => n.key === newKey)! };
  }
  throw new TournamentError('NOT_READY', 'Every first-round match has started, so there is no place left for a new entry.');
}

const playIn = (node: BracketFixture) => (node.roundName === PLAY_IN ? 1 : 0);

function otherEntry(node: BracketFixture, i: number): string | null {
  const other = node.slots[1 - i]!;
  return other.kind === 'entry' ? other.entryId : null;
}

function withSlot(input: readonly BracketFixture[], key: string, i: number, source: SlotSource): BracketFixture[] {
  return input.map((n) => {
    if (n.key !== key) return n;
    const slots: [SlotSource, SlotSource] = [...n.slots];
    slots[i] = source;
    return { ...n, slots };
  });
}

function attempt(nodes: BracketFixture[], options: RebuildOptions): BracketFixture[] | null {
  try {
    return rebuild(nodes, options);
  } catch (error) {
    if (error instanceof TournamentError && error.code === 'CONFLICT') return null;
    throw error;
  }
}

export interface RemovalResult {
  nodes: BracketFixture[];
  /** Play-in fixtures that are no longer needed. */
  removed: string[];
}

/**
 * Takes an entry out of a knockout bracket. Its unplayed play-in disappears (the other entry gets
 * the slot back); its first-round line becomes a bye; wherever it has already got to, the opponent
 * moves on. Pass the entry in `options.withdrawn`.
 */
export function removeFromBracket(input: readonly BracketFixture[], entryId: string, options: RebuildOptions): RemovalResult {
  let nodes = [...input];
  const removed: string[] = [];
  for (const node of input) {
    if (fixed(node.key, options)) continue;
    const i = node.slots.findIndex((s) => s.kind === 'entry' && s.entryId === entryId);
    if (i < 0) continue;
    const target = node.roundName === PLAY_IN && node.next ? nodes.find((n) => n.key === node.next!.fixtureKey) : undefined;
    const back = target?.slots[node.next!.slot - 1];
    if (target && back?.kind === 'winner' && back.fixtureKey === node.key && !fixed(target.key, options)) {
      nodes = withSlot(nodes, target.key, node.next!.slot - 1, node.slots[1 - i]!).filter((n) => n.key !== node.key);
      removed.push(node.key);
    } else {
      nodes = withSlot(nodes, node.key, i, { kind: 'bye' });
    }
  }
  return { nodes: rebuild(nodes, options), removed };
}

export interface GroupFixtureSlot {
  round: number;
  position: number;
  entries: [string | null, string | null];
  /** Played, being played, or otherwise settled. */
  done: boolean;
}

export interface NewGroupFixture {
  round: number;
  position: number;
  entries: [string, string];
}

/**
 * Fixtures for a late entry in a round-robin group: one against every member (twice with two
 * legs, home and away swapped). Each goes in the earliest round from the first unfinished one
 * where neither side already plays; new rounds are added at the end when needed.
 */
export function groupFixturesFor(existing: readonly GroupFixtureSlot[], members: readonly string[], entryId: string, legs: number): NewGroupFixture[] {
  if (members.includes(entryId)) throw new TournamentError('INVALID_CONFIG', 'This entry is already in the group.');
  const busy = new Map<number, Set<string>>();
  const positions = new Map<number, number>();
  for (const f of existing) {
    const set = busy.get(f.round) ?? new Set<string>();
    for (const e of f.entries) if (e) set.add(e);
    busy.set(f.round, set);
    positions.set(f.round, Math.max(positions.get(f.round) ?? 0, f.position));
  }
  const last = Math.max(0, ...existing.map((f) => f.round));
  const unfinished = existing.filter((f) => !f.done).map((f) => f.round);
  const start = unfinished.length ? Math.min(...unfinished) : last + 1;

  const out: NewGroupFixture[] = [];
  for (let leg = 0; leg < legs; leg += 1) {
    for (const opponent of members) {
      let round = start;
      while (busy.get(round)?.has(opponent) || busy.get(round)?.has(entryId)) round += 1;
      const set = busy.get(round) ?? new Set<string>();
      set.add(opponent).add(entryId);
      busy.set(round, set);
      const position = (positions.get(round) ?? 0) + 1;
      positions.set(round, position);
      out.push({ round, position, entries: leg % 2 === 0 ? [opponent, entryId] : [entryId, opponent] });
    }
  }
  return out;
}
