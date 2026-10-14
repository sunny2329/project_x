import { parsePhoneNumberFromString } from 'libphonenumber-js';

/** A phone number as `usr_user` / `auth_otp` store it: calling code and national number in separate columns. */
export interface Phone {
  countryCode: string;
  number: string;
}

/** "+919876543210" -> { countryCode: "+91", number: "9876543210" }; null when not a possible number. */
export function parseE164(value: string): Phone | null {
  const parsed = parsePhoneNumberFromString(value);
  if (!parsed?.isPossible()) return null;
  return { countryCode: `+${parsed.countryCallingCode}`, number: parsed.nationalNumber };
}

export function toE164(phone: Phone): string {
  return `${phone.countryCode}${phone.number}`;
}
