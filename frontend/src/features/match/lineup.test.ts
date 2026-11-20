import { fromOption, maskPhone, newGuest } from './lineup';

describe('maskPhone', () => {
  it('keeps the country code, two leading and three trailing digits', () => {
    expect(maskPhone('+919876543210')).toBe('+91 98••• ••210');
    expect(maskPhone('+91 98765 43210')).toBe('+91 98••• ••210');
    expect(maskPhone('+14155550123')).toBe('+1 41••• ••123');
  });
  it('copes with short or unusual numbers', () => {
    expect(maskPhone('+9112345')).toBe('+91 12345');
    expect(maskPhone('9876543210')).toBe('98•••210');
    expect(maskPhone('123')).toBe('123');
  });
});

describe('lineup players', () => {
  it('carries the rating from a search result and the phone of a new guest', () => {
    expect(fromOption({ playerId: null, userId: 'u1', username: 'kabir', displayName: 'Kabir Shah', isGuest: false, rating: 1561, photoUrl: null }).rating).toBe(1561);
    const g = newGuest('Ishaan Rao', '+919876543210');
    expect(g.phone).toBe('+919876543210');
    expect(g.input).toEqual({ guest: { displayName: 'Ishaan Rao', phone: '+919876543210' } });
    expect(newGuest('Tara').phone).toBeNull();
  });
});
