import { describe, expect, it } from 'vitest';
import {
  addLateEntry,
  getFormat,
  groupFixturesFor,
  initialNodes,
  parseFormatConfig,
  PLAY_IN,
  rebuild,
  recordOutcome,
  removeFromBracket,
  seededRandom,
  TournamentError,
  type BracketFixture,
  type Decided,
  type FixtureNode,
  type RebuildOptions,
} from './index.js';

/** A knockout of n entries (e1 = seed 1 ...) as bracket fixtures, byes already advanced. */
function bracket(n: number, thirdPlaceMatch = false): BracketFixture[] {
  const entries = Array.from({ length: n }, (_, i) => ({ id: `e${i + 1}`, seed: i + 1 }));
  const plan = getFormat('knockout').generate(entries, parseFormatConfig('knockout', { thirdPlaceMatch }), { random: seededRandom(1) });
  const meta = new Map(plan.stages[0]!.fixtures.map((f) => [f.key, f]));
  return initialNodes(plan).map((node) => ({ ...node, round: meta.get(node.key)!.round, position: meta.get(node.key)!.position, roundName: meta.get(node.key)!.roundName }));
}

const at = <T extends FixtureNode>(nodes: T[], key: string) => nodes.find((n) => n.key === key)!;
/** Seed number = strength; late entries "x…" are unseeded. */
const strength = (id: string) => (id.startsWith('e') ? Number(id.slice(1)) : Infinity);

/** What the database would say: decided and live fixtures from the current nodes. */
function state(nodes: FixtureNode[], withdrawn: string[] = [], results: Map<string, Decided> = new Map()): RebuildOptions {
  const decided = new Map(results);
  for (const n of nodes) if (n.status === 'completed' && !decided.has(n.key)) decided.set(n.key, { winnerEntryId: n.winnerEntryId, type: 'played' });
  return { decided, live: new Set(nodes.filter((n) => n.status === 'live').map((n) => n.key)), withdrawn: new Set(withdrawn) };
}

function play<T extends FixtureNode>(nodes: T[], key: string, winner: string): T[] {
  const next = recordOutcome(nodes, key, { type: 'played', winnerEntryId: winner });
  return nodes.map((n) => ({ ...n, ...next.find((x) => x.key === n.key)! }));
}

describe('rebuild', () => {
  it('gives back the same bracket when nothing changed', () => {
    let nodes = bracket(6);
    nodes = play(nodes, 's1-r1-p2', 'e4');
    const again = rebuild(nodes, state(nodes));
    expect(again.map((n) => [n.key, n.status, n.entries, n.winnerEntryId])).toEqual(nodes.map((n) => [n.key, n.status, n.entries, n.winnerEntryId]));
  });

  it('refuses a change that would alter a played match', () => {
    let nodes = bracket(8);
    nodes = play(nodes, 's1-r1-p1', 'e1');
    const moved = nodes.map((n) => (n.key === 's1-r1-p1' ? { ...n, slots: [{ kind: 'entry', entryId: 'x1' }, n.slots[1]] as BracketFixture['slots'] } : n));
    expect(() => rebuild(moved, state(nodes))).toThrow(TournamentError);
  });

  it('keeps a live match exactly as it is', () => {
    const nodes = bracket(4).map((n) => (n.key === 's1-r1-p1' ? { ...n, status: 'live' as const } : n));
    const again = rebuild(nodes, state(nodes));
    expect(at(again, 's1-r1-p1')).toMatchObject({ status: 'live', entries: ['e1', 'e4'] });
  });
});

describe('late entries in a knockout', () => {
  it('fills the bye of the weakest bye-holder first', () => {
    // 6 entries in an 8 draw: seeds 1 and 2 have byes.
    const nodes = bracket(6);
    const { nodes: next, created } = addLateEntry(nodes, 'x1', state(nodes), strength, 'new');
    expect(created).toBeNull();
    const r1 = next.filter((n) => n.round === 1);
    const filled = r1.find((n) => n.entries.includes('x1'))!;
    expect(filled.entries).toContain('e2');
    expect(filled.status).toBe('ready');
    // Seed 2 no longer waits in round 2.
    expect(next.find((n) => n.round === 2 && n.entries.includes('e2'))).toBeUndefined();
    // Seed 1 keeps their bye.
    expect(r1.find((n) => n.entries.includes('e1'))!.status).toBe('bye');
  });

  it('adds a play-in against the weakest entry when the bracket is full (16 + 2)', () => {
    let nodes = bracket(16);
    nodes = play(nodes, 's1-r1-p1', 'e1');
    const first = addLateEntry(nodes, 'x1', state(nodes), strength, 'pi-1');
    expect(first.created).toMatchObject({ key: 'pi-1', round: 0, position: 1, roundName: PLAY_IN, status: 'ready', entries: ['e15', 'x1'] });
    const target = first.nodes.find((n) => n.slots.some((s) => s.kind === 'winner' && s.fixtureKey === 'pi-1'))!;
    expect(target).toMatchObject({ round: 1, status: 'pending' });
    expect(target.entries).toContain(null);

    // e16 already lost to e1, so the next weakest entry still waiting (e15) plays the newcomer.
    expect(target.key).not.toBe('s1-r1-p1');
  });

  it('pairs the second late entry with the next weakest entry still waiting', () => {
    let nodes = bracket(16);
    const one = addLateEntry(nodes, 'x1', state(nodes), strength, 'pi-1');
    nodes = one.nodes;
    const two = addLateEntry(nodes, 'x2', state(nodes), strength, 'pi-2');
    expect(two.created).toMatchObject({ round: 0, position: 2, entries: ['e15', 'x2'] });
    // The play-in winner moves on into round 1.
    const done = play(two.nodes, 'pi-1', 'x1');
    const r1 = done.find((n) => n.slots.some((s) => s.kind === 'winner' && s.fixtureKey === 'pi-1'))!;
    expect(r1).toMatchObject({ status: 'ready' });
    expect(r1.entries).toContain('x1');
  });

  it('says so when every first-round match has started', () => {
    let nodes = bracket(4);
    nodes = nodes.map((n) => (n.round === 1 ? { ...n, status: 'live' as const } : n));
    expect(() => addLateEntry(nodes, 'x1', state(nodes), strength, 'pi')).toThrow(/no place left/);
  });

  it('refuses an entry that is already in the draw', () => {
    const nodes = bracket(4);
    expect(() => addLateEntry(nodes, 'e3', state(nodes), strength, 'pi')).toThrow(/already in the draw/);
  });
});

