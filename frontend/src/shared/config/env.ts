/**
 * Public runtime configuration. Expo inlines EXPO_PUBLIC_* at build time, so these
 * must be read with static `process.env.X` access (no destructuring or dynamic keys).
 */
function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing ${name}. Copy frontend/.env.example to frontend/.env and fill it in.`);
  return value;
}

export const env = {
  apiUrl: required('EXPO_PUBLIC_API_URL', process.env.EXPO_PUBLIC_API_URL).replace(/\/+$/, ''),
  defaultCountryCode: process.env.EXPO_PUBLIC_DEFAULT_COUNTRY_CODE || '+91',
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || null,
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || null,
} as const;
