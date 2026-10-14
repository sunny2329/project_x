import * as SecureStore from 'expo-secure-store';
import type { AuthResult, User } from '../types';

const SESSION_KEY = 'projectx.auth.session';

// Readable after the first unlock (so background refresh works) and never synced or
// restored to another device.
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

export interface StoredSession {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  /** Cached so the app can open signed-in while offline. */
  user: User;
}

export function toStoredSession({ user, tokens }: AuthResult): StoredSession {
  return {
    accessToken: tokens.accessToken,
    accessTokenExpiresAt: tokens.accessTokenExpiresAt,
    refreshToken: tokens.refreshToken,
    user,
  };
}

/** Tokens live only in the OS keychain/keystore, never in AsyncStorage. */
export const sessionStorage = {
  async load(): Promise<StoredSession | null> {
    const raw = await SecureStore.getItemAsync(SESSION_KEY, OPTIONS);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredSession;
    } catch {
      await SecureStore.deleteItemAsync(SESSION_KEY, OPTIONS);
      return null;
    }
  },

  save(session: StoredSession): Promise<void> {
    return SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session), OPTIONS);
  },

  clear(): Promise<void> {
    return SecureStore.deleteItemAsync(SESSION_KEY, OPTIONS);
  },
};
