import { sportCardLine } from './rules';
import type { SportSummary } from './types';

const fmt = { singles: { id: 's', code: 'singles', name: 'Singles', minPerSide: 1, maxPerSide: 1 }, doubles: { id: 'd', code: 'doubles', name: 'Doubles', minPerSide: 2, maxPerSide: 2 } };
const sport = (models: [string, Record<string, unknown>][], formats = [fmt.singles, fmt.doubles]) =>
  ({ id: '1', slug: 'x', name: 'X', formats, rulesets: models.map(([m, c], i) => ({ id: `${i}`, slug: `${i}`, name: 'r', scoringModel: m, isDefault: i === 0, config: c })) }) as unknown as SportSummary;

describe('sportCardLine', () => {
  it('matches the design for each racket sport', () => {
    expect(sportCardLine(sport([['rally', { pointsToWin: 21 }]]))).toBe('Rally to 21');
    expect(sportCardLine(sport([['rally', { pointsToWin: 11 }]]))).toBe('Rally to 11');
    expect(sportCardLine(sport([['side_out', { pointsToWin: 11 }], ['rally', { pointsToWin: 21 }]]))).toBe('Side-out or rally');
    expect(sportCardLine(sport([['side_out', { pointsToWin: 15 }]]))).toBe('Side-out to 15');
    expect(sportCardLine(sport([['tennis', { deuce: 'golden_point' }]], [fmt.doubles]))).toBe('Doubles · golden point');
    expect(sportCardLine(sport([['tennis', { deuce: 'advantage' }]]))).toBe('15 · 30 · 40 · game');
  });
  it('covers cricket, basketball and a sport without rules', () => {
    expect(sportCardLine(sport([['overs', { overs: 6 }]]))).toBe('6 overs a side');
    expect(sportCardLine(sport([['baskets', {}]], [fmt.singles]))).toBe('Singles · half or full court');
    expect(sportCardLine(sport([]))).toBe('Singles · Doubles');
  });
});
