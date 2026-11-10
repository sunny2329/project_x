import { describe, expect, it } from 'vitest';
import { SPORTS } from '../../catalog/sports.js';
import { createScorer, manualResultEvents, parseEvent, replay, rulesName, scoringRegistry, ScoringError, type PluginEvent, type ScoreSummary } from './index.js';
import { scorerFor } from './test-helpers.js';

const ball = (runs: number, extra: 'none' | 'wide' | 'no_ball' = 'none', wicket = false): PluginEvent => ({ type: 'ball', runs, extra, wicket }) as PluginEvent;
const out = ball(0, 'none', true);
const end: PluginEvent = { type: 'innings_end' };
const balls = (n: number, runs = 0) => Array.from({ length: n }, () => ball(runs));

/** One over, two wickets, so a test needs few balls. */
const quick = (overrides: Record<string, unknown> = {}) => scorerFor('box-cricket', undefined, 6, { overs: 1, wickets: 2, ...overrides });
const play = (events: PluginEvent[], overrides: Record<string, unknown> = {}) => replay(quick(overrides), events).summary;
const innings = (s: ScoreSummary, period: number, n: number) => s.segments[period]!.children[n]!;

describe('overs (box cricket): an innings', () => {
  it('starts with side 0 batting, nothing scored and every run button on offer', () => {
    const s = play([]);
    expect(s).toMatchObject({ complete: false, winnerSideIndex: null, callout: null, ticker: [], headline: '0/0 v -' });
    expect(s.sides.map((x) => [x.primary, x.serving])).toEqual([['0/0', true], ['-', false]]);
    expect(s.actions.map((a) => a.id)).toEqual(['ball-0', 'ball-1', 'ball-2', 'ball-3', 'ball-4', 'ball-5', 'ball-6', 'innings-end', 'swap-batting']);
    expect(s.actions.every((a) => a.sideIndex === null)).toBe(true);
  });

  it('adds runs and counts legal balls into overs', () => {
    const s = play([ball(4), ball(1), ball(0)]);
    expect(innings(s, 0, 0)).toMatchObject({ scores: [5, 0], display: ['5/0 (0.3)', ''], complete: false });
    expect(s.ticker).toEqual(['4', '1', '•']);
  });

  it('charges a run for wides and no-balls, does not count them as balls, and adds runs off them', () => {
    const s = play([ball(0, 'wide'), ball(2, 'no_ball'), ball(1, 'wide')]);
    expect(innings(s, 0, 0)).toMatchObject({ scores: [1 + 3 + 2, 0], display: ['6/0 (0.0)', ''] });
    expect(s.ticker).toEqual(['Wd', 'Nb+2', 'Wd+1']);
  });

  it('honours other wide and no-ball penalties', () => {
    expect(innings(play([ball(0, 'wide'), ball(0, 'no_ball')], { wideRuns: 0, noBallRuns: 2 }), 0, 0).scores[0]).toBe(2);
  });

  it('ends the innings after the overs, however many extras were bowled', () => {
    const s = play([ball(0, 'wide'), ...balls(5, 1), ball(0, 'no_ball'), ball(1)]);
    expect(innings(s, 0, 0)).toMatchObject({ complete: true, display: ['8/0 (1.0)', ''] });
    expect(s.sides.map((x) => x.serving)).toEqual([false, true]);
    expect(s.ticker).toEqual([]);
  });

  it('ends the innings when the wickets fall, including on a wide or no-ball', () => {
    expect(innings(play([out, ball(1), out]), 0, 0)).toMatchObject({ complete: true, display: ['1/2 (0.3)', ''] });
    expect(innings(play([ball(0, 'wide', true), ball(0, 'no_ball', true)]), 0, 0)).toMatchObject({ complete: true, display: ['2/2 (0.0)', ''] });
  });

  it('keeps the finished over on the ticker until the next ball', () => {
    const scorer = quick({ overs: 2 });
    expect(replay(scorer, balls(6, 1)).summary.ticker).toEqual(['1', '1', '1', '1', '1', '1']);
    expect(replay(scorer, [...balls(6, 1), ball(4)]).summary.ticker).toEqual(['4']);
    expect(replay(scorer, [ball(1), ball(0, 'wide'), ...balls(5), ball(0, 'wide'), ball(2)]).summary.ticker).toEqual(['Wd', '2']);
  });

  it('can be ended early, even before a ball', () => {
    expect(play([ball(3), end]).sides[1]!.serving).toBe(true);
    expect(innings(play([end]), 0, 0)).toMatchObject({ complete: true, display: ['0/0 (0.0)', ''] });
  });
});

