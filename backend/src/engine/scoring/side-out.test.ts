import { describe, expect, it } from 'vitest';
import { manualResultEvents, replay } from './index.js';
import { play, rally, scorerFor, times } from './test-helpers.js';

describe('side-out plugin: traditional pickleball', () => {
  const doubles = scorerFor('pickleball', undefined, 2);
  const singles = scorerFor('pickleball');
  const serving = (summary: ReturnType<typeof play>['summary']) => summary.sides.find((s) => s.serving)!;

  it('starts a doubles game at 0-0-2, so the first fault is a side out', () => {
    const start = play(doubles).summary;
    expect(start.callout).toBe('0-0-2');
    expect(serving(start)).toMatchObject({ index: 0, serverNumber: 2 });
    const afterFault = play(doubles, 1).summary;
    expect(serving(afterFault)).toMatchObject({ index: 1, serverNumber: 1, serverPlayerIndex: 0 });
    expect(afterFault.callout).toBe('0-0-1');
  });

  it('passes server 1 to server 2, then sides out', () => {
    // Side 1 has the serve (server 1); side 0 wins a rally: server 2 of side 1.
    const second = play(doubles, 1, 0).summary;
    expect(serving(second)).toMatchObject({ index: 1, serverNumber: 2, serverPlayerIndex: 1 });
    expect(second.actions.map((a) => a.label)).toEqual(['Side out', 'Point']);
    // Another fault: side out to side 0, server 1.
    expect(serving(play(doubles, 1, 0, 0).summary)).toMatchObject({ index: 0, serverNumber: 1 });
  });

  it('only lets the serving side score', () => {
    // Fault (side out), then a fault by side 1's server 1: nobody scores.
    expect(play(doubles, 1, 0).summary.segments[0]!.scores).toEqual([0, 0]);
    expect(play(doubles, 0, 0).summary.segments[0]!.scores).toEqual([2, 0]);
    expect(play(doubles, 0, 0).summary.callout).toBe('2-0-2');
  });

  it('keeps the same server and switches courts after a point', () => {
    const one = serving(play(doubles, 1, 1).summary);
    expect(one).toMatchObject({ index: 1, serverNumber: 1, serverPlayerIndex: 0, serveNote: 'Left court' });
  });

  it('sides out on every fault in singles', () => {
    expect(play(singles).summary.callout).toBe('0-0');
    expect(serving(play(singles, 1).summary)).toMatchObject({ index: 1, serverNumber: null });
    expect(play(singles, 1, 1, 1, 0).summary.callout).toBe('0-2');
  });

  it('wins at 11 by 2 and plays on from 10-10', () => {
    // Singles: each side scores while serving; side outs in between.
    const tenAll: Array<0 | 1> = [...times(0, 10), 1, ...times(1, 10)];
    expect(play(singles, ...tenAll).summary.segments[0]!.scores).toEqual([10, 10]);
    expect(play(singles, ...tenAll, 1).summary.complete).toBe(false);
    expect(play(singles, ...tenAll, 1, 1).summary).toMatchObject({ complete: true, winnerSideIndex: 1, headline: '10-12' });
  });

  it('supports games to 15 and 21', () => {
    expect(play(scorerFor('pickleball', 'side-out-15'), ...times(0, 15)).complete).toBe(true);
    expect(play(scorerFor('pickleball', 'side-out-21'), ...times(0, 20)).complete).toBe(false);
  });

  it('plays best of 3, alternating the first server each game', () => {
    const bo3 = scorerFor('pickleball', 'side-out-11x3');
    const afterGame1 = play(bo3, ...times(0, 11)).summary;
    expect(serving(afterGame1).index).toBe(1);
    expect(afterGame1.complete).toBe(false);
  });

  it('undoes by replaying all events but the last', () => {
    const events = rally(1, 0, 0, 1, 1);
    expect(replay(doubles, events.slice(0, -1))).toEqual(replay(doubles, rally(1, 0, 0, 1)));
  });

  it('builds events for a manual result', () => {
    const events = manualResultEvents(doubles, [[7, 11]]);
    expect(replay(doubles, events).summary).toMatchObject({ complete: true, winnerSideIndex: 1, headline: '7-11' });
  });
});
