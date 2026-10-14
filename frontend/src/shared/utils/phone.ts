import { env } from '@/shared/config/env';

export const E164_PHONE = /^\+[1-9]\d{7,14}$/;

/**
 * Converts what a user typed into E.164: strips formatting, maps a leading "00" to "+",
 * and prefixes the default country code when none was given (dropping a trunk "0").
 */
export function normalizePhone(input: string, defaultCountryCode: string = env.defaultCountryCode): string {
  const compact = input.trim().replace(/[\s\-().]/g, '');
  if (compact.startsWith('+')) return compact;
  if (compact.startsWith('00')) return `+${compact.slice(2)}`;
  return `${defaultCountryCode}${compact.replace(/^0+/, '')}`;
}

export function isValidPhone(input: string): boolean {
  return E164_PHONE.test(normalizePhone(input));
}

/** "+919876543210" -> "+91 •••••• 3210" for "we sent a code to" copy. */
export function maskPhone(phone: string): string {
  return phone.length > 6 ? `${phone.slice(0, 3)} •••••• ${phone.slice(-4)}` : phone;
}
