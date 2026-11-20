import { roundChip, roundCode, roundSub } from './rounds';

describe('roundCode', () => {
  it('shortens knockout rounds with the match number', () => {
    expect(roundCode({ roundName: 'Quarter-final', position: 2 })).toBe('QF2');
    expect(roundCode({ roundName: 'Semi-final', position: 1 })).toBe('SF1');
    expect(roundCode({ roundName: 'Round of 16', position: 3 })).toBe('R16 3');
    expect(roundCode({ roundName: 'Final', position: 1 })).toBe('Final');
    expect(roundCode({ roundName: 'Third place', position: 1 })).toBe('3rd place');
    expect(roundCode({ roundName: null, position: 1 })).toBeNull();
    expect(roundCode({ roundName: 'Round 2', position: 4 })).toBe('Round 2');
  });
});

describe('round chips', () => {
  const now = new Date(2026, 10, 20, 12);
  const f = (status: string, scheduledAt: string | null = null, live = false) => ({ status, scheduledAt, match: live ? { status: 'live' } : null }) as never;
  it('says what is happening in a round', () => {
    expect(roundSub([f('completed'), f('live', null, true), f('ready')], now)).toBe('1 live');
    expect(roundSub([f('completed'), f('completed'), f('bye')], now)).toBe('2 done');
    expect(roundSub([f('pending', new Date(2026, 10, 21, 10).toISOString()), f('pending', new Date(2026, 10, 22, 10).toISOString())], now)).toBe('Sat');
    expect(roundSub([f('ready', new Date(2026, 10, 20, 18).toISOString())], now)).toBe('Today');
    expect(roundSub([f('completed'), f('ready')], now)).toBe('1 of 2 done');
    expect(roundSub([f('pending')], now)).toBe('1 match');
  });
  it('labels rounds', () => {
    expect(['Round of 16', 'Quarter-final', 'Semi-final', 'Final', 'Play-in', null].map((n, i) => roundChip(n, i))).toEqual(['R16', 'QF', 'SF', 'Final', 'Play-in', 'R6']);
  });
});
