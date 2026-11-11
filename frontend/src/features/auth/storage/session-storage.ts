import { kv, KV_AFTER_FIRST_UNLOCK } from '@/shared/storage/kv';
import type { AuthResult, User } from '../types';

const SESSION_KEY = 'projectx.auth.session';

// Readable after the first unlock (so background refresh works) and never synced or
// restored to another device. On the web the option is ignored (localStorage).
const OPTIONS = KV_AFTER_FIRST_UNLOCK === undefined ? undefined : { keychainAccessible: KV_AFTER_FIRST_UNLOCK };

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

/** Tokens live only in the OS keychain/keystore (the browser's localStorage on the web), never in AsyncStorage. */
export const sessionStorage = {
  async load(): Promise<StoredSession | null> {
    const raw = await kv.get(SESSION_KEY, OPTIONS);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredSession;
    } catch {
      await kv.remove(SESSION_KEY, OPTIONS);
      return null;
    }
  },

  save(session: StoredSession): Promise<void> {
    return kv.set(SESSION_KEY, JSON.stringify(session), OPTIONS);
  },

  clear(): Promise<void> {
    return kv.remove(SESSION_KEY, OPTIONS);
  },
};
