import { TournamentError, type DrawPlan, type Link, type SlotSource } from './types.js';

export type FixtureResultType = 'played' | 'walkover' | 'no_show' | 'retired' | 'double_walkover';
export type FixtureNodeStatus = 'pending' | 'ready' | 'live' | 'completed' | 'bye' | 'cancelled';

/** The live state of one fixture slot pair, as stored in the fixtures table. */
export interface FixtureNode {
  key: string;
  slots: [SlotSource, SlotSource];
  entries: [string | null, string | null];
  /** True when no entry will ever come to this slot (a bye, or a double walkover upstream). */
  byes: [boolean, boolean];
  status: FixtureNodeStatus;
  winnerEntryId: string | null;
  next: Link | null;
  loserNext: Link | null;
}

export interface FixtureOutcome {
  type: FixtureResultType;
  /** Required unless double_walkover. For retired: the side that did NOT retire. */
  winnerEntryId: string | null;
}

/** Fixture states for a fresh draw, with byes already advanced. */
export function initialNodes(plan: DrawPlan): FixtureNode[] {
  const nodes = plan.stages.flatMap((stage) =>
    stage.fixtures.map(
      (f): FixtureNode => ({
        key: f.key,
        slots: f.slots,
        entries: [f.slots[0].kind === 'entry' ? f.slots[0].entryId : null, f.slots[1].kind === 'entry' ? f.slots[1].entryId : null],
        byes: [f.slots[0].kind === 'bye', f.slots[1].kind === 'bye'],
        status: 'pending',
        winnerEntryId: null,
        next: f.next,
        loserNext: f.loserNext,
      }),
    ),
  );
  return settle(nodes);
}

function clone(nodes: readonly FixtureNode[]): FixtureNode[] {
  return nodes.map((n) => ({ ...n, entries: [...n.entries], byes: [...n.byes] }));
}

function place(nodes: FixtureNode[], link: Link | null, entryId: string | null): void {
  if (!link) return;
  const target = nodes.find((n) => n.key === link.fixtureKey);
  if (!target) throw new TournamentError('INVALID_RESULT', `Fixture ${link.fixtureKey} is missing.`);
  if (entryId === null) target.byes[link.slot - 1] = true;
  else target.entries[link.slot - 1] = entryId;
}

/** Marks fixtures ready once both entries are known, and auto-advances byes. */
export function settle(input: readonly FixtureNode[]): FixtureNode[] {
  const nodes = clone(input);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes) {
      if (node.status !== 'pending') continue;
      const known = [0, 1].map((i) => node.entries[i] !== null || node.byes[i]);
      if (!known[0] || !known[1]) continue;
      const [a, b] = node.entries;
      if (a !== null && b !== null) {
        node.status = 'ready';
      } else {
        // One entry against a bye advances; two byes send a bye onward.
        node.status = 'bye';
        node.winnerEntryId = a ?? b;
        place(nodes, node.next, node.winnerEntryId);
        place(nodes, node.loserNext, null);
      }
      changed = true;
    }
  }
  return nodes;
}

/**
 * Records a decided fixture (played, walkover, no-show, retirement, double walkover) and moves
 * the winner (and the loser, for a 3rd-place match) on.
 */
export function recordOutcome(input: readonly FixtureNode[], key: string, outcome: FixtureOutcome): FixtureNode[] {
  const nodes = clone(input);
  const node = nodes.find((n) => n.key === key);
  if (!node) throw new TournamentError('INVALID_RESULT', `Fixture ${key} does not exist.`);
  if (node.status !== 'ready' && node.status !== 'live') throw new TournamentError('NOT_READY', 'This fixture is not ready to be decided.');
  const [a, b] = node.entries as [string, string];

  if (outcome.type === 'double_walkover') {
    node.status = 'completed';
    node.winnerEntryId = null;
    place(nodes, node.next, null);
    place(nodes, node.loserNext, null);
    return settle(nodes);
  }
  if (outcome.winnerEntryId !== a && outcome.winnerEntryId !== b) {
    throw new TournamentError('INVALID_RESULT', 'The winner must be one of the two entries.');
  }
  const loser = outcome.winnerEntryId === a ? b : a;
  node.status = 'completed';
  node.winnerEntryId = outcome.winnerEntryId;
  place(nodes, node.next, outcome.winnerEntryId);
  // A no-show / walkover loser didn't play, so they don't go on to a 3rd-place match.
  place(nodes, node.loserNext, outcome.type === 'played' || outcome.type === 'retired' ? loser : null);
  return settle(nodes);
}

/** Fills knockout slots sourced from a finished group ("1st Group A") with its final ranking. */
export function fillGroupQualifiers(input: readonly FixtureNode[], groupKey: string, ranking: readonly string[]): FixtureNode[] {
  const nodes = clone(input);
  for (const node of nodes) {
    node.slots.forEach((source, i) => {
      if (source.kind !== 'group_rank' || source.groupKey !== groupKey) return;
      const entry = ranking[source.rank - 1];
      if (entry === undefined) node.byes[i] = true;
      else node.entries[i] = entry;
    });
  }
  return settle(nodes);
}

/** The final ranking of a finished knockout: champion, runner-up, then 3rd place if played. */
export function podium(nodes: readonly FixtureNode[], finalKey: string, thirdKey?: string): string[] {
  const final = nodes.find((n) => n.key === finalKey);
  if (!final || (final.status !== 'completed' && final.status !== 'bye') || !final.winnerEntryId) return [];
  const runnerUp = final.entries.find((e) => e !== null && e !== final.winnerEntryId) ?? null;
  const third = thirdKey ? nodes.find((n) => n.key === thirdKey)?.winnerEntryId ?? null : null;
  return [final.winnerEntryId, ...(runnerUp ? [runnerUp] : []), ...(third ? [third] : [])];
}
