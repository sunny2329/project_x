import { describe, expect, it } from 'vitest';
import { SPORTS } from '../../catalog/sports.js';
import { createScorer, manualResultEvents, parseConfig, replay, rulesName, scoringRegistry, ScoringError, type GameDetail, type PluginEvent, type ScoreSummary } from './index.js';
import { scorerFor } from './test-helpers.js';

const score = (sideIndex: 0 | 1, points: 1 | 2 | 3, extra: Record<string, unknown> = {}): PluginEvent => ({ type: 'score', sideIndex, points, ...extra }) as PluginEvent;
const foul = (sideIndex: 0 | 1, extra: Record<string, unknown> = {}): PluginEvent => ({ type: 'foul', sideIndex, ...extra }) as PluginEvent;
const timeout = (sideIndex: 0 | 1): PluginEvent => ({ type: 'timeout', sideIndex }) as PluginEvent;
const tag = (playerIndex: number, assistIndex?: number): PluginEvent => ({ type: 'tag', playerIndex, ...(assistIndex === undefined ? {} : { assistIndex }) }) as PluginEvent;
const sub = (sideIndex: 0 | 1, outIndex: number, inIndex: number): PluginEvent => ({ type: 'sub', sideIndex, outIndex, inIndex }) as PluginEvent;
const periodEnd = (clock?: number): PluginEvent => ({ type: 'period_end', ...(clock === undefined ? {} : { clock }) }) as PluginEvent;
const many = (n: number, side: 0 | 1, points: 1 | 2 | 3 = 2) => Array.from({ length: n }, () => score(side, points));

/** 3v3 first to 21 (the default ruleset), three players a side. */
const target = (overrides: Record<string, unknown> = {}, players = 3) => scorerFor('basketball', undefined, players, overrides);
/** 5v5, 4 quarters, 3-pointers, foul out at 5, seven players a side. */
const timed = (overrides: Record<string, unknown> = {}, players = 7) => scorerFor('basketball', '5v5-quarters', players, overrides);
const run = (scorer: ReturnType<typeof target>, events: PluginEvent[]): ScoreSummary => replay(scorer, events).summary;
const game = (s: ScoreSummary): GameDetail => s.game!;
const rejects = (scorer: ReturnType<typeof target>, events: PluginEvent[], message: string | RegExp) => {
  expect(() => replay(scorer, events)).toThrow(message);
};

describe('baskets (basketball): catalog', () => {
  it('ships an active sport with 3v3 / 4v4 / 5v5 and one default ruleset', () => {
    const sport = SPORTS.find((s) => s.slug === 'basketball')!;
    expect(sport).toMatchObject({ isActive: true, scoringModel: 'baskets', accentColor: '#3B82F6', iconKey: 'basketball' });
    expect(sport.formats.map((f) => [f.code, f.playersPerSide, f.maxPerSide])).toEqual([
      ['3v3', 3, 12],
      ['4v4', 4, 12],
      ['5v5', 5, 12],
    ]);
    expect(sport.rulesets.filter((r) => r.isDefault).map((r) => r.slug)).toEqual(['3v3-21']);
  });

  it('names each ruleset as describeRules would', () => {
    for (const r of SPORTS.find((s) => s.slug === 'basketball')!.rulesets) {
      const config = parseConfig(scoringRegistry.get('baskets'), r.config);
      expect(rulesName(scoringRegistry, 'baskets', config, 'x'), r.slug).toBe(r.name);
    }
  });

  it('describes changed rules', () => {
    expect(rulesName(scoringRegistry, 'baskets', { mode: 'target', target: 11, winBy: 2, timeLimitMinutes: 8 }, 'x')).toBe('First to 11 · 8 min limit · win by 2');
    expect(rulesName(scoringRegistry, 'baskets', { mode: 'timed', periods: 1, periodMinutes: 12, stopClock: true }, 'x')).toBe('One 12 min game · clock stops');
  });

  it('refuses bad configs and side layouts', () => {
    const sides = (a: number, b: number) => [
      { index: 0, playerCount: a },
      { index: 1, playerCount: b },
    ];
    expect(() => createScorer(scoringRegistry, 'baskets', { mode: 'timed', periods: 3 }, sides(5, 5))).toThrow(ScoringError);
    expect(() => createScorer(scoringRegistry, 'baskets', { mode: 'sudden' }, sides(5, 5))).toThrow(ScoringError);
    expect(() => createScorer(scoringRegistry, 'baskets', { mode: 'target', playersOnCourt: 6 }, sides(5, 5))).toThrow(ScoringError);
    expect(() => createScorer(scoringRegistry, 'baskets', { mode: 'target' }, sides(13, 5))).toThrow('1 to 12 players');
    expect(() => createScorer(scoringRegistry, 'baskets', { mode: 'target' }, [{ index: 0, playerCount: 3 }])).toThrow('exactly two sides');
    // Uneven teams (a sub on one bench) are fine.
    expect(() => createScorer(scoringRegistry, 'baskets', { mode: 'target' }, sides(3, 5))).not.toThrow();
  });
});

