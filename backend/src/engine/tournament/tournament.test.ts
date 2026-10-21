import { describe, expect, it } from 'vitest';
import {
  fillGroupQualifiers,
  getFormat,
  initialNodes,
  parseFormatConfig,
  podium,
  rankGroup,
  recordOutcome,
  seededRandom,
  TournamentError,
  type DrawPlan,
  type EntryInput,
  type FixtureNode,
  type GroupResult,
} from './index.js';

const entries = (n: number, seeded = n): EntryInput[] =>
  Array.from({ length: n }, (_, i) => ({ id: `e${i + 1}`, seed: i < seeded ? i + 1 : null }));

function draw(format: string, n: number, config: unknown = {}, seeded = n): DrawPlan {
  return getFormat(format).generate(entries(n, seeded), parseFormatConfig(format, config), { random: seededRandom(42) });
}

const node = (nodes: FixtureNode[], key: string) => nodes.find((n) => n.key === key)!;
const ready = (nodes: FixtureNode[]) => nodes.filter((n) => n.status === 'ready');

/** Plays every ready fixture, the lower seed number (e3 < e7) winning, until nothing is ready. */
function playOut(nodes: FixtureNode[]): FixtureNode[] {
  let current = nodes;
  for (let next = ready(current)[0]; next; next = ready(current)[0]) {
    const [a, b] = next.entries as [string, string];
    const winner = Number(a.slice(1)) < Number(b.slice(1)) ? a : b;
    current = recordOutcome(current, next.key, { type: 'played', winnerEntryId: winner });
  }
  return current;
}

describe('knockout', () => {
  it('draws 8 entries with no byes and keeps seeds 1 and 2 apart until the final', () => {
    const plan = draw('knockout', 8);
    const fixtures = plan.stages[0]!.fixtures;
    expect(fixtures).toHaveLength(7);
    const r1 = fixtures.filter((f) => f.round === 1).map((f) => f.slots.map((s) => (s.kind === 'entry' ? s.entryId : s.kind)).join(' v '));
    expect(r1).toEqual(['e1 v e8', 'e4 v e5', 'e2 v e7', 'e3 v e6']);
    expect(fixtures.find((f) => f.round === 3)!.roundName).toBe('Final');
    const final = node(playOut(initialNodes(plan)), 's1-r3-p1');
    expect(final.entries).toEqual(['e1', 'e2']);
    expect(final.winnerEntryId).toBe('e1');
  });

  it('gives the 3 byes of a 5-entry draw to the top 3 seeds and advances them at once', () => {
    const plan = draw('knockout', 5);
    const nodes = initialNodes(plan);
    const byes = nodes.filter((n) => n.status === 'bye');
    expect(byes.map((n) => n.winnerEntryId).sort()).toEqual(['e1', 'e2', 'e3']);
    expect(ready(nodes).map((n) => n.entries)).toEqual([['e4', 'e5'], ['e2', 'e3']]);
    // Seed 2 and 3 already meet in the semi-final; seed 1 waits for the winner of 4 v 5.
    expect(node(nodes, 's1-r2-p2')).toMatchObject({ status: 'ready', entries: ['e2', 'e3'] });
    expect(node(nodes, 's1-r2-p1')).toMatchObject({ status: 'pending', entries: ['e1', null] });
    expect(node(playOut(nodes), 's1-r3-p1').winnerEntryId).toBe('e1');
  });

  it('runs a 13-entry draw: 16 lines, byes for seeds 1-3, 12 matches played', () => {
    const plan = draw('knockout', 13);
    expect(plan.stages[0]!.fixtures).toHaveLength(15);
    const nodes = initialNodes(plan);
    expect(nodes.filter((n) => n.status === 'bye').map((n) => n.winnerEntryId).sort()).toEqual(['e1', 'e2', 'e3']);
    const done = playOut(nodes);
    expect(done.filter((n) => n.status === 'completed')).toHaveLength(12);
    expect(podium(done, 's1-r4-p1')).toEqual(['e1', 'e2']);
  });

  it('places unseeded entries randomly but reproducibly', () => {
    expect(draw('knockout', 8, {}, 2)).toEqual(draw('knockout', 8, {}, 2));
    const r1 = draw('knockout', 8, {}, 2).stages[0]!.fixtures[0]!.slots[0];
    expect(r1).toEqual({ kind: 'entry', entryId: 'e1' });
  });

  it('plays a 3rd-place match between the semi-final losers', () => {
    const plan = draw('knockout', 4, { thirdPlaceMatch: true });
    const done = playOut(initialNodes(plan));
    expect(node(done, 's1-third')).toMatchObject({ status: 'completed', entries: ['e4', 'e3'], winnerEntryId: 'e3' });
    expect(podium(done, 's1-r2-p1', 's1-third')).toEqual(['e1', 'e2', 'e3']);
  });

  it('advances walkovers and retirements like wins; a double walkover gives the next opponent a bye', () => {
    let nodes = initialNodes(draw('knockout', 8, { thirdPlaceMatch: true }));
    nodes = recordOutcome(nodes, 's1-r1-p1', { type: 'walkover', winnerEntryId: 'e8' });
    nodes = recordOutcome(nodes, 's1-r1-p2', { type: 'retired', winnerEntryId: 'e5' });
    expect(node(nodes, 's1-r2-p1')).toMatchObject({ status: 'ready', entries: ['e8', 'e5'] });

    nodes = recordOutcome(nodes, 's1-r1-p3', { type: 'double_walkover', winnerEntryId: null });
    nodes = recordOutcome(nodes, 's1-r1-p4', { type: 'played', winnerEntryId: 'e3' });
    expect(node(nodes, 's1-r2-p2')).toMatchObject({ status: 'bye', winnerEntryId: 'e3' });
    expect(node(nodes, 's1-r3-p1').entries).toEqual([null, 'e3']);

    // The semi-final loser by no-show does not go on to the 3rd-place match.
    nodes = recordOutcome(nodes, 's1-r2-p1', { type: 'no_show', winnerEntryId: 'e5' });
    expect(node(nodes, 's1-r3-p1')).toMatchObject({ status: 'ready', entries: ['e5', 'e3'] });
    expect(node(nodes, 's1-third').byes).toEqual([true, true]);
    expect(node(nodes, 's1-third').status).toBe('bye');
  });

  it('rejects deciding a fixture that is not ready, or with a stranger as winner', () => {
    const nodes = initialNodes(draw('knockout', 8));
    expect(() => recordOutcome(nodes, 's1-r2-p1', { type: 'played', winnerEntryId: 'e1' })).toThrow(TournamentError);
    expect(() => recordOutcome(nodes, 's1-r1-p1', { type: 'played', winnerEntryId: 'e2' })).toThrow('one of the two');
  });
});

