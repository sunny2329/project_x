import { describe, expect, it } from 'vitest';
import { computeInsights, MIN_PERCENTILE_POOL, pickPercentile, type InsightInputs, type InsightMatch } from './profile.insights.js';

const NOW = new Date('2026-11-20T12:00:00Z');
const daysAgo = (d: number, h = 0) => new Date(NOW.getTime() - d * 86_400_000 - h * 3_600_000);
const p = (id: string, name = id, userId: string | null = `u-${id}`) => ({ playerId: id, userId, name });

/** A finished match `d` days ago; games as [mine, theirs] pairs in order. */
function match(d: number, games: Array<[number, number]>, extra: Partial<InsightMatch> = {}): InsightMatch {
  const segments = games.map(([mine, theirs]) => ({ mine, theirs, wonByMe: mine === theirs ? null : mine > theirs }));
  const mineWon = segments.filter((g) => g.wonByMe === true).length;
  const theirsWon = segments.filter((g) => g.wonByMe === false).length;
  return {
    completedAt: daysAgo(d),
    startedAt: daysAgo(d, 0.5),
    won: mineWon === theirsWon ? null : mineWon > theirsWon,
    segments,
    minorFor: games.reduce((s, g) => s + g[0], 0),
    minorAgainst: games.reduce((s, g) => s + g[1], 0),
    partners: [],
    opponents: [p('rohan', 'Rohan Iyer')],
    ratingBefore: null,
    opponentRatingBefore: null,
    ...extra,
  };
}

function inputs(over: Partial<InsightInputs> = {}): InsightInputs {
  return {
    now: NOW,
    rating: null,
    ratedMatches: 0,
    history: [],
    matches: [],
    percentile: null,
    ratingsByPlayer: new Map(),
    minorLabel: 'points',
    majorLabel: 'games',
    ...over,
  };
}