describe('baskets: first to 21', () => {
  it('starts level with the first ball, buttons for 1 and 2, fouls, timeouts and Time', () => {
    const s = run(target(), []);
    expect(s).toMatchObject({ complete: false, winnerSideIndex: null, headline: '0-0', callout: null });
    expect(s.sides.map((x) => [x.primary, x.serving])).toEqual([
      ['0', true],
      ['0', false],
    ]);
    expect(s.actions.map((a) => a.id)).toEqual(['score-0-1', 'score-0-2', 'foul-0', 'timeout-0', 'score-1-1', 'score-1-2', 'foul-1', 'timeout-1', 'period-end']);
    expect(game(s)).toMatchObject({ period: 1, periodLabel: 'Game', periods: 1, overtime: false, clock: null, possessionSideIndex: 0, suddenDeath: false });
    expect(game(s).teams).toEqual([
      { fouls: 0, bonus: false, timeoutsLeft: 1 },
      { fouls: 0, bonus: false, timeoutsLeft: 1 },
    ]);
    expect(game(s).players.map((side) => side.map((p) => p.onCourt))).toEqual([
      [true, true, true],
      [true, true, true],
    ]);
  });

  it('adds points, hands the ball over after a basket and calls game point', () => {
    const s = run(target(), [score(0, 2), score(0, 1)]);
    expect(s.headline).toBe('3-0');
    expect(game(s).possessionSideIndex).toBe(1);
    expect(run(target(), [...many(10, 0), score(1, 2)]).callout).toBe('Game point');
    expect(run(target(), [...many(9, 1), ...many(9, 0), score(0, 1), score(1, 1)]).callout).toBeNull(); // both on 19
  });

  it('refuses 3-pointers when the rules only have 1s and 2s', () => {
    rejects(target(), [score(0, 3)], 'no 3-pointers');
  });

  it('ends the moment a team reaches the target, by up to one basket over', () => {
    const s = run(target(), [...many(10, 0), score(0, 2)]);
    expect(s).toMatchObject({ complete: true, winnerSideIndex: 0, headline: '22-0', callout: 'Won by 22', actions: [] });
    expect(s.totals).toEqual({ major: [1, 0], minor: [22, 0], majorLabel: 'Wins', minorLabel: 'Points' });
    expect(s.segments).toEqual([expect.objectContaining({ type: 'game', label: 'Game', scores: [22, 0], complete: true, winnerSideIndex: 0 })]);
    rejects(target(), [...many(11, 0), score(1, 1)], 'already decided');
  });

  it('plays on past the target until the lead is enough when win by 2', () => {
    const scorer = target({ winBy: 2 });
    const level = [...many(10, 0), ...many(10, 1)];
    expect(run(scorer, [...level, score(0, 1)]).complete).toBe(false); // 21-20
    expect(run(scorer, [...level, score(0, 1), score(1, 1), score(1, 2)])).toMatchObject({ complete: true, winnerSideIndex: 1, headline: '21-23' });
  });

  it('gives the game to the side ahead when time runs out, and the next basket when level', () => {
    expect(run(target(), [score(0, 2), score(1, 1), periodEnd(0)])).toMatchObject({ complete: true, winnerSideIndex: 0, headline: '2-1' });
    const level = run(target(), [score(0, 2), score(1, 2), periodEnd(0)]);
    expect(level).toMatchObject({ complete: false, callout: 'Tied at time · next basket wins' });
    expect(game(level).suddenDeath).toBe(true);
    expect(level.actions.some((a) => a.id === 'period-end')).toBe(false);
    rejects(target(), [score(0, 2), score(1, 2), periodEnd(), periodEnd()], 'Time is already up');
    // A foul at sudden death changes nothing; the next basket wins.
    expect(run(target(), [score(0, 2), score(1, 2), periodEnd(), foul(0), score(1, 1)])).toMatchObject({ complete: true, winnerSideIndex: 1, headline: '2-3' });
  });

  it('counts team fouls for the game and flags the limit', () => {
    const s = run(target(), Array.from({ length: 7 }, () => foul(1)));
    expect(game(s).teams[1]).toEqual({ fouls: 7, bonus: true, timeoutsLeft: 1 });
    expect(game(s).teams[0]!.bonus).toBe(false);
  });

  it('allows one timeout per team per game', () => {
    const s = run(target(), [timeout(0)]);
    expect(game(s).teams[0]!.timeoutsLeft).toBe(0);
    expect(s.actions.some((a) => a.id === 'timeout-0')).toBe(false);
    rejects(target(), [timeout(0), timeout(0)], 'No timeouts left');
  });

  it('lets a possession event set who has the ball', () => {
    expect(game(run(target(), [{ type: 'possession', sideIndex: 1 } as PluginEvent])).possessionSideIndex).toBe(1);
  });
});

