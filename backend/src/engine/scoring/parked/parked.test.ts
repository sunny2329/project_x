// Tests for the parked engine, kept running so the logic doesn't rot until it is ported.
import { describe, expect, it } from 'vitest';
import { replay, type ScoreEvent, type TimedGoalsConfig } from './index.js';

const SPORT_RULES = {
  FOOTBALL: { config: { kind: 'timed_goals', periods: 2, periodMinutes: 20 } as TimedGoalsConfig },
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