describe('round robin', () => {
  it('schedules everyone against everyone once, in rounds', () => {
    const plan = draw('round_robin', 4);
    const fixtures = plan.stages[0]!.fixtures;
    expect(fixtures).toHaveLength(6);
    expect(new Set(fixtures.map((f) => f.round))).toEqual(new Set([1, 2, 3]));
    const pairs = new Set(fixtures.map((f) => f.slots.map((s) => (s.kind === 'entry' ? s.entryId : '')).sort().join('-')));
    expect(pairs.size).toBe(6);
    expect(draw('round_robin', 5).stages[0]!.fixtures).toHaveLength(10);
    expect(draw('round_robin', 3, { legs: 2 }).stages[0]!.fixtures).toHaveLength(6);
  });

  it('breaks a 3-way tie (A>B, B>C, C>A) by game difference, then the direct match of the last two', () => {
    const r = (a: string, b: string, winner: string, major: [number, number], minor: [number, number]): GroupResult => ({
      entry1Id: a,
      entry2Id: b,
      winnerEntryId: winner,
      type: 'played',
      major,
      minor,
    });
    // Everyone beats D; A, B, C beat each other in a circle (head-to-head can't split them).
    // Game difference: A +3, B +1, C +1. Point difference: B +23, C +26.
    const results = [
      r('A', 'B', 'A', [2, 0], [42, 30]),
      r('B', 'C', 'B', [2, 1], [60, 55]),
      r('C', 'A', 'C', [2, 1], [58, 50]),
      r('A', 'D', 'A', [2, 0], [42, 10]),
      r('B', 'D', 'B', [2, 0], [42, 12]),
      r('C', 'D', 'C', [2, 1], [63, 40]),
    ];
    const table = rankGroup(['A', 'B', 'C', 'D'], results);
    // A is clear on game difference; B and C stay level, so their direct match decides (B beat C).
    expect(table.map((row) => row.entryId)).toEqual(['A', 'B', 'C', 'D']);
    expect(table[0]).toMatchObject({ rank: 1, played: 3, won: 2, lost: 1, majorWon: 5, majorLost: 2 });
    expect(table[1]).toMatchObject({ entryId: 'B', majorWon: 4, majorLost: 3, minorWon: 132, minorLost: 109 });
    // What the group table explains: A left the 3-way tie on games, B and C split on their match.
    expect(table.map((row) => row.tiebreak)).toEqual(['major_diff', 'head_to_head', 'head_to_head', null]);
    // Without head-to-head, point difference separates B and C instead.
    const byPoints = rankGroup(['A', 'B', 'C', 'D'], results, ['match_wins', 'major_diff', 'minor_diff']);
    expect(byPoints.map((row) => row.entryId)).toEqual(['A', 'C', 'B', 'D']);
  });

  it('ranks a 2-way tie by the direct match, and settles a perfect tie by seed', () => {
    const r = (a: string, b: string, winner: string, major: [number, number]): GroupResult => ({ entry1Id: a, entry2Id: b, winnerEntryId: winner, type: 'played', major, minor: [0, 0] });
    // X and Y both win 2; Y has the better game difference but X won their match.
    const results = [r('X', 'Y', 'X', [2, 1]), r('X', 'W', 'W', [0, 2]), r('X', 'Z', 'X', [2, 1]), r('Y', 'W', 'Y', [2, 0]), r('Y', 'Z', 'Y', [2, 0]), r('W', 'Z', 'Z', [0, 2])];
    expect(rankGroup(['W', 'X', 'Y', 'Z'], results, ['match_wins', 'head_to_head', 'major_diff']).map((x) => x.entryId)).toEqual(['X', 'Y', 'Z', 'W']);
    expect(rankGroup(['W', 'X', 'Y', 'Z'], results, ['match_wins', 'major_diff', 'head_to_head']).map((x) => x.entryId)).toEqual(['Y', 'X', 'Z', 'W']);
    expect(rankGroup(['P', 'Q'], [], undefined, new Map([['P', 2], ['Q', 1]])).map((r) => r.entryId)).toEqual(['Q', 'P']);
  });

  it('counts a walkover as a win with the walkover score and a double walkover as two losses', () => {
    const table = rankGroup(['A', 'B', 'C'], [
      { entry1Id: 'A', entry2Id: 'B', winnerEntryId: 'B', type: 'walkover', major: [0, 2], minor: [0, 42] },
      { entry1Id: 'A', entry2Id: 'C', winnerEntryId: null, type: 'double_walkover', major: [0, 0], minor: [0, 0] },
    ]);
    expect(table[0]).toMatchObject({ entryId: 'B', won: 1, majorWon: 2 });
    expect(table.find((r) => r.entryId === 'C')).toMatchObject({ won: 0, lost: 1 });
  });
});

