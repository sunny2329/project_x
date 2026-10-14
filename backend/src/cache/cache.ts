import type { Redis } from 'ioredis';

/** Small key-value cache (strings, with expiry). Redis in production, process memory otherwise. */
export interface Cache {
  mget(keys: string[]): Promise<Array<string | null>>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  del(...keys: string[]): Promise<void>;
}

export class RedisCache implements Cache {
  constructor(private readonly redis: Redis) {}

  mget(keys: string[]): Promise<Array<string | null>> {
    return keys.length ? this.redis.mget(keys) : Promise.resolve([]);
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, value, 'EX', ttlSeconds);
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length) await this.redis.del(...keys);
  }
}

export class MemoryCache implements Cache {
  private readonly entries = new Map<string, { value: string; expiresAt: number }>();

  mget(keys: string[]): Promise<Array<string | null>> {
    const now = Date.now();
    return Promise.resolve(
      keys.map((key) => {
        const entry = this.entries.get(key);
        if (!entry || entry.expiresAt <= now) {
          this.entries.delete(key);
          return null;
        }
        return entry.value;
      }),
    );
  }

  set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.entries.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    return Promise.resolve();
  }

  del(...keys: string[]): Promise<void> {
    for (const key of keys) this.entries.delete(key);
    return Promise.resolve();
  }
}
