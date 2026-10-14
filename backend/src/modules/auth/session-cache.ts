import type { Cache } from '../../cache/cache.js';

/** How long a "this session is active" answer is reused before asking Postgres again. */
const ACTIVE_TTL_SECONDS = 60;

const keys = {
  session: (sessionId: string) => `auth:session:${sessionId}`,
  userRevoked: (userId: string) => `auth:user-revoked:${userId}`,
};

/**
 * Saves the per-request session lookup. A cached answer is ignored once the session, or every
 * session of its user, has been revoked, so sign-out and password resets still take effect at once.
 * Account status changes (e.g. suspension) take effect within ACTIVE_TTL_SECONDS.
 */
export class SessionCache {
  constructor(private readonly cache: Cache) {}

  /** True if known active; undefined if Postgres must be asked. */
  async isActive(sessionId: string, userId: string): Promise<boolean | undefined> {
    const [cachedAt, revokedAt] = await this.cache.mget([keys.session(sessionId), keys.userRevoked(userId)]);
    if (!cachedAt) return undefined;
    if (revokedAt && Number(revokedAt) >= Number(cachedAt)) return undefined;
    return true;
  }

  markActive(sessionId: string): Promise<void> {
    return this.cache.set(keys.session(sessionId), String(Date.now()), ACTIVE_TTL_SECONDS);
  }

  revokeSession(sessionId: string): Promise<void> {
    return this.cache.del(keys.session(sessionId));
  }

  /** Outlives every cached answer, so all of the user's cached sessions stop counting. */
  revokeUser(userId: string): Promise<void> {
    return this.cache.set(keys.userRevoked(userId), String(Date.now()), ACTIVE_TTL_SECONDS + 5);
  }
}
