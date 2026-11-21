import { categoryMeta, categoryOptions, drawInfo, groupCountFor, multiSummary } from './setup';

describe('categoryOptions', () => {
  it('offers gendered and open categories per format', () => {
    const racket = categoryOptions([{ code: 'singles', name: 'Singles', playersPerSide: 1 }, { code: 'doubles', name: 'Doubles', playersPerSide: 2 }]);
    expect(racket.map((c) => c.name)).toEqual(["Men's Singles", "Women's Singles", 'Open Singles', "Men's Doubles", "Women's Doubles", 'Mixed Doubles', 'Open Doubles']);
    expect(racket.find((c) => c.name === 'Mixed Doubles')?.format).toBe('doubles');
    expect(categoryOptions([{ code: 'team', name: 'Team', playersPerSide: 6 }])).toEqual([{ name: 'Open', format: 'team' }]);
    expect(categoryOptions([{ code: '3v3', name: '3v3', playersPerSide: 3 }])).toEqual([{ name: 'Open 3v3', format: '3v3' }]);
    expect(categoryOptions([])).toEqual([]);
  });
});

describe('drawInfo', () => {
  it('describes a knockout draw', () => {
    expect(drawInfo('knockout', 13)).toBe('16-draw · 3 byes · 12 matches');
    expect(drawInfo('knockout', 16)).toBe('16-draw · 15 matches');
    expect(drawInfo('knockout', 15)).toBe('16-draw · 1 bye · 14 matches');
    expect(drawInfo('knockout', 2)).toBe('2-draw · 1 match');
  });
  it('describes round robin and groups', () => {
    expect(drawInfo('round_robin', 6)).toBe('15 matches · each plays 5');
    expect(groupCountFor(12)).toBe(3);
    expect(groupCountFor(5)).toBe(2);
    // 12 entries: 3 groups of 4 = 18 group matches, then a 6-team knockout = 5 matches.
    expect(drawInfo('groups_knockout', 12)).toBe('3 groups · top 2 advance · 23 matches');
    // 10 entries: groups of 4, 3, 3 = 12 group matches, then a 6-team knockout = 5.
    expect(drawInfo('groups_knockout', 10)).toBe('3 groups · top 2 advance · 17 matches');
    // 5 entries: groups of 3 and 2 = 4 group matches, then a 4-team knockout = 3.
    expect(drawInfo('groups_knockout', 5)).toBe('2 groups · top 2 advance · 7 matches');
  });
  it('asks for enough entries', () => {
    expect(drawInfo('knockout', 1)).toBe('Add at least 2 entries');
    expect(drawInfo('round_robin', 0)).toBe('Add at least 2 entries');
  });
});

describe('categoryMeta and multiSummary', () => {
  it('summarises a category', () => {
    expect(categoryMeta({ drawFormat: 'knockout', maxEntries: 16, playersPerSide: 1, rules: 'Best of 3' })).toBe('Knockout · 16 entries · Best of 3');
    expect(categoryMeta({ drawFormat: 'groups_knockout', maxEntries: 12, playersPerSide: 2 })).toBe('Groups → KO · 12 pairs');
    expect(categoryMeta({ drawFormat: 'round_robin', maxEntries: null, playersPerSide: 6 })).toBe('Round robin');
  });
  it('counts sports and categories', () => {
    expect(multiSummary([])).toBe('No categories yet');
    expect(multiSummary([{ sport: 'badminton' }])).toBe('1 sport · 1 category');
    expect(multiSummary([{ sport: 'badminton' }, { sport: 'badminton' }, { sport: 'padel' }])).toBe('2 sports · 3 categories');
  });
});