describe('baskets: who scored', () => {
  it('credits points and assists to players, straight away or with a tag after', () => {
    const s = run(target(), [score(0, 2, { playerIndex: 1, assistIndex: 0 }), score(0, 1), tag(2, 1), score(1, 2), tag(0)]);
    const [a, b] = game(s).players as [GameDetail['players'][0], GameDetail['players'][0]];
    expect(a.map((p) => [p.points, p.ones, p.twos, p.assists])).toEqual([
      [0, 0, 0, 1],
      [2, 0, 1, 1],
      [1, 1, 0, 0],
    ]);
    expect(b[0]!.points).toBe(2);
    expect(game(s).plays.map((p) => [p.kind, p.sideIndex, p.points, p.playerIndex, p.assistIndex, p.score])).toEqual([
      ['score', 0, 2, 1, 0, [2, 0]],
      ['score', 0, 1, 2, 1, [3, 0]],
      ['score', 1, 2, 0, null, [3, 2]],
    ]);
  });

  it('keeps team points when a basket is never tagged, and drops an assist to oneself', () => {
    const s = run(target(), [score(0, 2), score(0, 2, { playerIndex: 0, assistIndex: 0 })]);
    expect(game(s).players[0]!.map((p) => p.points)).toEqual([2, 0, 0]);
    expect(game(s).plays[1]!.assistIndex).toBeNull();
    expect(s.headline).toBe('4-0');
  });

  it('re-tags only the last play, and only with a player of that team', () => {
    expect(game(run(target(), [score(0, 2), tag(0), tag(1)])).players[0]!.map((p) => p.points)).toEqual([0, 2, 0]);
    rejects(target(), [tag(0)], 'no basket or foul');
    rejects(target(), [score(0, 2), timeout(1), tag(0)], 'no basket or foul');
    rejects(target({}, 3), [score(0, 2), tag(3)], 'not on this team');
    rejects(target(), [score(0, 2, { playerIndex: 5 })], 'not on this team');
  });

  it('tags fouls to players too', () => {
    const s = run(target(), [foul(1), tag(2)]);
    expect(game(s).players[1]![2]!.fouls).toBe(1);
    expect(game(s).plays[0]).toMatchObject({ kind: 'foul', foulKind: 'personal', playerIndex: 2 });
  });
});

