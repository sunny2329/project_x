import { randomBytes } from 'node:crypto';
import type pg from 'pg';
import { pino } from 'pino';
import { createApp } from '../../../app.js';
import { loadEnv } from '../../../config/env.js';
import { createPool } from '../../../database/pool.js';
import { runMigrations } from '../../../database/migrate.js';
import { DevSmsProvider } from '../providers/sms-verification.js';
import type { SocialIdentityVerifier } from '../providers/social-identity.js';
import type { SocialProfile } from '../auth.types.js';

export const TEST_OTP = '246810';

/** Returns whatever profile the test sets, standing in for Google/Apple token verification. */
export class StubSocialVerifier implements SocialIdentityVerifier {
  profile: SocialProfile | null = null;

  async verify(): Promise<SocialProfile> {
    if (!this.profile) throw new Error('StubSocialVerifier.profile not set');
    return this.profile;
  }
}

/**
 * Builds the real app against the real database, isolated in a throwaway schema.
 * Uses the direct (non-pooled) Neon URL because the pooler does not accept search_path startup options.
 */
export async function createTestContext() {
  const baseEnv = loadEnv({ ...process.env, SMS_PROVIDER: 'dev', DEV_OTP_CODE: TEST_OTP, NODE_ENV: 'test' });
  const schema = `test_auth_${randomBytes(4).toString('hex')}`;
  const connectionString = baseEnv.DATABASE_URL_DIRECT ?? baseEnv.DATABASE_URL;

  const admin = createPool({ connectionString, max: 1 });
  await admin.query(`CREATE SCHEMA ${schema}`);
  const pool = createPool({ connectionString, max: 5, schema });
  await runMigrations(pool);

  const sms = new DevSmsProvider(TEST_OTP);
  const google = new StubSocialVerifier();
  const apple = new StubSocialVerifier();
  const app = createApp({
    env: { ...baseEnv, ACCESS_TOKEN_TTL_SECONDS: 900 },
    logger: pino({ level: 'silent' }),
    pool,
    sms,
    google,
    apple,
    rateLimiting: false,
  });

  async function cleanup(): Promise<void> {
    await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }

  return { app, pool: pool as pg.Pool, sms, google, apple, env: baseEnv, cleanup };
}
