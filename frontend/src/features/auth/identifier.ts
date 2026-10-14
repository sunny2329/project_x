import { normalizePhone } from '@/shared/utils/phone';

const PHONE_LIKE = /^[+\d\s\-().]+$/;

export type IdentifierKind = 'email' | 'phone' | 'username';

/** Same rule as the backend: "@" -> email, only digits/"+"/separators -> phone, else username. */
export function identifierKind(input: string): IdentifierKind {
  const value = input.trim();
  if (value.includes('@')) return 'email';
  return PHONE_LIKE.test(value) ? 'phone' : 'username';
}

/** "Username, email or phone" input -> the value the API expects (lowercased email, E.164 phone, username as typed). */
export function normalizeIdentifier(input: string): string {
  const value = input.trim();
  switch (identifierKind(value)) {
    case 'email':
      return value.toLowerCase();
    case 'phone':
      return normalizePhone(value);
    case 'username':
      return value;
  }
}