describe('baskets: 4 quarters', () => {
  it('starts in Q1 with 1, 2 and 3 pointers and the first five on court', () => {
    const s = run(timed(), []);
    expect(s.actions.filter((a) => a.sideIndex === 0).map((a) => a.label)).toEqual(['+1', '+2', '+3', 'Foul', 'Timeout']);
    expect(s.actions.at(-1)).toMatchObject({ id: 'period-end', label: 'End Q1', sideIndex: null });
    expect(game(s).players[0]!.map((p) => p.onCourt)).toEqual([true, true, true, true, true, false, false]);
    expect(game(s).periodLabel).toBe('Q1');
  });

  it('keeps a score per quarter and the arrow where it was after a basket', () => {
    const s = run(timed(), [score(0, 3, { clock: 500 }), periodEnd(0), score(1, 2, { clock: 420 })]);
    expect(s.segments.map((x) => [x.label, x.scores, x.complete])).toEqual([
      ['Q1', [3, 0], true],
      ['Q2', [0, 2], false],
    ]);
    expect(game(s)).toMatchObject({ period: 2, periodLabel: 'Q2', clock: 420, possessionSideIndex: 0 });
    expect(s.headline).toBe('3-2');
  });

  it('decides the game at the end of Q4, or plays overtime until someone leads', () => {
    const quarters = (n: number) => Array.from({ length: n }, () => periodEnd());
    expect(run(timed(), [score(0, 2), ...quarters(4)])).toMatchObject({ complete: true, winnerSideIndex: 0, callout: 'Won by 2' });
    const ot = run(timed(), [score(0, 2), score(1, 2), ...quarters(4)]);
    expect(ot.complete).toBe(false);
    expect(game(ot)).toMatchObject({ period: 5, periodLabel: 'OT', overtime: true });
    expect(ot.callout).toBe('Overtime');
    const ot2 = run(timed(), [score(0, 2), score(1, 2), ...quarters(5)]);
    expect(game(ot2).periodLabel).toBe('OT2');
    const won = run(timed(), [score(0, 2), score(1, 2), ...quarters(4), score(1, 3), periodEnd()]);
    expect(won).toMatchObject({ complete: true, winnerSideIndex: 1, callout: 'Won by 3 in overtime' });
    expect(won.segments.map((x) => [x.type, x.label])).toEqual([
      ['period', 'Q1'],
      ['period', 'Q2'],
      ['period', 'Q3'],
      ['period', 'Q4'],
      ['overtime', 'OT'],
    ]);
  });

  it('labels halves and one-period games', () => {
    expect(game(run(timed({ periods: 2 }), [periodEnd()])).periodLabel).toBe('H2');
    expect(game(run(timed({ periods: 1 }), [])).periodLabel).toBe('Game');
    expect(run(timed({ periods: 1 }), [score(1, 1), periodEnd()])).toMatchObject({ complete: true, winnerSideIndex: 1 });
  });

  it('resets team fouls every quarter and flags the bonus at five', () => {
    const fouls = Array.from({ length: 5 }, () => foul(0));
    expect(game(run(timed(), fouls)).teams[0]).toMatchObject({ fouls: 5, bonus: true });
    expect(game(run(timed(), [...fouls, periodEnd()])).teams[0]).toMatchObject({ fouls: 0, bonus: false });
    expect(game(run(timed({ teamFoulsPer: 'game' }), [...fouls, periodEnd()])).teams[0]).toMatchObject({ fouls: 5, bonus: true });
  });

  it('gives two timeouts a half, overtime counting as the second half', () => {
    const two = [timeout(0), timeout(0)];
    rejects(timed(), [...two, timeout(0)], 'No timeouts left');
    expect(game(run(timed(), [...two, periodEnd()])).teams[0]!.timeoutsLeft).toBe(0); // Q2 is still the first half
    expect(game(run(timed(), [...two, periodEnd(), periodEnd()])).teams[0]!.timeoutsLeft).toBe(2); // Q3
    const ot = run(timed(), [score(0, 1), score(1, 1), periodEnd(), periodEnd(), ...two, periodEnd(), periodEnd()]);
    expect(game(ot)).toMatchObject({ overtime: true });
    expect(game(ot).teams[0]!.timeoutsLeft).toBe(0);
  });

  it('fouls a player out on the fifth foul and keeps them off the scoresheet after', () => {
    const four = Array.from({ length: 4 }, () => foul(1, { playerIndex: 0 }));
    const s = run(timed(), [...four, foul(1, { playerIndex: 0, kind: 'shooting' })]);
    expect(game(s).plays.at(-1)).toMatchObject({ fouledOut: true, foulKind: 'shooting' });
    expect(game(s).players[1]![0]).toMatchObject({ fouls: 5, fouledOut: true });
    rejects(timed(), [...four, foul(1, { playerIndex: 0 }), foul(1, { playerIndex: 0 })], 'already fouled out');
    rejects(timed(), [...four, foul(1, { playerIndex: 0 }), score(1, 2, { playerIndex: 0 })], 'fouled out');
    rejects(timed(), [...four, foul(1, { playerIndex: 0 }), score(1, 2), tag(0)], 'fouled out');
    rejects(timed(), [...four, foul(1, { playerIndex: 0 }), sub(1, 0, 5), sub(1, 5, 0)], 'fouled out');
    // A tag can be what fouls a player out.
    expect(game(run(timed(), [...four, foul(1), tag(0)])).plays.at(-1)!.fouledOut).toBe(true);
  });

  it('never fouls anyone out when the rules say so', () => {
    const s = run(timed({ foulOutAt: 0 }), Array.from({ length: 8 }, () => foul(0, { playerIndex: 1 })));
    expect(game(s).players[0]![1]).toMatchObject({ fouls: 8, fouledOut: false });
  });

  it('swaps players on and off court', () => {
    const s = run(timed(), [sub(0, 2, 6)]);
    expect(game(s).players[0]!.map((p) => p.onCourt)).toEqual([true, true, false, true, true, false, true]);
    expect(game(s).plays[0]).toMatchObject({ kind: 'sub', inIndex: 6, outIndex: 2 });
    rejects(timed(), [sub(0, 6, 5)], 'not on court');
    rejects(timed(), [sub(0, 0, 1)], 'already on court');
    rejects(timed({}, 7), [sub(0, 0, 9)], 'not on this team');
  });

  it('puts everyone on court when a team is short', () => {
    expect(game(run(timed({}, 3), [])).players[0]!.map((p) => p.onCourt)).toEqual([true, true, true]);
  });
});