describe('taking an entry out of a knockout', () => {
  it('turns an unplayed first-round line into a bye so the opponent moves on', () => {
    const nodes = bracket(8);
    const { nodes: next, removed } = removeFromBracket(nodes, 'e8', state(nodes, ['e8']));
    expect(removed).toEqual([]);
    expect(at(next, 's1-r1-p1')).toMatchObject({ status: 'bye', winnerEntryId: 'e1' });
    expect(at(next, 's1-r2-p1').entries[0]).toBe('e1');
  });

  it('lets the next opponent through when an entry withdraws after winning a match', () => {
    let nodes = bracket(8);
    nodes = play(nodes, 's1-r1-p1', 'e1');
    nodes = play(nodes, 's1-r1-p2', 'e4');
    const { nodes: next } = removeFromBracket(nodes, 'e1', state(nodes, ['e1']));
    // The win stands; e4 goes straight to the final.
    expect(at(next, 's1-r1-p1')).toMatchObject({ status: 'completed', winnerEntryId: 'e1' });
    expect(at(next, 's1-r2-p1')).toMatchObject({ status: 'bye', winnerEntryId: 'e4' });
    expect(at(next, 's1-r3-p1').entries[0]).toBe('e4');
  });

  it('removes an unplayed play-in and gives the slot back to the other entry', () => {
    const nodes = bracket(16);
    const added = addLateEntry(nodes, 'x1', state(nodes), strength, 'pi-1');
    const { nodes: next, removed } = removeFromBracket(added.nodes, 'x1', state(added.nodes, ['x1']));
    expect(removed).toEqual(['pi-1']);
    expect(next.find((n) => n.key === 'pi-1')).toBeUndefined();
    const back = next.find((n) => n.slots.some((s) => s.kind === 'entry' && s.entryId === 'e16'))!;
    expect(back).toMatchObject({ round: 1, status: 'ready' });
  });

  it('keeps a played third-place result when its winner withdraws', () => {
    let nodes = bracket(4, true);
    nodes = play(nodes, 's1-r1-p1', 'e1');
    nodes = play(nodes, 's1-r1-p2', 'e2');
    nodes = play(nodes, 's1-third', 'e4');
    const { nodes: next } = removeFromBracket(nodes, 'e4', state(nodes, ['e4']));
    expect(at(next, 's1-third')).toMatchObject({ status: 'completed', winnerEntryId: 'e4' });
    expect(at(next, 's1-r2-p1')).toMatchObject({ status: 'ready', entries: ['e1', 'e2'] });
  });

  it('gives a bye onward when both sides of a fixture are gone', () => {
    const nodes = bracket(4);
    let next = removeFromBracket(nodes, 'e1', state(nodes, ['e1'])).nodes;
    next = removeFromBracket(next, 'e4', state(next, ['e1', 'e4'])).nodes;
    expect(at(next, 's1-r1-p1')).toMatchObject({ status: 'bye', winnerEntryId: null });
    // The final waits for e2 v e3 and the winner gets the title by bye.
    const done = play(next, 's1-r1-p2', 'e2');
    expect(at(done, 's1-r2-p1')).toMatchObject({ status: 'bye', winnerEntryId: 'e2' });
  });
});

describe('late entries in a round-robin group', () => {
  it('pairs the newcomer with whoever rests in an odd group, one round each', () => {
    // 3 members: rounds 1-3, one rests each round.
    const existing = [
      { round: 1, position: 1, entries: ['a', 'c'] as [string, string], done: true },
      { round: 2, position: 1, entries: ['a', 'b'] as [string, string], done: false },
      { round: 3, position: 1, entries: ['b', 'c'] as [string, string], done: false },
    ];
    const added = groupFixturesFor(existing, ['a', 'b', 'c'], 'n', 1);
    expect(added).toEqual([
      { round: 3, position: 2, entries: ['a', 'n'] },
      { round: 4, position: 1, entries: ['b', 'n'] },
      { round: 2, position: 2, entries: ['c', 'n'] },
    ]);
  });

  it('plays everyone twice with two legs, home and away swapped', () => {
    const added = groupFixturesFor([], ['a', 'b'], 'n', 2);
    expect(added.map((f) => f.entries)).toEqual([
      ['a', 'n'],
      ['b', 'n'],
      ['n', 'a'],
      ['n', 'b'],
    ]);
    expect(new Set(added.map((f) => f.round)).size).toBe(4);
  });

  it('starts after the rounds that are already finished', () => {
    const existing = [{ round: 1, position: 1, entries: ['a', 'b'] as [string, string], done: true }];
    expect(groupFixturesFor(existing, ['a', 'b'], 'n', 1).map((f) => f.round)).toEqual([2, 3]);
  });
});
