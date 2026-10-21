import { isValidPhone, maskPhone, normalizePhone } from '../utils/phone';

describe('normalizePhone', () => {
  it.each([
    ['98765 43210', '+919876543210'],
    ['098765-43210', '+919876543210'],
    ['+1 (415) 555-0100', '+14155550100'],
    ['0044 20 7946 0958', '+442079460958'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizePhone(input, '+91')).toBe(expected);
  });

  it('validates the normalized result', () => {
    expect(isValidPhone('98765 43210')).toBe(true);
    expect(isValidPhone('12')).toBe(false);
  });

  it('masks all but the country code and last four digits', () => {
    expect(maskPhone('+919876543210')).toBe('+91 •••••• 3210');
  });
});
