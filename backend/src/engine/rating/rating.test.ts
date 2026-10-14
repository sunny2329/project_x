import { describe, expect, it } from 'vitest';
import { eloSystem, type PlayerRatingState } from './index.js';

const player = (playerId: string, rating: number): PlayerRatingState => ({ playerId, rating, deviation: null, volatility: null, ratedMatches: 0 });

describe('elo', () => {
  const elo = eloSystem(32);

  it('moves equal ratings by K/2', () => {
    const [a, b] = elo.rate([{ players: [player('a', 1000)] }, { players: [player('b', 1000)] }], 0);
    expect([a!.after, b!.after]).toEqual([1016, 984]);
  });

  it('rewards an upset more and uses the side average for doubles', () => {
    const updates = elo.rate([{ players: [player('a', 900), player('b', 1000)] }, { players: [player('c', 1100), player('d', 1100)] }], 0);
    const change = updates[0]!.after - 900;
    expect(change).toBeGreaterThan(16);
    expect(updates[1]!.after - 1000).toBeCloseTo(change, 5);
    expect(updates[2]!.after - 1100).toBeCloseTo(-change, 5);
  });

  it('handles a draw', () => {
    const [a] = elo.rate([{ players: [player('a', 1000)] }, { players: [player('b', 1000)] }], null);
    expect(a!.after).toBe(1000);
  });
});
