import { ApiError } from '@/shared/api/client';

export interface AppleCredential {
  identityToken: string;
  fullName?: string;
}

/** Web build: Sign in with Apple here is the native iOS sheet, so it is off in the browser. */
export async function isAppleSignInAvailable(): Promise<boolean> {
  return false;
}

export async function getAppleCredential(): Promise<AppleCredential | null> {
  throw new ApiError(0, 'PROVIDER_NOT_CONFIGURED', 'Sign in with Apple is only in the iOS app. Log in with your phone number here.');
}
