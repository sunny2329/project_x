import { Redis } from 'ioredis';
import { createApp } from './app.js';
import { RedisCache } from './cache/cache.js';
import { loadEnv } from './config/env.js';
import { createLogger } from './config/logger.js';
import { createPool } from './database/pool.js';
import { DevSmsSender, TwilioSmsSender } from './modules/auth/providers/sms-sender.js';
import { RedisLiveStore } from './modules/match/live/live-store.js';
import { AppleIdentityVerifier, GoogleIdentityVerifier } from './modules/auth/providers/social-identity.js';

const env = loadEnv();
const logger = createLogger(env.LOG_LEVEL, env.NODE_ENV === 'development');
const pool = createPool({ connectionString: env.DATABASE_URL, max: env.DB_POOL_MAX });
pool.on('error', (error) => logger.error({ err: error }, 'Idle database client error'));

const redis = env.REDIS_URL ? new Redis(env.REDIS_URL, { maxRetriesPerRequest: 3 }) : null;
redis?.on('error', (error) => logger.error({ err: error }, 'Redis error'));
if (!redis) logger.warn('REDIS_URL not set: live match state is kept in memory and every score waits for the database');

const sms =
  env.SMS_PROVIDER === 'twilio'
    ? new TwilioSmsSender(env.TWILIO_ACCOUNT_SID!, env.TWILIO_AUTH_TOKEN!, env.TWILIO_FROM_NUMBER!)
    : new DevSmsSender();
if (env.SMS_PROVIDER === 'dev') logger.warn('SMS_PROVIDER=dev: no SMS is sent and DEV_OTP_CODE is accepted as the code');

const app = createApp({
  env,
  logger,
  pool,
  sms,
  google: env.GOOGLE_CLIENT_IDS.length ? new GoogleIdentityVerifier(env.GOOGLE_CLIENT_IDS) : null,
  apple: env.APPLE_BUNDLE_IDS.length ? new AppleIdentityVerifier(env.APPLE_BUNDLE_IDS) : null,
  ...(redis ? { live: { store: new RedisLiveStore(redis), shared: true }, cache: new RedisCache(redis) } : {}),
});

// Scores taken before the last shutdown that had not reached Postgres yet.
app.services.matchService.resumePending().catch((error: unknown) => logger.error({ err: error }, 'Could not resume pending live scores'));

const server = app.listen(env.PORT, () => logger.info(`API listening on port ${env.PORT}`));

function shutdown(signal: string): void {
  logger.info(`${signal} received, shutting down`);
  server.close(() => {
    Promise.allSettled([pool.end(), redis?.quit()]).finally(() => process.exit(0));
  });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