describe('overs: the toss', () => {
  it('lets the other side bat first by config', () => {
    const s = play([ball(4)], { battingFirstSideIndex: 1 });
    expect(s.sides.map((x) => x.primary)).toEqual(['-', '4/0']);
    expect(s.headline).toBe('- v 4/0');
    expect(innings(s, 0, 0).scores).toEqual([0, 4]);
  });

  it('swaps by event before the first ball only, and undoes by replay', () => {
    const swap: PluginEvent = { type: 'swap_batting' };
    expect(play([swap]).sides[1]!.serving).toBe(true);
    expect(play([swap, swap]).sides[0]!.serving).toBe(true);
    expect(play([swap, ball(1)]).actions.some((a) => a.id === 'swap-batting')).toBe(false);
    expect(() => play([ball(1), swap])).toThrow('before the first ball');
    expect(() => play([ball(0, 'wide'), swap])).toThrow('before the first ball');
    expect(() => play([end, swap])).toThrow('before the first ball');
  });
});

describe('overs: the result', () => {
  it('shows the chase and ends as soon as the target is passed', () => {
    const live = play([ball(6), end, ball(2)]);
    expect(live).toMatchObject({ complete: false, callout: 'Need 5 off 5 balls' });
    const done = play([ball(6), end, ball(2), ball(4), ball(1)]);
    expect(done).toMatchObject({ complete: true, winnerSideIndex: 1, callout: 'Won by 2 wickets', actions: [] });
    expect(done.totals).toEqual({ major: [0, 1], minor: [6, 7], majorLabel: 'Wins', minorLabel: 'Runs' });
    expect(done.segments[0]).toMatchObject({ type: 'regulation', complete: true, scores: [6, 7], winnerSideIndex: 1 });
  });

  it('gives the side batting first the win by runs', () => {
    const done = play([ball(6), ball(1), end, ball(2), end]);
    expect(done).toMatchObject({ complete: true, winnerSideIndex: 0, callout: 'Won by 5 runs', headline: '7/0 v 2/0' });
    expect(play([ball(3), end, ball(2), end]).callout).toBe('Won by 1 run');
  });

  it('counts a chase won off a wide, and uses the singular for one ball and one wicket', () => {
    expect(play([ball(1), end, ball(0, 'wide'), ball(0, 'wide')])).toMatchObject({ complete: true, winnerSideIndex: 1 });
    expect(play([ball(1), end, ...balls(5)]).callout).toBe('Need 2 off 1 ball');
    expect(play([ball(1), end, out, ball(2)]).callout).toBe('Won by 1 wicket');
  });

  it('refuses anything after the match is decided', () => {
    expect(() => replay(quick(), [ball(1), end, ball(2), ball(1)])).toThrow(ScoringError);
  });

  it('rejects impossible and malformed balls', () => {
    const { plugin } = quick();
    expect(() => parseEvent(plugin, ball(7))).toThrow(ScoringError);
    expect(() => parseEvent(plugin, ball(-1))).toThrow(ScoringError);
    expect(() => parseEvent(plugin, { type: 'ball', runs: 1.5 })).toThrow(ScoringError);
    expect(() => parseEvent(plugin, { type: 'ball', runs: 1, extra: 'bye' })).toThrow(ScoringError);
    expect(() => parseEvent(plugin, { type: 'rally_won', sideIndex: 0 })).toThrow(ScoringError);
    expect(parseEvent(plugin, { type: 'ball', runs: 1 })).toEqual({ type: 'ball', runs: 1, extra: 'none', wicket: false });
  });
});

