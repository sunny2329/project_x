import { randomBytes } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type pg from 'pg';
import { pino } from 'pino';
import { createApp } from '../app.js';
import { loadEnv } from '../config/env.js';
import { createPool } from '../database/pool.js';
import { createPrisma } from '../database/prisma.js';
import { seedReferenceData } from '../database/seed.js';
import { DevSmsSender } from '../modules/auth/providers/sms-sender.js';
import type { SocialIdentityVerifier } from '../modules/auth/providers/social-identity.js';
import type { SocialProfile } from '../modules/auth/auth.types.js';

export const TEST_OTP = '246810';
const MIGRATIONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../prisma/migrations');

/** Returns whatever profile the test sets, standing in for Google/Apple token verification. */
export class StubSocialVerifier implements SocialIdentityVerifier {
  profile: SocialProfile | null = null;

  async verify(): Promise<SocialProfile> {
    if (!this.profile) throw new Error('StubSocialVerifier.profile not set');
    return this.profile;
  }
}

/** Applies the Prisma migrations (schema-agnostic SQL) in order to the pool's search_path. */
async function applyMigrations(pool: pg.Pool): Promise<void> {
  const dirs = (await readdir(MIGRATIONS_DIR, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name).sort((a, b) => parseInt(a) - parseInt(b));
  const client = await pool.connect();
  try {
    for (const dir of dirs) await client.query(await readFile(path.join(MIGRATIONS_DIR, dir, 'migration.sql'), 'utf8'));
  } finally {
    client.release();
  }
}

/**
 * The real app against the real database, isolated in a throwaway schema built from the same
 * migrations as production and seeded with the sport catalog. Uses the direct Neon URL because
 * the pooler does not accept search_path startup options.
 */
export async function createTestContext() {
  const env = loadEnv({ ...process.env, SMS_PROVIDER: 'dev', DEV_OTP_CODE: TEST_OTP, NODE_ENV: 'test' });
  const schema = `test_${randomBytes(4).toString('hex')}`;
  const connectionString = env.DATABASE_URL_DIRECT ?? env.DATABASE_URL;

  const admin = createPool({ connectionString, max: 1 });
  await admin.query(`CREATE SCHEMA ${schema}`);
  const pool = createPool({ connectionString, max: 5, schema });
  await applyMigrations(pool);
  const db = createPrisma(pool, schema);
  await db.$transaction((tx) => seedReferenceData(tx), { maxWait: 20_000, timeout: 120_000 });

  const sms = new DevSmsSender();
  const google = new StubSocialVerifier();
  const apple = new StubSocialVerifier();
  const app = createApp({
    env: { ...env, ACCESS_TOKEN_TTL_SECONDS: 900 },
    logger: pino({ level: 'silent' }),
    pool,
    db,
    sms,
    google,
    apple,
    rateLimiting: false,
  });

  async function cleanup(): Promise<void> {
    await db.$disconnect();
    await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }

  return { app, pool, db, sms, google, apple, env, schema, cleanup };
}

export type TestContext = Awaited<ReturnType<typeof createTestContext>>;
