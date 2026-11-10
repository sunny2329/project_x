import { act } from 'react';
import { createRoot, type TestInstance } from 'test-renderer';
import { createScorer, replay, scoringRegistry } from '@/engine/scoring';
import type { PluginEvent, ScoreSummary, ScoringAction } from '../types';
import { lineupProblem } from '../lineup';
import { changeRule, EDITABLE_RULES, maxPlayersPerSide, overrideFrom, ruleMax, rulesetDetail, rulesTitle, ruleValue } from '../rules';
import { CricketPad, CricketScoreboard, oversOf } from './CricketBoard';
import { checkResult, rowsFor } from './ResultGrid';
import { segmentShort, unitLabel } from './Scoreboard';

jest.mock('expo-router', () => ({ router: {}, useFocusEffect: jest.fn(), useLocalSearchParams: jest.fn() }));

const config = { overs: 1, wickets: 2 };
const sides = [
  { index: 0, playerCount: 3 },
  { index: 1, playerCount: 1 },
];
const scorer = createScorer(scoringRegistry, 'overs', config, sides);
const summary = (events: unknown[]) => replay(scorer, events).summary as ScoreSummary;
const ball = (runs: number) => ({ type: 'ball', runs, extra: 'none', wicket: false });
const END = { type: 'innings_end' };

async function renderPad(onBall: (event: PluginEvent) => void) {
  const root = createRoot();
  await act(async () => {
    root.render(<CricketPad actions={summary([]).actions as ScoringAction[]} color="#22C55E" onBall={onBall} />);
  });
  const press = async (label: string) => {
    // Only host views are visible here: a Pressable's press arrives as its View's onClick.
    const button = root.container.queryAll((n: TestInstance) => n.props.accessibilityLabel === label)[0]!;
    await act(async () => button.props.onClick({ persist: () => undefined, nativeEvent: {} }));
  };
  return { press };
}

describe('CricketPad', () => {
  it('records a plain ball with one tap', async () => {
    const onBall = jest.fn();
    const { press } = await renderPad(onBall);
    await press('4 runs');
    expect(onBall).toHaveBeenCalledWith({ type: 'ball', runs: 4, extra: 'none', wicket: false });
  });

  it('arms wide, no-ball and wicket for the next number only', async () => {
    const onBall = jest.fn();
    const { press } = await renderPad(onBall);
    await press('Wicket');
    expect(onBall).not.toHaveBeenCalled();
    await press('No ball');
    await press('1 run');
    expect(onBall).toHaveBeenLastCalledWith({ type: 'ball', runs: 1, extra: 'no_ball', wicket: true });
    await press('0 runs');
    expect(onBall).toHaveBeenLastCalledWith({ type: 'ball', runs: 0, extra: 'none', wicket: false });
  });

  it('lets a toggle be switched off, and wide replaces no-ball', async () => {
    const onBall = jest.fn();
    const { press } = await renderPad(onBall);
    await press('Wide');
    await press('Wide');
    await press('2 runs');
    expect(onBall).toHaveBeenLastCalledWith({ type: 'ball', runs: 2, extra: 'none', wicket: false });
    await press('No ball');
    await press('Wide');
    await press('0 runs');
    expect(onBall).toHaveBeenLastCalledWith({ type: 'ball', runs: 0, extra: 'wide', wicket: false });
  });

  it('sends only events the engine accepts', async () => {
    const onBall = jest.fn();
    const { press } = await renderPad(onBall);
    await press('Wide');
    await press('Wicket');
    await press('6 runs');
    expect(() => replay(scorer, [onBall.mock.calls[0][0]])).not.toThrow();
  });
});

describe('CricketScoreboard', () => {
  it('renders the batting side and the side yet to bat', async () => {
    const root = createRoot();
    await act(async () => {
      root.render(<CricketScoreboard score={summary([ball(4)])} names={['Kings', 'Lions']} slug="box-cricket" />);
    });
    const text = JSON.stringify(root.container.toJSON());
    for (const expected of ['Kings', 'Lions', 'Batting', 'Yet to bat', '4/0']) expect(text).toContain(expected);
  });
});

describe('cricket labels', () => {
  it('reads overs from the innings in play', () => {
    const s = summary([ball(1), ball(1)]);
    expect(oversOf(s, 0)).toBe('0.2');
    expect(oversOf(s, 1)).toBeNull();
  });

  it('names the unit and columns', () => {
    expect(unitLabel(summary([]))).toBe('1st innings');
    expect(unitLabel(summary([END]))).toBe('2nd innings');
    const tied = summary([END, END]);
    expect(unitLabel(tied)).toBe('Super over 1');
    expect(tied.segments.map((s) => segmentShort(tied, s))).toEqual(['INN', 'SO1']);
    expect(unitLabel(summary([ball(1), END, ball(2)]))).toBe('Final');
  });

  it('describes a ruleset', () => {
    expect(rulesetDetail({ scoringModel: 'overs', config })).toBe('6 balls an over · super over if tied');
  });
});