describe('overs: a tied match', () => {
  const tied = [ball(3), end, ball(3), end];

  it('goes to a super over with the side that batted second batting first', () => {
    const s = play(tied);
    expect(s).toMatchObject({ complete: false, winnerSideIndex: null, callout: 'Super over' });
    expect(s.sides.map((x) => x.serving)).toEqual([false, true]);
    expect(s.sides.map((x) => x.primary)).toEqual(['-', '0/0']);
    expect(s.segments[0]).toMatchObject({ complete: true, scores: [3, 3], winnerSideIndex: null });
    expect(s.segments[1]).toMatchObject({ type: 'super_over', sequence: 2, complete: false });
  });

  it('decides on the super over, with the match runs as the totals', () => {
    const s = play([...tied, ball(4), end, ball(6)]);
    expect(s).toMatchObject({ complete: true, winnerSideIndex: 0, callout: 'Won the super over', headline: '3/0 v 3/0, SO 6/0 v 4/0' });
    expect(s.totals).toMatchObject({ major: [1, 0], minor: [3, 3] });
    expect(s.segments[1]).toMatchObject({ winnerSideIndex: 0, scores: [6, 4] });
  });

  it('plays another super over if that is level too, and applies its own limits', () => {
    const again = play([...tied, ball(1), end, ball(1), end]);
    expect(again.complete).toBe(false);
    expect(again.segments).toHaveLength(3);
    expect(again.sides.map((x) => x.serving)).toEqual([true, false]);
    // Default super over: 2 wickets, 1 over, whatever the match was.
    const scorer = scorerFor('box-cricket', undefined, 6, { overs: 1, wickets: 5 });
    const twoDown = replay(scorer, [...tied, out, out]).summary;
    expect(twoDown.sides.map((x) => x.primary)).toEqual(['0/0', '0/2']);
    expect(twoDown.sides[0]!.serving).toBe(true);
  });

  it('undoing into the match removes the super over', () => {
    const before = play([ball(3), end, ball(3)]);
    expect(before.segments).toHaveLength(1);
    expect(before.callout).toBe('Need 1 off 5 balls');
  });
});

describe('overs: results entered afterwards', () => {
  const scorer = quick();

  it('replays a typed-in score, showing only what was typed', () => {
    const r = replay(scorer, manualResultEvents(scorer, [[48, 45]])).summary;
    expect(r).toMatchObject({ complete: true, winnerSideIndex: 0, headline: '48 v 45', callout: 'Won by 3 runs' });
    expect(r.segments.filter((s) => s.complete).map((s) => s.scores)).toEqual([[48, 45]]);
    // More than the overs could produce is fine: a total has no balls behind it, and the chaser can win.
    expect(replay(scorer, manualResultEvents(scorer, [[20, 200]])).summary).toMatchObject({ winnerSideIndex: 1, callout: 'Won by 180 runs' });
  });

  it('takes a super over as a second row', () => {
    const r = replay(scorer, manualResultEvents(scorer, [[48, 48], [12, 8]])).summary;
    expect(r).toMatchObject({ complete: true, winnerSideIndex: 0, headline: '48 v 48, SO 12 v 8' });
  });

  it('refuses a level score, extra rows and no rows', () => {
    expect(() => manualResultEvents(scorer, [[48, 48]])).toThrow('does not finish');
    expect(() => manualResultEvents(scorer, [[48, 45], [1, 0]])).toThrow('not possible');
    expect(() => manualResultEvents(scorer, [])).toThrow('both sides');
    expect(() => manualResultEvents(scorer, [[48]])).toThrow(ScoringError);
    expect(() => manualResultEvents(scorer, [[-1, 4]])).toThrow(ScoringError);
  });

  it('will not overwrite an innings already being scored ball by ball', () => {
    expect(() => play([ball(1), { type: 'innings_total', runs: 40 } as PluginEvent])).toThrow('already has balls');
  });
});