describe('computeInsights', () => {
  it('describes a player who has never played: start rating, placement, nothing to show', () => {
    const out = computeInsights(inputs());
    expect(out).toMatchObject({ rating: 1500, ratedMatches: 0, provisional: true, placementsLeft: 3, confidence: 'placement', tier: null, delta30: 0, peak: 1500 });
    expect(out.trend).toEqual({ '1M': [], '3M': [], '1Y': [] });
    expect(out.record).toEqual({ played: 0, won: 0, lost: 0, drawn: 0, winRate: null });
    expect(out.stats).toMatchObject({ minorWonPct: null, avgMinorMargin: null, avgMinutes: null, bestStreak: 0, comebacks: 0 });
    expect(out.form).toEqual([]);
    expect(out.partner).toBeNull();
    expect(out.rival).toBeNull();
  });

  it('stays provisional during placement and hides the percentile', () => {
    const out = computeInsights(inputs({ rating: 1516, ratedMatches: 1, percentile: { topPercent: 40, city: 'Jaipur' } }));
    expect(out).toMatchObject({ provisional: true, placementsLeft: 2, tier: null, percentile: null });
  });

  it('gives the tier, confidence and percentile once placed', () => {
    const out = computeInsights(inputs({ rating: 1642.4, ratedMatches: 21, percentile: { topPercent: 12, city: 'Jaipur' } }));
    expect(out.rating).toBe(1642);
    expect(out.provisional).toBe(false);
    expect(out.confidence).toBe('high');
    expect(out.tier).toMatchObject({ key: 'gold', next: { name: 'Platinum', pointsToGo: 58 } });
    expect(out.percentile).toEqual({ topPercent: 12, city: 'Jaipur' });
  });

  it('builds trend lines per range starting from the rating at the range start', () => {
    const history = [
      { at: daysAgo(200), after: 1516 },
      { at: daysAgo(60), after: 1530 },
      { at: daysAgo(20), after: 1550 },
      { at: daysAgo(2), after: 1541 },
    ];
    const out = computeInsights(inputs({ rating: 1541, ratedMatches: 4, history }));
    expect(out.trend['1M']).toEqual([1530, 1550, 1541]);
    expect(out.trend['3M']).toEqual([1516, 1530, 1550, 1541]);
    expect(out.trend['1Y']).toEqual([1500, 1516, 1530, 1550, 1541]);
    expect(out.delta30).toBe(11); // 1541 now vs 1530 thirty days ago
    expect(out.peak).toBe(1550);
  });

  it('leaves a range empty when nothing was rated in it, and thins long lines to 30 points', () => {
    const old = computeInsights(inputs({ rating: 1520, ratedMatches: 3, history: [{ at: daysAgo(100), after: 1520 }] }));
    expect(old.trend['1M']).toEqual([]);
    expect(old.trend['1Y']).toEqual([1500, 1520]);
    const many = Array.from({ length: 80 }, (_, i) => ({ at: daysAgo(80 - i), after: 1500 + i }));
    const out = computeInsights(inputs({ rating: 1579, ratedMatches: 80, history: many }));
    expect(out.trend['3M']).toHaveLength(30);
    expect(out.trend['3M'][0]).toBe(1500);
    expect(out.trend['3M'].at(-1)).toBe(1579);
  });

  it('counts record, points won, average margin and average time', () => {
    const matches = [match(1, [[21, 15], [21, 18]]), match(3, [[15, 21], [18, 21]]), match(5, [[21, 10], [21, 12]])];
    const out = computeInsights(inputs({ matches }));
    expect(out.record).toEqual({ played: 3, won: 2, lost: 1, drawn: 0, winRate: 67 });
    expect(out.stats.minorWonPct).toBe(Math.round((117 / (117 + 97)) * 100));
    expect(out.stats.avgMinorMargin).toBeCloseTo(20 / 3, 1);
    expect(out.stats.avgMinutes).toBe(30);
  });

  it('ignores matches left open for hours in the average time', () => {
    const out = computeInsights(inputs({ matches: [match(1, [[21, 1], [21, 1]], { startedAt: daysAgo(1, 9) }), match(2, [[21, 1], [21, 1]])] }));
    expect(out.stats.avgMinutes).toBe(30);
  });

  it('finds deciding games, comebacks and the best winning streak', () => {
    // Newest first: W (comeback, decider), L (decider), W, W, W, L
    const matches = [
      match(1, [[18, 21], [21, 19], [21, 17]]),
      match(2, [[21, 19], [17, 21], [19, 21]]),
      match(3, [[21, 5], [21, 5]]),
      match(4, [[21, 5], [21, 5]]),
      match(5, [[21, 5], [21, 5]]),
      match(6, [[5, 21], [5, 21]]),
    ];
    const out = computeInsights(inputs({ matches }));
    expect(out.stats.deciding).toEqual({ won: 1, lost: 1 });
    expect(out.stats.comebacks).toBe(1);
    expect(out.stats.bestStreak).toBe(3);
    expect(out.form).toEqual(['L', 'W', 'W', 'W', 'L', 'W']);
  });

  it('shows only the last 10 results in form, oldest first, and draws as D', () => {
    const matches = Array.from({ length: 12 }, (_, i) => match(i + 1, i === 0 ? [[3, 3]] : [[21, 10]]));
    const out = computeInsights(inputs({ matches }));
    expect(out.form).toHaveLength(10);
    expect(out.form.at(-1)).toBe('D');
    expect(out.record.drawn).toBe(1);
  });

  it('splits rated results by opponent strength at match time, at ±50', () => {
    const matches = [
      match(1, [[21, 10]], { ratingBefore: 1600, opponentRatingBefore: 1650 }), // exactly +50: higher
      match(2, [[10, 21]], { ratingBefore: 1600, opponentRatingBefore: 1700 }),
      match(3, [[21, 10]], { ratingBefore: 1600, opponentRatingBefore: 1649 }), // similar
      match(4, [[21, 10]], { ratingBefore: 1600, opponentRatingBefore: 1550 }), // exactly -50: lower
      match(5, [[21, 10]]), // unrated: not counted
    ];
    const out = computeInsights(inputs({ matches }));
    expect(out.vsStrength).toEqual([
      { band: 'higher', won: 1, lost: 1 },
      { band: 'similar', won: 1, lost: 0 },
      { band: 'lower', won: 1, lost: 0 },
    ]);
  });

  it('splits singles and doubles and picks the best partner and the top rival', () => {
    const kabir = p('kabir', 'Kabir Shah');
    const tara = p('tara', 'Tara Kapoor', null);
    const matches = [
      match(1, [[11, 7]], { partners: [kabir], opponents: [p('ishaan'), tara] }),
      match(2, [[7, 11]], { partners: [kabir], opponents: [p('dev'), tara] }),
      match(3, [[11, 4]], { partners: [p('vihaan')], opponents: [p('dev'), tara] }),
      match(4, [[11, 9]], { opponents: [p('rohan')] }),
    ];
    const out = computeInsights(inputs({ matches, ratingsByPlayer: new Map([['kabir', 1561.6]]) }));
    expect(out.split).toEqual({ singles: { won: 1, lost: 0 }, doubles: { won: 2, lost: 1 } });
    expect(out.partner).toEqual({ playerId: 'kabir', userId: 'u-kabir', name: 'Kabir Shah', rating: 1562, matches: 2, won: 1, lost: 1 });
    expect(out.rival).toEqual({ playerId: 'tara', userId: null, name: 'Tara Kapoor', rating: null, matches: 3, won: 2, lost: 1 });
  });

  it('breaks partner / rival ties by the most recent match', () => {
    const matches = [match(1, [[21, 3]], { opponents: [p('new')] }), match(2, [[21, 3]], { opponents: [p('old')] })];
    expect(computeInsights(inputs({ matches })).rival!.playerId).toBe('new');
  });

  it('lists activity for the last 84 days only', () => {
    const matches = [match(1, [[21, 3]]), match(83, [[21, 3]]), match(85, [[21, 3]])];
    const out = computeInsights(inputs({ matches }));
    expect(out.activity).toHaveLength(2);
    expect(out.activity[0]).toBe(daysAgo(1).toISOString());
  });

  it('passes the sport units through for labels', () => {
    expect(computeInsights(inputs({ minorLabel: 'games', majorLabel: 'sets' })).stats).toMatchObject({ minorLabel: 'games', majorLabel: 'sets' });
  });
});

describe('pickPercentile', () => {
  const none = { total: 0, above: 0 };
  it('uses the city when it has enough placed players', () => {
    expect(MIN_PERCENTILE_POOL).toBe(5);
    expect(pickPercentile('Jaipur', { total: 25, above: 3 }, { total: 400, above: 90 })).toEqual({ topPercent: 12, city: 'Jaipur' });
  });
  it('falls back to everyone when the city is too small, and gives up when everyone is too', () => {
    expect(pickPercentile('Jaipur', { total: 4, above: 1 }, { total: 10, above: 3 })).toEqual({ topPercent: 30, city: null });
    expect(pickPercentile(null, none, { total: 4, above: 1 })).toBeNull();
  });
  it('never says 0% and counts the player themselves', () => {
    expect(pickPercentile(null, none, { total: 1000, above: 1 })).toEqual({ topPercent: 1, city: null });
    expect(pickPercentile(null, none, { total: 5, above: 5 })).toEqual({ topPercent: 100, city: null });
  });
});
