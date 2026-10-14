import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';
import { ApiError } from '@/shared/api/client';

export interface AppleCredential {
  identityToken: string;
  /** Apple only shares the name on the very first authorization. */
  fullName?: string;
}

export async function isAppleSignInAvailable(): Promise<boolean> {
  return Platform.OS === 'ios' && AppleAuthentication.isAvailableAsync();
}

/** Opens the native Sign in with Apple sheet. Resolves null if the user cancels. */
export async function getAppleCredential(): Promise<AppleCredential | null> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) throw new Error('Apple returned no identity token');
    const fullName = credential.fullName ? AppleAuthentication.formatFullName(credential.fullName).trim() : '';
    return { identityToken: credential.identityToken, ...(fullName ? { fullName } : {}) };
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ERR_REQUEST_CANCELED') return null;
    throw new ApiError(0, 'APPLE_SIGN_IN_FAILED', 'Apple sign-in failed. Please try again.');
  }
}
