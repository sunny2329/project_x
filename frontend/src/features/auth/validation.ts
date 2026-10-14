import { isValidPhone } from '@/shared/utils/phone';
import { identifierKind } from './identifier';

/**
 * Client-side checks for instant feedback. They mirror, but never replace, the backend
 * rules in backend/src/modules/auth/auth.validation.ts.
 */
export type Errors<T extends string> = Partial<Record<T, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(value: string): string | undefined {
  if (!value.trim()) return 'Enter your email';
  if (!EMAIL.test(value.trim())) return 'Enter a valid email address';
  return undefined;
}

export function validatePhone(value: string): string | undefined {
  if (!value.trim()) return 'Enter your phone number';
  if (!isValidPhone(value)) return 'Enter a valid phone number';
  return undefined;
}

export function validateUsername(value: string): string | undefined {
  const username = value.trim();
  if (!username) return 'Choose a username';
  if (username.length < 3) return 'Username must be at least 3 characters';
  if (username.length > 30) return 'Username must be at most 30 characters';
  if (!/^[A-Za-z0-9_.]+$/.test(username)) return 'Use only letters, numbers, "_" and "."';
  if (!/[A-Za-z]/.test(username)) return 'Username must contain a letter';
  return undefined;
}

export function validateIdentifier(value: string): string | undefined {
  if (!value.trim()) return 'Enter your username, email or phone';
  switch (identifierKind(value)) {
    case 'email':
      return validateEmail(value);
    case 'phone':
      return validatePhone(value) && 'Enter a valid phone number';
    case 'username':
      return validateUsername(value) && 'Enter a valid username, email or phone number';
  }
}

export function validateNewPassword(value: string): string | undefined {
  if (value.length < 8) return 'Password must be at least 8 characters';
  if (value.length > 128) return 'Password must be at most 128 characters';
  if (!/[A-Za-z]/.test(value)) return 'Password must contain a letter';
  if (!/\d/.test(value)) return 'Password must contain a number';
  return undefined;
}

export function validateFullName(value: string): string | undefined {
  const name = value.trim();
  if (name.length < 2) return 'Enter your full name';
  if (name.length > 100) return 'Name must be at most 100 characters';
  return undefined;
}

export function validateCode(value: string): string | undefined {
  return /^\d{6}$/.test(value) ? undefined : 'Enter the 6-digit code';
}

export function validateConfirmation(password: string, confirmation: string): string | undefined {
  return password === confirmation ? undefined : 'Passwords do not match';
}

/** Drops undefined entries; an empty object means the form is valid. */
export function collectErrors<T extends string>(errors: Record<T, string | undefined>): Errors<T> {
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => message)) as Errors<T>;
}
