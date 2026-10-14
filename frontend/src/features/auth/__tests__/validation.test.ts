import { normalizeIdentifier } from '../identifier';
import { collectErrors, validateCode, validateIdentifier, validateNewPassword } from '../validation';

describe('auth validation', () => {
  it('accepts an email or a phone number as identifier', () => {
    expect(validateIdentifier('athlete@example.com')).toBeUndefined();
    expect(validateIdentifier('98765 43210')).toBeUndefined();
    expect(validateIdentifier('')).toBe('Enter your username, email or phone');
    expect(validateIdentifier('athlete@')).toBe('Enter a valid email address');
    expect(validateIdentifier('123')).toBe('Enter a valid phone number');
    expect(validateIdentifier('athlete_07')).toBeUndefined();
    expect(validateIdentifier('ab')).toBe('Enter a valid username, email or phone number');
  });

  it('matches the backend password policy', () => {
    expect(validateNewPassword('short1')).toMatch(/at least 8/);
    expect(validateNewPassword('onlyletters')).toMatch(/number/);
    expect(validateNewPassword('12345678')).toMatch(/letter/);
    expect(validateNewPassword('Sprint2026')).toBeUndefined();
  });

  it('requires exactly six digits for codes', () => {
    expect(validateCode('123456')).toBeUndefined();
    expect(validateCode('12345')).toBeDefined();
  });

  it('normalizes identifiers for the API', () => {
    expect(normalizeIdentifier('  Athlete@Example.com ')).toBe('athlete@example.com');
    expect(normalizeIdentifier('98765 43210')).toBe('+919876543210');
    expect(normalizeIdentifier(' Athlete_07 ')).toBe('Athlete_07');
  });

  it('collectErrors drops passing fields', () => {
    expect(collectErrors({ a: undefined, b: 'bad' })).toEqual({ b: 'bad' });
  });
});
