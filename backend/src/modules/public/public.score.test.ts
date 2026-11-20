import { describe, expect, it } from 'vitest';
import { PUBLIC_PAGE_SCRIPT, publicPage } from './public.pages.js';
import { bestRuns, latestPoints, momentum, SCORE_HELPERS_JS, sparkPoints } from './public.score.js';

const r = (...sides: number[]) => sides.map((sideIndex) => ({ type: 'rally_won', sideIndex }));

describe('public scoreboard helpers', () => {
  it('momentum tracks side A’s running lead over the last rallies', () => {
    expect(momentum([...r(0, 0, 1), { type: 'timeout' }, ...r(0)], 10)).toEqual([0, 1, 2, 1, 2]);
    expect(momentum(r(0, 0, 0, 1, 1), 2)).toEqual([0, -1, -2]);
    expect(momentum([], 10)).toEqual([0]);
  });

  it('bestRuns finds each side’s longest streak', () => {
    expect(bestRuns(r(0, 0, 1, 1, 1, 0, 0, 0, 0))).toEqual([4, 3]);
    expect(bestRuns([{ type: 'rally_won', sideIndex: 'x' }, ...r(1)])).toEqual([0, 1]);
  });

  it('latestPoints rebuilds rally-scoring game scores backwards, newest first', () => {
    expect(latestPoints(r(1, 0, 0), 'rally', [14, 11], 3)).toEqual([
      { side: 0, score: '14-11' },
      { side: 0, score: '13-11' },
      { side: 1, score: '12-11' },
    ]);
  });

  it('stops scoring at the start of the game and leaves other sports unscored', () => {
    // Game 2 is 1-0; the rally before it belonged to game 1.
    expect(latestPoints(r(1, 0), 'rally', [1, 0], 3)).toEqual([{ side: 0, score: '1-0' }, { side: 1, score: null }]);
    expect(latestPoints(r(0, 1), 'side_out', [4, 7], 2)).toEqual([{ side: 1, score: null }, { side: 0, score: null }]);
    expect(latestPoints([], 'rally', [0, 0], 3)).toEqual([]);
  });

  it('sparkPoints maps a series into the box with 0 on the middle line', () => {
    expect(sparkPoints([0, 3, -3], 100, 40)).toBe('0.0,20.0 50.0,4.0 100.0,36.0');
    expect(sparkPoints([0], 100, 40)).toBe('');
  });

  it('the inlined source runs on its own in a browser-like scope', () => {
    const fns = new Function(`${SCORE_HELPERS_JS}; return { momentum, bestRuns, latestPoints, sparkPoints };`)() as {
      latestPoints: typeof latestPoints;
      bestRuns: typeof bestRuns;
    };
    expect(fns.latestPoints(r(0), 'rally', [3, 2], 1)).toEqual([{ side: 0, score: '3-2' }]);
    expect(fns.bestRuns(r(0, 0))).toEqual([2, 0]);
  });

  it('the whole page script parses and the page uses the v2 fonts', () => {
    expect(() => new Function(PUBLIC_PAGE_SCRIPT)).not.toThrow();
    expect(PUBLIC_PAGE_SCRIPT).toContain('function latestPoints');
    const html = publicPage('A <b> v B', 'match', 'tok');
    expect(html).toContain('Barlow+Condensed');
    expect(html).toContain('A &lt;b&gt; v B · ProjectX');
  });
});
