import { describe, expect, it } from 'vitest';
import { confidenceOf, DEFAULT_RATING, eloSystem, PLACEMENT_MATCHES, tierOf, TIERS, type PlayerRatingState } from './index.js';

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

describe('rating scale', () => {
  it('starts everyone at 1500 with 3 placement matches', () => {
    expect(DEFAULT_RATING).toBe(1500);
    expect(PLACEMENT_MATCHES).toBe(3);
  });

  it('puts every rating in exactly one tier, boundaries going up', () => {
    const cases: Array<[number, string]> = [
      [-50, 'rookie'], [1199.9, 'rookie'], [1200, 'bronze'], [1399, 'bronze'], [1400, 'silver'], [1549.9, 'silver'],
      [1550, 'gold'], [1642, 'gold'], [1699, 'gold'], [1700, 'platinum'], [1849, 'platinum'], [1850, 'elite'], [3000, 'elite'],
    ];
    for (const [rating, key] of cases) expect(tierOf(rating).key, String(rating)).toBe(key);
    expect(TIERS.map((t) => t.name)).toEqual(['Rookie', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Elite']);
  });

  it('reports progress through the tier and the points to the next one', () => {
    const gold = tierOf(1642);
    expect(gold.progress).toBeCloseTo((1642 - 1550) / 150, 5);
    expect(gold.next).toEqual({ key: 'platinum', name: 'Platinum', pointsToGo: 58 });
    // Fractional ratings never show "0 points to go".
    expect(tierOf(1699.6).next!.pointsToGo).toBe(1);
    expect(tierOf(1550).progress).toBe(0);
  });

  it('caps progress in the open-ended tiers and has no next tier at Elite', () => {
    expect(tierOf(500).progress).toBe(0);
    expect(tierOf(1100).progress).toBeCloseTo(0.5, 5);
    expect(tierOf(2500).progress).toBe(1);
    expect(tierOf(1900).next).toBeNull();
  });

  it('grades confidence by rated matches', () => {
    expect([0, 1, 2, 3, 4, 5, 14, 15, 80].map(confidenceOf)).toEqual(['placement', 'placement', 'placement', 'low', 'low', 'medium', 'medium', 'high', 'high']);
  });
});