describe('baskets: results typed in afterwards', () => {
  const manual = (scorer: ReturnType<typeof target>, scores: number[][]) => replay(scorer, manualResultEvents(scorer, scores)).summary;

  it('accepts a first-to score that ends on the target, one basket over, or on time', () => {
    expect(manual(target(), [[21, 17]])).toMatchObject({ complete: true, winnerSideIndex: 0, headline: '21-17' });
    expect(manual(target(), [[15, 22]])).toMatchObject({ complete: true, winnerSideIndex: 1, headline: '15-22' });
    expect(manual(target(), [[18, 12]])).toMatchObject({ complete: true, winnerSideIndex: 0, headline: '18-12' }); // time limit
    expect(manual(target({ winBy: 2 }), [[23, 21]])).toMatchObject({ complete: true, headline: '23-21' });
    expect(manual(target({ threePointers: true }), [[23, 10]]).headline).toBe('23-10');
  });

  it('refuses ties and scores the game could not end on', () => {
    expect(() => manualResultEvents(target(), [[21, 21]])).toThrow('tied');
    expect(() => manualResultEvents(target(), [[22, 21]])).toThrow('not possible'); // both reached 21
    expect(() => manualResultEvents(target(), [[25, 10]])).toThrow('not possible'); // past 21 by more than a basket
    expect(manual(target({ winBy: 2 }), [[24, 21]]).headline).toBe('24-21'); // 22-21, then a 2-pointer
    expect(() => manualResultEvents(target({ winBy: 2 }), [[25, 21]])).toThrow('not possible');
    expect(() => manualResultEvents(target(), [[21, 17], [21, 10]])).toThrow('final score');
  });

  it('records only the total for timed games', () => {
    const s = manual(timed(), [[81, 78]]);
    expect(s).toMatchObject({ complete: true, winnerSideIndex: 0, headline: '81-78', callout: null });
    expect(s.segments).toEqual([expect.objectContaining({ type: 'game', scores: [81, 78], complete: true })]);
    expect(s.totals.minor).toEqual([81, 78]);
    expect(() => manualResultEvents(timed(), [[60, 60]])).toThrow('tied');
    expect(() => replay(timed(), [score(0, 2), { type: 'result_total', scores: [10, 2] } as PluginEvent])).toThrow('already has plays');
  });
});

describe('baskets: purity', () => {
  it('never changes an earlier state when applying an event', () => {
    const plugin = scoringRegistry.get('baskets');
    const scorer = timed();
    const before = replay(scorer, [score(0, 2, { playerIndex: 0 })]);
    const frozen = JSON.stringify(before.state);
    plugin.applyEvent(before.state, { type: 'tag', playerIndex: 1 }, scorer.config);
    plugin.applyEvent(before.state, { type: 'sub', sideIndex: 0, outIndex: 0, inIndex: 6 }, scorer.config);
    plugin.applyEvent(before.state, { type: 'score', sideIndex: 0, points: 3 }, scorer.config);
    expect(JSON.stringify(before.state)).toBe(frozen);
  });
});