describe('entering a cricket result', () => {
  const ruleset = { scoringModel: 'overs', config };
  const check = (cells: string[][]) => checkResult(ruleset, cells, [3, 1]);

  it('offers the match and a super over row', () => {
    expect(rowsFor(ruleset)).toBe(2);
  });

  it('accepts unequal runs from one row', () => {
    expect(check([['48', '45']])).toMatchObject({ complete: true, message: null, filled: [[48, 45]] });
  });

  it('waits for a super over when the runs are level', () => {
    expect(check([['48', '48']])).toMatchObject({ complete: false, message: null });
    expect(check([['48', '48'], ['12', '8']])).toMatchObject({ complete: true });
  });

  it('explains a level super over and a super over nobody needed', () => {
    expect(check([['48', '48'], ['8', '8']])).toMatchObject({ complete: false, message: expect.stringContaining('does not finish') });
    expect(check([['48', '45'], ['8', '1']])).toMatchObject({ complete: false, message: expect.stringContaining('not possible') });
  });
});

describe('changing cricket rules', () => {
  const base = { overs: 6, wickets: 5 };
  const rule = (key: string) => EDITABLE_RULES.overs!.find((r) => r.key === key)!;

  it('offers players, overs, wickets, balls an over, extras and the super over', () => {
    expect(EDITABLE_RULES.overs!.map((r) => r.key)).toEqual(['playersPerSide', 'overs', 'wickets', 'ballsPerOver', 'wideRuns', 'noBallRuns', 'superOverOvers', 'superOverWickets']);
  });

  it('starts each stepper from the ruleset, else the engine default', () => {
    expect(ruleValue(rule('overs'), base)).toBe(6);
    expect(ruleValue(rule('ballsPerOver'), base)).toBe(6);
    expect(ruleValue(rule('playersPerSide'), base)).toBe(11);
    expect(ruleValue(rule('superOverWickets'), base)).toBe(2);
  });

  it('pulls the wickets down with the players a side, and caps them there', () => {
    const fewer = changeRule('overs', base, {}, 'playersPerSide', 4);
    expect(fewer).toEqual({ playersPerSide: 4, wickets: 4 });
    expect(changeRule('overs', base, { superOverWickets: 3 }, 'playersPerSide', 2)).toEqual({ playersPerSide: 2, wickets: 2, superOverWickets: 2 });
    expect(changeRule('overs', base, {}, 'playersPerSide', 8)).toEqual({ playersPerSide: 8 });
    expect(ruleMax('overs', rule('wickets'), { ...base, ...fewer })).toBe(4);
    expect(ruleMax('overs', rule('wickets'), base)).toBe(11);
    // Whatever the sheet builds, the engine accepts.
    expect(() => createScorer(scoringRegistry, 'overs', { ...base, ...fewer }, sides)).not.toThrow();
  });

  it('names the changed rules and caps the lineup', () => {
    const ruleset = { name: '6 overs · 5 wickets', scoringModel: 'overs', config: base };
    expect(rulesTitle(ruleset, {})).toBe('6 overs · 5 wickets');
    expect(rulesTitle(ruleset, { overs: 5, playersPerSide: 6 })).toBe('5 overs · 5 wickets · 6 a side');
    expect(rulesTitle({ name: 'Best of 3', scoringModel: 'rally', config: { pointsToWin: 21 } }, { pointsToWin: 15 })).toBe('Best of 3 · changed');
    expect(maxPlayersPerSide(11, { ...base, playersPerSide: 6 })).toBe(6);
    expect(maxPlayersPerSide(11, base)).toBe(11);
    expect(lineupProblem([[], []].map(() => Array.from({ length: 7 }, (_, i) => ({ key: `p${i}`, displayName: 'P', isGuest: true, userId: null, input: { guest: { displayName: 'P' } } }))), { minPerSide: 1, maxPerSide: 6 })).toBe(
      'Remove 1 player from your side (6 a side)',
    );
  });

  it('keeps a rematch on the rules as played, without the toss', () => {
    expect(overrideFrom('overs', base, { ...base, ballsPerOver: 6, wideRuns: 1, playersPerSide: 6, battingFirstSideIndex: 1 })).toEqual({ playersPerSide: 6 });
    expect(overrideFrom('overs', base, { overs: 4, wickets: 5, ballsPerOver: 4 })).toEqual({ overs: 4, ballsPerOver: 4 });
  });
});
