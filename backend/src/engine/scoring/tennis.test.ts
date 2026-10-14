import { describe, expect, it } from 'vitest';
import { createScorer, manualResultEvents, replay, scoringRegistry, ScoringError } from './index.js';
import { alternate, play, rally, scorerFor, times } from './test-helpers.js';

const game = (side: 0 | 1) => times(side, 4);
const games = (side: 0 | 1, n: number) => Array.from({ length: n }, () => game(side)).flat();
/** Alternating games from 0-0 to n-n (side 0 wins the first). */
const gamesAll = (n: number) => Array.from({ length: n }, () => [...game(0), ...game(1)]).flat();

describe('tennis plugin: tennis', () => {
  const tennis = scorerFor('tennis');

  it('counts 15 / 30 / 40 / game', () => {
    expect([1, 2, 3].map((n) => play(tennis, ...times(0, n)).summary.sides[0]!.current)).toEqual(['15', '30', '40']);
    const { summary } = play(tennis, ...game(0));
    expect(summary.segments[0]!.scores).toEqual([1, 0]);
    expect(summary.sides[0]!.current).toBe('0');
  });

  it('plays deuce and advantage', () => {
    const deuce = alternate(6);
    expect(play(tennis, ...deuce).summary.callout).toBe('Deuce');
    const adv = play(tennis, ...deuce, 1).summary;
    expect(adv.callout).toBe('Advantage');
    expect(adv.sides.map((s) => s.current)).toEqual(['40', 'AD']);
    expect(play(tennis, ...deuce, 1, 0).summary.callout).toBe('Deuce');
    expect(play(tennis, ...deuce, 1, 0, 0, 0).summary.segments[0]!.scores).toEqual([1, 0]);
  });

  it('plays a tiebreak at 6-6, first to 7 by 2', () => {
    const at66 = gamesAll(6);
    const tb = play(tennis, ...at66).summary;
    expect(tb.segments[0]!.scores).toEqual([6, 6]);
    expect(tb.callout).toBe('Tiebreak');
    expect(tb.segments[0]!.children.at(-1)!.type).toBe('tiebreak');
    // 6-6 in the tiebreak, then side 1 wins 8-6.
    const set = play(tennis, ...at66, ...alternate(12), 1, 1).summary;
    expect(set.segments[0]).toMatchObject({ scores: [6, 7], winnerSideIndex: 1, complete: true });
    expect(set.headline).toBe('6-7(6)');
  });

  it('changes serve after the first tiebreak point, then every two points', () => {
    const at66 = gamesAll(6);
    const first = play(tennis, ...at66).summary.sides.findIndex((s) => s.serving);
    const servers = [0, 1, 2, 3, 4, 5].map((n) => play(tennis, ...at66, ...times(0, n)).summary.sides.findIndex((s) => s.serving));
    const o = 1 - first;
    expect(servers).toEqual([first, o, o, first, first, o]);
  });

  it('alternates the serve every game and rotates doubles partners', () => {
    const doubles = scorerFor('tennis', undefined, 2);
    const server = (n: number) => {
      const s = play(doubles, ...games(0, n)).summary.sides.find((x) => x.serving)!;
      return `${s.index}:${s.serverPlayerIndex}`;
    };
    expect([0, 1, 2, 3, 4].map(server)).toEqual(['0:0', '1:0', '0:1', '1:1', '0:0']);
  });

  it('wins best of 3 sets and rejects further points', () => {
    const result = play(tennis, ...games(0, 12));
    expect(result.summary).toMatchObject({ complete: true, winnerSideIndex: 0, headline: '6-0, 6-0' });
    expect(result.summary.totals).toMatchObject({ major: [2, 0], minor: [12, 0] });
    expect(() => replay(tennis, [...rally(...games(0, 12)), { type: 'rally_won', sideIndex: 1 }])).toThrow(ScoringError);
  });

  it('plays a match tiebreak to 10 instead of the final set', () => {
    const mtb = scorerFor('tennis', 'bo3-match-tiebreak');
    const oneAll = [...games(0, 6), ...games(1, 6)];
    expect(play(mtb, ...oneAll).summary.callout).toBe('Match tiebreak');
    const at99 = [...oneAll, ...alternate(18)];
    expect(play(mtb, ...at99, 0).summary.complete).toBe(false);
    const done = play(mtb, ...at99, 0, 0).summary;
    expect(done).toMatchObject({ complete: true, winnerSideIndex: 0, headline: '6-0, 0-6, [11-9]' });
    expect(done.segments[2]).toMatchObject({ type: 'match_tiebreak', scores: [11, 9] });
  });

  it('undoes by replaying all events but the last', () => {
    const events = rally(...alternate(7));
    expect(replay(tennis, events.slice(0, -1)).summary.callout).toBe('Deuce');
  });

  it('builds events for a manual result', () => {
    const events = manualResultEvents(tennis, [[6, 4], [6, 7], [7, 5]]);
    expect(replay(tennis, events).summary).toMatchObject({ complete: true, winnerSideIndex: 0, headline: '6-4, 6-7(0), 7-5' });
    expect(() => manualResultEvents(tennis, [[6, 5], [6, 0]])).toThrow(ScoringError);
  });
});

describe('tennis plugin: padel', () => {
  it('plays a golden point at 40-40', () => {
    const golden = scorerFor('padel', 'bo3-golden-point', 2);
    const at4040 = play(golden, ...alternate(6)).summary;
    expect(at4040.callout).toBe('Golden point');
    expect(at4040.sides.map((s) => s.current)).toEqual(['40', '40']);
    expect(play(golden, ...alternate(6), 1).summary.segments[0]!.scores).toEqual([0, 1]);
  });

  it('plays advantage by default', () => {
    const padel = scorerFor('padel', undefined, 2);
    expect(play(padel, ...alternate(6), 1).summary.segments[0]!.scores).toEqual([0, 0]);
  });

  it('is doubles only', () => {
    const config = scorerFor('padel', undefined, 2).config;
    expect(() => createScorer(scoringRegistry, 'tennis', config, [{ index: 0, playerCount: 1 }, { index: 1, playerCount: 1 }])).toThrow('doubles');
  });

  it('plays a golden-point super tiebreak decider', () => {
    const padel = scorerFor('padel', 'bo3-golden-super-tiebreak', 2);
    const { summary } = play(padel, ...games(0, 6), ...games(1, 6), ...times(1, 10));
    expect(summary).toMatchObject({ complete: true, winnerSideIndex: 1, headline: '6-0, 0-6, [0-10]' });
  });
});
