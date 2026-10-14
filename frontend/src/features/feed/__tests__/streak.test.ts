import { weekStreak } from '../streak';

// Wednesday 1 Oct 2026, local time.
const now = new Date(2026, 9, 1, 12);
const at = (month: number, day: number) => new Date(2026, month, day, 18).toISOString();

describe('weekStreak', () => {
  it('is 0 without matches', () => {
    expect(weekStreak([], now)).toBe(0);
  });

  it('counts consecutive weeks ending this week', () => {
    // This week (Mon 28 Sep), the week before (21 Sep) and the one before that (14 Sep).
    expect(weekStreak([at(8, 29), at(8, 22), at(8, 25), at(8, 14)], now)).toBe(3);
  });

  it('keeps last week’s streak alive while this week has no match yet', () => {
    expect(weekStreak([at(8, 21), at(8, 15)], now)).toBe(2);
  });

  it('stops at the first week without a match', () => {
    expect(weekStreak([at(8, 29), at(8, 8)], now)).toBe(1);
    expect(weekStreak([at(8, 8)], now)).toBe(0);
  });

  it('treats Sunday as the end of the week', () => {
    // Sunday 27 Sep is last week; Monday 28 Sep is this week.
    expect(weekStreak([at(8, 27), at(8, 28)], now)).toBe(2);
  });
});
