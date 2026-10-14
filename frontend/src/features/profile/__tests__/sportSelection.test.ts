import { makePrimary, sameSelection, toggleSport } from '../sportSelection';

describe('sport selection', () => {
  it('makes the first sport picked primary', () => {
    expect(toggleSport({ sportIds: [], primarySportId: null }, '1')).toEqual({ sportIds: ['1'], primarySportId: '1' });
    expect(toggleSport({ sportIds: ['1'], primarySportId: '1' }, '2')).toEqual({ sportIds: ['1', '2'], primarySportId: '1' });
  });

  it('hands primary to the next sport when the primary one is removed', () => {
    expect(toggleSport({ sportIds: ['1', '2'], primarySportId: '1' }, '1')).toEqual({ sportIds: ['2'], primarySportId: '2' });
    expect(toggleSport({ sportIds: ['1'], primarySportId: '1' }, '1')).toEqual({ sportIds: [], primarySportId: null });
  });

  it('only makes a picked sport primary', () => {
    const selection = { sportIds: ['1', '2'], primarySportId: '1' };
    expect(makePrimary(selection, '2').primarySportId).toBe('2');
    expect(makePrimary(selection, '3')).toBe(selection);
  });

  it('compares selections regardless of order', () => {
    expect(sameSelection({ sportIds: ['1', '2'], primarySportId: '1' }, { sportIds: ['2', '1'], primarySportId: '1' })).toBe(true);
    expect(sameSelection({ sportIds: ['1', '2'], primarySportId: '1' }, { sportIds: ['1', '2'], primarySportId: '2' })).toBe(false);
    expect(sameSelection({ sportIds: ['1'], primarySportId: '1' }, { sportIds: ['1', '2'], primarySportId: '1' })).toBe(false);
  });
});
