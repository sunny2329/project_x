// Tests for the parked engines, kept running so the logic doesn't rot until it is ported.
import { describe, expect, it } from 'vitest';
import { replay, ScoringError, type OversConfig, type ScoreEvent, type TimedGoalsConfig } from './index.js';

const ball = (runs: number, extra: 'none' | 'wide' | 'no_ball' = 'none', wicket = false): ScoreEvent => ({ type: 'ball', runs, extra, wicket });
const SPORT_RULES = {
  FOOTBALL: { config: { kind: 'timed_goals', periods: 2, periodMinutes: 20 } as TimedGoalsConfig },
  BOX_CRICKET: { config: { kind: 'overs', overs: 6, ballsPerOver: 6, wickets: 5, wideRuns: 1, noBallRuns: 1, battingFirst: 1 } as OversConfig },
};

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
    const view = replay({ ...cricket, battingFirst: 2 }, [ball(4), { type: 'innings_end' }]);
    expect(view.headline).toEqual([0, 4]);
    expect(view.cricket!.battingSide).toBe(1);
  });

  it('rejects impossible runs', () => {
    expect(() => replay(cricket, [], ball(7))).toThrow('0 to 6');
  });
});
