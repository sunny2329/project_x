import { activityGrid, activitySummary, pct, percentileLine, performanceTiles, trendGeometry } from './insights';
import type { SportInsights } from './types';

describe('trendGeometry', () => {
  it('needs two points and a width', () => {
    expect(trendGeometry([1500], 318, 96)).toBeNull();
    expect(trendGeometry([1500, 1510], 0, 96)).toBeNull();
  });

  it('maps the lowest value to the bottom, the highest to the top, and marks high and end', () => {
    const g = trendGeometry([1500, 1550, 1520], 318, 96)!;
    expect(g.line.startsWith('M3.0 88.0')).toBe(true);
    expect(g.high).toEqual({ x: 159, y: 8 });
    expect(g.end.x).toBeCloseTo(315, 5);
    expect(g).toMatchObject({ hi: 1550, lo: 1500 });
    expect(g.area.endsWith('L3.0 96 Z')).toBe(true);
  });

  it('draws a flat line without dividing by zero', () => {
    const g = trendGeometry([1500, 1500], 100, 96)!;
    expect(g.line).toBe('M3.0 88.0 L97.0 88.0');
  });
});

describe('activityGrid', () => {
  // Friday 20 Nov 2026, local time.
  const now = new Date(2026, 10, 20, 18, 0);

  it('has 12 weeks of cells ending with this week, future days empty', () => {
    const grid = activityGrid([], now);
    expect(grid).toHaveLength(84);
    expect(grid.slice(77, 83)).toEqual([0, 0, 0, 0, 0, 0]); // Sun..Fri this week
    expect(grid[83]).toBeNull(); // Saturday is still to come
  });

  it('buckets matches by local day into levels 0-3', () => {
    const at = (d: number, h: number) => new Date(2026, 10, d, h).toISOString();
    const grid = activityGrid([at(20, 9), at(19, 9), at(19, 20), at(15, 7), at(15, 8), at(15, 9), at(15, 10)], now);
    expect(grid[82]).toBe(1); // Fri 20
    expect(grid[81]).toBe(2); // Thu 19
    expect(grid[77]).toBe(3); // Sun 15, four matches capped at 3
    expect(grid[0]).toBe(0);
  });

  it('ignores matches older than the grid', () => {
    expect(activityGrid([new Date(2026, 5, 1).toISOString()], now).every((c) => c === 0 || c === null)).toBe(true);
  });
});

describe('activitySummary', () => {
  it('gives matches per week and the busiest weekday', () => {
    const sat = (d: number) => new Date(2026, 10, d, 10).toISOString(); // 7, 14 are Saturdays
    expect(activitySummary([sat(7), sat(14), new Date(2026, 10, 18, 10).toISOString()])).toBe('0.3 / week · busiest Sat');
    expect(activitySummary([])).toBe('No matches in 12 weeks');
    expect(activitySummary([sat(7)])).toBe('<0.1 / week · busiest Sat');
  });
});

const base: SportInsights = {
  rating: 1642,
  ratedMatches: 21,
  provisional: false,
  placementsLeft: 0,
  confidence: 'high',
  tier: { key: 'gold', name: 'Gold', progress: 0.6, next: { key: 'platinum', name: 'Platinum', pointsToGo: 58 } },
  delta30: 34,
  peak: 1655,
  percentile: { topPercent: 12, city: 'Jaipur' },
  trend: { '1M': [], '3M': [], '1Y': [] },
  record: { played: 21, won: 14, lost: 7, drawn: 0, winRate: 67 },
  stats: { minorWonPct: 53, avgMinorMargin: 3.4, deciding: { won: 5, lost: 2 }, comebacks: 3, avgMinutes: 34, bestStreak: 6, minorLabel: 'points', majorLabel: 'games' },
  vsStrength: [],
  split: { singles: { won: 9, lost: 4 }, doubles: { won: 5, lost: 3 } },
  form: [],
  activity: [],
  partner: null,
  rival: null,
};

describe('performanceTiles', () => {
  it('labels tiles in the sport units, like the design', () => {
    expect(performanceTiles(base)).toEqual([
      { value: '53%', label: 'Points won' },
      { value: '+3.4', label: 'Avg point margin' },
      { value: '5–2', label: 'Deciding games' },
      { value: '3', label: 'Comeback wins' },
      { value: '34m', label: 'Avg match time' },
      { value: 'W6', label: 'Best streak' },
    ]);
  });

  it('switches to games and sets for tennis and padel, and shows dashes when empty', () => {
    const tiles = performanceTiles({
      ...base,
      stats: { minorWonPct: null, avgMinorMargin: -0.5, deciding: { won: 1, lost: 1 }, comebacks: 0, avgMinutes: null, bestStreak: 0, minorLabel: 'games', majorLabel: 'sets' },
    });
    expect(tiles.map((t) => t.label)).toEqual(['Games won', 'Avg game margin', 'Deciding sets', 'Comeback wins', 'Avg match time', 'Best streak']);
    expect(tiles.map((t) => t.value)).toEqual(['—', '−0.5', '1–1', '0', '—', '—']);
  });
});

describe('pct and percentileLine', () => {
  it('rounds win rates and handles none played', () => {
    expect(pct(3, 4)).toEqual({ text: '43%', value: 3 / 7 });
    expect(pct(0, 0)).toEqual({ text: '—', value: 0 });
  });
  it('words the percentile with or without a city', () => {
    expect(percentileLine({ topPercent: 12, city: 'Jaipur' }, 'Badminton')).toBe('Top 12% of Jaipur badminton');
    expect(percentileLine({ topPercent: 30, city: null }, 'Table Tennis')).toBe('Top 30% of table tennis players');
    expect(percentileLine(null, 'Padel')).toBeNull();
  });
});