describe('groups -> knockout', () => {
  it('snake-seeds groups and sends the top 2 into a cross-over knockout', () => {
    const plan = draw('groups_knockout', 8, { groupCount: 2, qualifiersPerGroup: 2 });
    const [groups, knockout] = plan.stages as [DrawPlan['stages'][0], DrawPlan['stages'][0]];
    expect(groups.groups.map((g) => [g.name, g.entryIds])).toEqual([
      ['Group A', ['e1', 'e4', 'e5', 'e8']],
      ['Group B', ['e2', 'e3', 'e6', 'e7']],
    ]);
    expect(groups.fixtures).toHaveLength(12);
    expect(knockout.fixtures.filter((f) => f.round === 1).map((f) => f.slots)).toEqual([
      [
        { kind: 'group_rank', groupKey: 's1-g1', rank: 1 },
        { kind: 'group_rank', groupKey: 's1-g2', rank: 2 },
      ],
      [
        { kind: 'group_rank', groupKey: 's1-g2', rank: 1 },
        { kind: 'group_rank', groupKey: 's1-g1', rank: 2 },
      ],
    ]);

    let nodes = initialNodes(plan);
    expect(nodes.filter((n) => n.key.startsWith('s2')).every((n) => n.status === 'pending')).toBe(true);
    nodes = fillGroupQualifiers(nodes, 's1-g1', ['e4', 'e1', 'e5', 'e8']);
    nodes = fillGroupQualifiers(nodes, 's1-g2', ['e2', 'e3', 'e6', 'e7']);
    expect(node(nodes, 's2-r1-p1')).toMatchObject({ status: 'ready', entries: ['e4', 'e3'] });
    expect(node(nodes, 's2-r1-p2')).toMatchObject({ status: 'ready', entries: ['e2', 'e1'] });
  });

  it('gives byes to group winners when the qualifiers are not a power of two', () => {
    const plan = draw('groups_knockout', 9, { groupCount: 3, qualifiersPerGroup: 2 });
    let nodes = initialNodes(plan);
    for (const group of plan.stages[0]!.groups) nodes = fillGroupQualifiers(nodes, group.key, group.entryIds);
    const byes = nodes.filter((n) => n.key.startsWith('s2') && n.status === 'bye');
    expect(byes).toHaveLength(2);
    expect(ready(nodes).filter((n) => n.key.startsWith('s2'))).toHaveLength(2);
  });

  it('needs enough entries for the groups', () => {
    expect(() => draw('groups_knockout', 5, { groupCount: 2, qualifiersPerGroup: 2 })).toThrow('at least 6');
    expect(() => parseFormatConfig('swiss', {})).toThrow('Unknown tournament format');
  });
});
