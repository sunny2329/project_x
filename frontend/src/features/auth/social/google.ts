import type * as GoogleSignInModule from '@react-native-google-signin/google-signin';
import { ApiError } from '@/shared/api/client';
import { env } from '@/shared/config/env';

let configured = false;

/**
 * Loaded lazily: importing the package throws when its native module is missing (e.g. in Expo Go),
 * so a static import would crash the whole app instead of just this sign-in option.
 */
async function loadGoogleSignIn(): Promise<typeof GoogleSignInModule> {
  try {
    return await import('@react-native-google-signin/google-signin');
  } catch {
    throw new ApiError(0, 'PROVIDER_NOT_CONFIGURED', 'Google sign-in is not available in this build.');
  }
}

async function ensureConfigured(): Promise<typeof GoogleSignInModule> {
  if (!env.googleWebClientId) {
    throw new ApiError(0, 'PROVIDER_NOT_CONFIGURED', 'Google sign-in is not set up for this build yet.');
  }
  const google = await loadGoogleSignIn();
  if (configured) return google;
  google.GoogleSignin.configure({
    webClientId: env.googleWebClientId,
    ...(env.googleIosClientId ? { iosClientId: env.googleIosClientId } : {}),
  });
  configured = true;
  return google;
}

/** Opens the native Google account picker. Resolves null if the user cancels. */
export async function getGoogleIdToken(): Promise<string | null> {
  const { GoogleSignin, isCancelledResponse, isErrorWithCode, statusCodes } = await ensureConfigured();
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (isCancelledResponse(response)) return null;
    if (!response.data.idToken) throw new Error('Google returned no ID token');
    return response.data.idToken;
  } catch (error) {
    if (isErrorWithCode(error)) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED || error.code === statusCodes.IN_PROGRESS) return null;
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new ApiError(0, 'PLAY_SERVICES_UNAVAILABLE', 'Google Play services are required for Google sign-in.');
      }
    }
    throw new ApiError(0, 'GOOGLE_SIGN_IN_FAILED', 'Google sign-in failed. Please try again.');
  }
}

/** Clears the cached Google account so the picker shows next time. Never throws. */
export async function signOutOfGoogle(): Promise<void> {
  if (!configured) return;
  const { GoogleSignin } = await loadGoogleSignIn();
  await GoogleSignin.signOut().catch(() => undefined);
}
