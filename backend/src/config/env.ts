import dotenv from 'dotenv';
import { z } from 'zod';
import { parseWindow } from '../utils/keep-alive.js';

dotenv.config({ quiet: true });

const csv = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),
    CORS_ORIGINS: csv,

    DATABASE_URL: z.string().url(),
    DATABASE_URL_DIRECT: z.string().url().optional(),
    DB_POOL_MAX: z.coerce.number().int().positive().default(10),

    /** Redis (Upstash) for live match state. Without it, live state is kept in process memory. */
    REDIS_URL: z.string().url().optional(),

    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

    SMS_PROVIDER: z.enum(['twilio', 'dev']).default('twilio'),
    TWILIO_ACCOUNT_SID: z.string().optional(),
    TWILIO_AUTH_TOKEN: z.string().optional(),
    TWILIO_FROM_NUMBER: z.string().optional(),
    DEV_OTP_CODE: z
      .string()
      .regex(/^\d{6}$/, 'DEV_OTP_CODE must be 6 digits')
      .optional(),

    GOOGLE_CLIENT_IDS: csv,
    APPLE_BUNDLE_IDS: csv,

    /**
     * Keep-alive: the server pings its own public URL every 10 minutes so Render's free plan doesn't
     * put it to sleep. On when a URL is known (Render sets RENDER_EXTERNAL_URL itself).
     */
    KEEP_ALIVE_URL: z.string().url().optional(),
    RENDER_EXTERNAL_URL: z.string().url().optional(),
    /** Hours (India time) to stay awake, start-end, end exclusive, may wrap past midnight. "off" disables. */
    KEEP_ALIVE_HOURS_IST: z
      .string()
      .regex(/^(off|\s*\d{1,2}\s*-\s*\d{1,2}\s*)$/, 'KEEP_ALIVE_HOURS_IST must look like "6-24" or be "off"')
      .default('6-24'),

    /** Swagger UI at /docs. Unset = on outside production. */
    API_DOCS: z.enum(['true', 'false']).optional(),
  })
  .superRefine((env, ctx) => {
    if (env.KEEP_ALIVE_HOURS_IST !== 'off') {
      try {
        parseWindow(env.KEEP_ALIVE_HOURS_IST, 0);
      } catch (error) {
        ctx.addIssue({ code: 'custom', path: ['KEEP_ALIVE_HOURS_IST'], message: (error as Error).message });
      }
    }
    if (env.SMS_PROVIDER === 'twilio') {
      for (const key of ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER'] as const) {
        if (!env[key]) ctx.addIssue({ code: 'custom', path: [key], message: `${key} is required when SMS_PROVIDER=twilio` });
      }
    }
    if (env.SMS_PROVIDER === 'dev') {
      if (env.NODE_ENV === 'production') {
        ctx.addIssue({ code: 'custom', path: ['SMS_PROVIDER'], message: 'SMS_PROVIDER=dev is not allowed in production' });
      }
      if (!env.DEV_OTP_CODE) {
        ctx.addIssue({ code: 'custom', path: ['DEV_OTP_CODE'], message: 'DEV_OTP_CODE is required when SMS_PROVIDER=dev' });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return result.data;
}