describe('overs: setup', () => {
  it('takes uneven teams of 1 to 11, and only two sides', () => {
    const sides = (...counts: number[]) => counts.map((playerCount, index) => ({ index, playerCount }));
    const config = { overs: 6, wickets: 5 };
    expect(() => createScorer(scoringRegistry, 'overs', config, sides(1, 11))).not.toThrow();
    expect(() => createScorer(scoringRegistry, 'overs', config, sides(6, 12))).toThrow('1 to 11');
    expect(() => createScorer(scoringRegistry, 'overs', config, sides(6, 6, 6))).toThrow('two sides');
  });

  it('rejects bad rules', () => {
    const sides = [{ index: 0, playerCount: 6 }, { index: 1, playerCount: 6 }];
    for (const config of [{ wickets: 5 }, { overs: 0, wickets: 5 }, { overs: 6 }, { overs: 6, wickets: 12 }, { overs: 51, wickets: 5 }, { overs: 6, wickets: 5, ballsPerOver: 0 }, { overs: 6, wickets: 5, wideRuns: 3 }, { overs: 6, wickets: 5, playersPerSide: 12 }, { overs: 6, wickets: 5, battingFirstSideIndex: 2 }]) {
      expect(() => createScorer(scoringRegistry, 'overs', config, sides), JSON.stringify(config)).toThrow(ScoringError);
    }
  });

  it('caps each side at the players a side, and never lets wickets outnumber them', () => {
    const sides = (...counts: number[]) => counts.map((playerCount, index) => ({ index, playerCount }));
    const config = { overs: 6, wickets: 5, playersPerSide: 6 };
    expect(() => createScorer(scoringRegistry, 'overs', config, sides(6, 1))).not.toThrow();
    expect(() => createScorer(scoringRegistry, 'overs', config, sides(6, 7))).toThrow('1 to 6');
    // Last man stands: as many wickets as players.
    expect(() => createScorer(scoringRegistry, 'overs', { ...config, wickets: 6 }, sides(6, 6))).not.toThrow();
    expect(() => createScorer(scoringRegistry, 'overs', { ...config, wickets: 7 }, sides(6, 6))).toThrow('Wickets can’t be more');
    expect(() => createScorer(scoringRegistry, 'overs', { ...config, superOverWickets: 7 }, sides(6, 6))).toThrow('Super over wickets');
  });

  it('plays every changed rule: overs, wickets, balls an over, extras and the super over', () => {
    const rules = { overs: 2, wickets: 3, ballsPerOver: 4, wideRuns: 2, noBallRuns: 0, superOverOvers: 2, superOverWickets: 1 };
    // 2 overs of 4 balls: the 8th legal ball ends the innings; extras cost what the rules say.
    const first = play([ball(0, 'wide'), ball(0, 'no_ball'), ...balls(7, 1)], rules);
    expect(innings(first, 0, 0)).toMatchObject({ scores: [9, 0], display: ['9/0 (1.3)', ''] });
    const all = play([ball(0, 'wide'), ball(0, 'no_ball'), ...balls(8, 1)], rules);
    expect(all.sides[1]!.serving).toBe(true);
    expect(innings(all, 0, 0).display[0]).toBe('10/0 (2.0)');
    // Three wickets end the second innings level: a two-over, one-wicket super over follows.
    const tie = [...balls(8, 1), ...balls(4, 2), out, out, out];
    expect(play(tie, rules).callout).toBe('Super over');
    expect(play([...tie, ...balls(7, 0)], rules).sides[1]!.serving).toBe(true);
    expect(play([...tie, out], rules).sides[0]!.serving).toBe(true);
  });

  it('names the rules as played', () => {
    const name = (config: Record<string, unknown>) => rulesName(scoringRegistry, 'overs', config, 'fallback');
    expect(name({ overs: 6, wickets: 5 })).toBe('6 overs · 5 wickets');
    expect(name({ overs: 1, wickets: 1, playersPerSide: 8, ballsPerOver: 4 })).toBe('1 over · 1 wicket · 8 a side · 4-ball overs');
    expect(name({ overs: 0, wickets: 5 })).toBe('fallback');
    expect(rulesName(scoringRegistry, 'rally', { pointsToWin: 21 }, 'Best of 3')).toBe('Best of 3');
    expect(rulesName(scoringRegistry, 'no_such_model', {}, null)).toBeNull();
  });

  it('is an active catalog sport whose every ruleset scores a whole match', () => {
    const sport = SPORTS.find((s) => s.slug === 'box-cricket')!;
    expect(sport).toMatchObject({ isActive: true, scoringModel: 'overs' });
    for (const r of sport.rulesets) {
      const scorer = scorerFor('box-cricket', r.slug, 6);
      const { overs } = r.config as { overs: number };
      const first = replay(scorer, balls(overs * 6, 1)).summary;
      expect(first.sides[1]!.serving, r.slug).toBe(true);
      expect(replay(scorer, [...balls(overs * 6, 1), ...balls(overs * 6, 0)]).summary, r.slug).toMatchObject({ complete: true, winnerSideIndex: 0 });
    }
  });

  it('never mutates the state it is given', () => {
    const { plugin, config, sides } = quick();
    const start = plugin.initialState(config, sides);
    const snapshot = JSON.stringify(start);
    plugin.applyEvent(start, parseEvent(plugin, ball(4)), config);
    plugin.applyEvent(start, end, config);
    expect(JSON.stringify(start)).toBe(snapshot);
  });
});
