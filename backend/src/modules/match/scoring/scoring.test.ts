import { describe, expect, it } from 'vitest';
import { replay, ScoringError, type OversConfig, type ScoreEvent, type Side } from './index.js';
import { applyOptions, SPORT_RULES } from './sport-rules.js';

const points = (...sides: Side[]): ScoreEvent[] => sides.map((side) => ({ type: 'point', side }));
const repeat = (side: Side, n: number): Side[] => Array.from({ length: n }, () => side);
const ball = (runs: number, extra: 'none' | 'wide' | 'no_ball' = 'none', wicket = false): ScoreEvent => ({ type: 'ball', runs, extra, wicket });

describe('rally scoring', () => {
  const pickleball = SPORT_RULES.PICKLEBALL!.config;
  const badminton = SPORT_RULES.BADMINTON!.config;
  const volleyball = SPORT_RULES.VOLLEYBALL!.config;

  it('wins a pickleball game at 11 with a 2-point lead', () => {
    const view = replay(pickleball, points(...repeat(2, 7), ...repeat(1, 11), 2));
    expect(view.periods[0]).toMatchObject({ score: [11, 7], winner: 1, finished: true });
    expect(view.currentPeriod).toMatchObject({ no: 2, score: [0, 1], finished: false });
    expect(view.headline).toEqual([1, 0]);
  });

  it('needs a 2-point lead at deuce', () => {
    const view = replay(pickleball, points(...repeat(1, 10), ...repeat(2, 10), 1, 2, 1));
    expect(view.currentPeriod).toMatchObject({ no: 1, score: [12, 11], finished: false });
    expect(replay(pickleball, points(...repeat(1, 10), ...repeat(2, 10), 1, 2, 1, 1)).periods[0]!.winner).toBe(1);
  });

  it('caps a badminton game at 30', () => {
    const view = replay(badminton, points(...repeat(1, 20), ...repeat(2, 20), ...Array.from({ length: 9 }, () => [1, 2] as Side[]).flat(), 2));
    expect(view.periods[0]).toMatchObject({ score: [29, 30], winner: 2 });
  });

  it('finishes best of 3 after two games and rejects further points', () => {
    const events = points(...repeat(1, 11), ...repeat(1, 11));
    const view = replay(pickleball, events);
    expect(view).toMatchObject({ finished: true, winner: 1, headline: [2, 0], summary: '11-0, 11-0', totals: [22, 0], allowedEvents: [] });
    expect(() => replay(pickleball, events, { type: 'point', side: 2 })).toThrow(ScoringError);
  });

  it('plays the deciding volleyball set to 15', () => {
    const set = (side: Side) => repeat(side, 25);
    const view = replay(volleyball, points(...set(1), ...set(2), ...set(1), ...set(2), ...repeat(2, 15)));
    expect(view).toMatchObject({ finished: true, winner: 2, headline: [2, 3] });
    expect(view.periods[4]).toMatchObject({ label: 'Set 5', score: [0, 15] });
  });

  it('applies best-of and points options, keeping the badminton cap offset', () => {
    expect(applyOptions(badminton, { bestOf: 1, pointsToWin: 15 })).toMatchObject({ bestOf: 1, pointsToWin: 15, cap: 24 });
    expect(replay(applyOptions(pickleball, { bestOf: 1 }), points(...repeat(2, 11)))).toMatchObject({ finished: true, winner: 2 });
  });

  it('rejects events from other sports', () => {
    expect(() => replay(pickleball, [], { type: 'goal', side: 1 })).toThrow('Only points');
  });
});

describe('timed goals (football)', () => {
  const football = SPORT_RULES.FOOTBALL!.config;

  it('counts goals across halves and ends after the second half', () => {
    const events: ScoreEvent[] = [
      { type: 'goal', side: 1 },
      { type: 'period_end' },
      { type: 'goal', side: 2 },
      { type: 'goal', side: 2 },
    ];
    const live = replay(football, events);
    expect(live).toMatchObject({ finished: false, headline: [1, 2], currentPeriod: { label: '2nd half', score: [0, 2] } });
    const done = replay(football, events, { type: 'period_end' });
    expect(done).toMatchObject({ finished: true, winner: 2, summary: '1-2', allowedEvents: [] });
  });

  it('allows a draw', () => {
    const view = replay(football, [{ type: 'period_end' }, { type: 'period_end' }]);
    expect(view).toMatchObject({ finished: true, winner: null, summary: '0-0' });
  });
});

describe('overs (box cricket)', () => {
  const cricket: OversConfig = { ...(SPORT_RULES.BOX_CRICKET!.config as OversConfig), overs: 1, wickets: 2 };

  it('ends the first innings after the overs, not counting wides and no-balls as legal balls', () => {
    const view = replay(cricket, [ball(4), ball(0, 'wide'), ball(1), ball(2, 'no_ball'), ball(0), ball(6), ball(0), ball(1)]);
    expect(view.cricket!.innings[0]).toMatchObject({ runs: 4 + 1 + 1 + 3 + 6 + 1, legalBalls: 6, overs: '1.0', extras: 2, finished: true });
    expect(view.cricket).toMatchObject({ battingSide: 2, target: 17, thisOver: [] });
    expect(view.currentPeriod.label).toBe('Innings 2');
  });

  it('ends an innings when the wickets fall, and shows the over so far', () => {
    const view = replay(cricket, [ball(0, 'none', true), ball(1)]);
    expect(view.cricket!.thisOver).toEqual(['W', '1']);
    const allOut = replay(cricket, [ball(0, 'none', true), ball(1), ball(0, 'none', true)]);
    expect(allOut.cricket!.innings[0]).toMatchObject({ runs: 1, wickets: 2, overs: '0.3', finished: true });
  });

  it('ends the chase as soon as the target is passed', () => {
    const view = replay(cricket, [ball(2), { type: 'innings_end' }, ball(1), ball(4)]);
    expect(view).toMatchObject({ finished: true, winner: 2, headline: [2, 5], summary: '2/0 (0.1) – 5/0 (0.2)' });
  });

  it('is a tie when both sides score the same', () => {
    const view = replay(cricket, [ball(3), { type: 'innings_end' }, ball(3), { type: 'innings_end' }]);
    expect(view).toMatchObject({ finished: true, winner: null });
  });

  it('lets side 2 bat first', () => {
    const view = replay(applyOptions(cricket, { battingFirst: 2 }), [ball(4), { type: 'innings_end' }]);
    expect(view.headline).toEqual([0, 4]);
    expect(view.cricket!.battingSide).toBe(1);
  });

  it('rejects impossible runs', () => {
    expect(() => replay(cricket, [], ball(7))).toThrow('0 to 6');
  });
});
