import { overallRating } from './index';

describe('overallRating', () => {
  it('weights settled sports by rated matches', () => {
    // (1600×30 + 1450×10) / 40 = 1562.5 → 1563; the placement sport (2 matches) is left out.
    expect(overallRating([{ rating: 1600, ratedMatches: 30 }, { rating: 1450, ratedMatches: 10 }, { rating: 1900, ratedMatches: 2 }])).toEqual({ rating: 1563, sports: 2, matches: 40, provisional: false });
  });
  it('falls back to provisional when no sport is past placement', () => {
    expect(overallRating([{ rating: 1520, ratedMatches: 1 }, { rating: 1480, ratedMatches: 1 }])).toEqual({ rating: 1500, sports: 2, matches: 2, provisional: true });
  });
  it('is null with nothing rated', () => {
    expect(overallRating([])).toBeNull();
    expect(overallRating([{ rating: 1500, ratedMatches: 0 }])).toBeNull();
  });
});
