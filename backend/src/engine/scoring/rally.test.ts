import { describe, expect, it } from 'vitest';
import { manualResultEvents, replay, ScoringError } from './index.js';
import { alternate, play, rally, scorerFor, times } from './test-helpers.js';

describe('rally plugin: badminton', () => {
  const singles = scorerFor('badminton');

  it('plays a normal game to 21 and starts the next one', () => {
    const { summary } = play(singles, ...times(1, 15), ...times(0, 21));
    expect(summary.segments[0]).toMatchObject({ type: 'game', scores: [21, 15], winnerSideIndex: 0, complete: true });
    expect(summary.segments[1]).toMatchObject({ scores: [0, 0], complete: false });
    expect(summary.sides.map((s) => s.primary)).toEqual(['1', '0']);
    expect(summary.headline).toBe('21-15');
  });

  it('needs a 2-point lead from 20-20 (deuce)', () => {
    const deuce = [...alternate(40)];
    expect(play(singles, ...deuce, 0).summary.segments[0]).toMatchObject({ scores: [21, 20], complete: false });
    expect(play(singles, ...deuce, 0, 1, 0, 0).summary.segments[0]).toMatchObject({ scores: [23, 21], winnerSideIndex: 0 });
  });

  it('caps the game at 30: from 29-29 the next point wins it', () => {
    const at29 = alternate(58);
    const before = play(singles, ...at29).summary;
    expect(before.segments[0]).toMatchObject({ scores: [29, 29], complete: false });
    expect(before.callout).toBe('Game point');
    expect(play(singles, ...at29, 1).summary.segments[0]).toMatchObject({ scores: [29, 30], winnerSideIndex: 1, complete: true });
  });

  it('finishes best of 3 and rejects further rallies', () => {
    const events = rally(...times(0, 21), ...times(1, 21), ...times(0, 21));
    const result = replay(singles, events);
    expect(result.complete).toBe(true);
    expect(result.summary).toMatchObject({ winnerSideIndex: 0, headline: '21-0, 0-21, 21-0', actions: [] });
    expect(result.summary.totals).toMatchObject({ major: [2, 1], minor: [42, 21] });
    expect(() => replay(singles, [...events, { type: 'rally_won', sideIndex: 1 }])).toThrow(ScoringError);
  });

  it('serves from the right court on an even score and the left on odd (singles)', () => {
    expect(play(singles).summary.sides[0]).toMatchObject({ serving: true, serveNote: 'Right court' });
    expect(play(singles, 0).summary.sides[0]).toMatchObject({ serving: true, serveNote: 'Left court' });
    // Receiver wins the rally at 1-0: they serve at 1 (odd) from the left.
    expect(play(singles, 0, 1).summary.sides[1]).toMatchObject({ serving: true, serveNote: 'Left court' });
    expect(play(singles, 0, 1, 1).summary.sides[1]).toMatchObject({ serving: true, serveNote: 'Right court' });
  });

  it('keeps the same doubles server while the serving side scores, and picks the court player on a change of serve', () => {
    const doubles = scorerFor('badminton', undefined, 2);
    expect(play(doubles, 0, 0).summary.sides[0]).toMatchObject({ serving: true, serverPlayerIndex: 0 });
    // Side 1 wins serve at 0-1: the player in their left (odd) court serves.
    expect(play(doubles, 0, 1).summary.sides[1]).toMatchObject({ serving: true, serverPlayerIndex: 1, serveNote: 'Left court' });
    // Side 1 scores again: same server, now from the right court.
    expect(play(doubles, 0, 1, 1).summary.sides[1]).toMatchObject({ serverPlayerIndex: 1, serveNote: 'Right court' });
  });

  it('lets the game winner serve first in the next game', () => {
    expect(play(singles, ...times(1, 21)).summary.sides[1]!.serving).toBe(true);
  });
});

describe('rally plugin: table tennis', () => {
  const tt = scorerFor('table-tennis');
  const servingSide = (...sides: Array<0 | 1>) => play(tt, ...sides).summary.sides.findIndex((s) => s.serving);

  it('changes serve every 2 points', () => {
    expect([0, 1, 2, 3, 4].map((n) => servingSide(...times(0, n)))).toEqual([0, 0, 1, 1, 0]);
  });

  it('changes serve every point from 10-10', () => {
    const at1010 = alternate(20);
    expect(play(tt, ...at1010).summary.segments[0]!.scores).toEqual([10, 10]);
    const first = servingSide(...at1010);
    expect(servingSide(...at1010, 0)).toBe(1 - first);
    expect(servingSide(...at1010, 0, 1)).toBe(first);
    expect(servingSide(...at1010, 0, 1, 1)).toBe(1 - first);
    expect(play(tt, ...at1010, 0, 0).summary.segments[0]).toMatchObject({ scores: [12, 10], winnerSideIndex: 0 });
  });

  it('alternates the first server each game', () => {
    expect(servingSide(...times(0, 11))).toBe(1);
    expect(servingSide(...times(0, 22))).toBe(0);
  });

  it('plays best of 5 by default and best of 7 when configured', () => {
    expect(play(tt, ...times(0, 33)).complete).toBe(true);
    const bo7 = scorerFor('table-tennis', 'ittf-11x7');
    expect(play(bo7, ...times(0, 33)).complete).toBe(false);
    expect(play(bo7, ...times(0, 44)).summary).toMatchObject({ complete: true, winnerSideIndex: 0 });
  });

  it('rotates doubles servers within each side', () => {
    const doubles = scorerFor('table-tennis', undefined, 2);
    const server = (...s: Array<0 | 1>) => {
      const side = play(doubles, ...s).summary.sides.find((x) => x.serving)!;
      return `${side.index}:${side.serverPlayerIndex}`;
    };
    expect([0, 2, 4, 6, 8].map((n) => server(...times(0, n)))).toEqual(['0:0', '1:0', '0:1', '1:1', '0:0']);
  });
});

describe('rally plugin: generic behaviour', () => {
  const badminton = scorerFor('badminton');

  it('undoes by replaying all events but the last', () => {
    const events = rally(...alternate(41));
    const undone = replay(badminton, events.slice(0, -1));
    expect(undone).toEqual(replay(badminton, rally(...alternate(40))));
    expect(undone.summary.segments[0]!.scores).toEqual([20, 20]);
  });

  it('plays a volleyball-style deciding set to 15', () => {
    const volleyball = scorerFor('volleyball', undefined, 6);
    const { summary } = play(volleyball, ...times(0, 25), ...times(1, 25), ...times(0, 25), ...times(1, 25), ...times(1, 15));
    expect(summary).toMatchObject({ complete: true, winnerSideIndex: 1 });
    expect(summary.segments[4]).toMatchObject({ type: 'set', label: 'Set 5', scores: [0, 15] });
  });

  it('builds events for a manual result and rejects impossible scores', () => {
    const events = manualResultEvents(badminton, [[21, 15], [18, 21], [30, 29]]);
    expect(replay(badminton, events).summary).toMatchObject({ complete: true, winnerSideIndex: 0, headline: '21-15, 18-21, 30-29' });
    expect(() => manualResultEvents(badminton, [[21, 20], [21, 0]])).toThrow(ScoringError);
    expect(() => manualResultEvents(badminton, [[21, 15]])).toThrow('does not finish');
    expect(() => manualResultEvents(badminton, [[21, 21]])).toThrow(ScoringError);
  });
});
