import { describe, expect, it } from 'vitest';
import { average, eloChange } from './rating.js';

describe('eloChange', () => {
  it('moves equal players by half of K', () => {
    expect(eloChange(1000, 1000, 1)).toEqual([16, -16]);
    expect(eloChange(1000, 1000, 2)).toEqual([-16, 16]);
  });

  it('does not move equal players on a draw', () => {
    expect(eloChange(1000, 1000, null)[0]).toBeCloseTo(0);
  });

  it('rewards an upset more than an expected win', () => {
    const [upset] = eloChange(1000, 1200, 1);
    const [expected] = eloChange(1200, 1000, 1);
    expect(upset).toBeGreaterThan(expected);
    expect(upset + expected).toBeCloseTo(32, 0);
  });

  it('averages a side', () => {
    expect(average([1000, 1100])).toBe(1050);
  });
});
