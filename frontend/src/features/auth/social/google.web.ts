import { ApiError } from '@/shared/api/client';

/** Web build: the Google sign-in SDK here is native-only, so the option is off in the browser. */
export async function getGoogleIdToken(): Promise<string | null> {
  throw new ApiError(0, 'PROVIDER_NOT_CONFIGURED', 'Google sign-in is only in the Android and iOS apps. Log in with your phone number here.');
}

export async function signOutOfGoogle(): Promise<void> {}
