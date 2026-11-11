/**
 * Browser version of `kv.ts`: the site's localStorage (kept per origin, survives reloads and the
 * home-screen app). Private windows or blocked storage make every call a quiet miss, as on a
 * fresh install.
 */
const store = (): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
};

export const kv = {
  get: async (key: string, _options?: unknown): Promise<string | null> => {
    try {
      return store()?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  set: async (key: string, value: string, _options?: unknown): Promise<void> => {
    try {
      store()?.setItem(key, value);
    } catch {
      // Storage full or blocked: the value just isn't remembered.
    }
  },
  remove: async (key: string, _options?: unknown): Promise<void> => {
    try {
      store()?.removeItem(key);
    } catch {
      // Nothing to remove.
    }
  },
};

export const KV_AFTER_FIRST_UNLOCK = undefined;
