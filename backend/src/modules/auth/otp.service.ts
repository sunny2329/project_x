import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import type pg from 'pg';
import { withTransaction } from '../../database/pool.js';
import { AppError } from '../../utils/app-error.js';
import type { AuthRepository } from './auth.repository.js';
import type { OtpPurposeCode } from './auth.types.js';
import { toE164, type Phone } from './phone.js';
import type { SmsSender } from './providers/sms-sender.js';

const OTP_TTL_MS = 10 * 60 * 1000;

export interface OtpServiceDeps {
  pool: pg.Pool;
  repository: AuthRepository;
  sms: SmsSender;
  /** Keys the code hashes, so a leaked `auth_otp` table cannot be brute-forced offline. */
  hashKey: string;
  /** Fixed code in development (DEV_OTP_CODE); random otherwise. */
  fixedCode?: string;
}

/** One-time SMS codes stored in `auth_otp`: generation, delivery, expiry and attempt limits. */
export class OtpService {
  constructor(private readonly deps: OtpServiceDeps) {}

  async send(phone: Phone, purpose: OtpPurposeCode, userId: string | null): Promise<void> {
    const code = this.deps.fixedCode ?? randomInt(0, 1_000_000).toString().padStart(6, '0');
    await withTransaction(this.deps.pool, async (db) => {
      await this.deps.repository.expireOtps(db, phone, purpose);
      await this.deps.repository.createOtp(db, {
        userId,
        phone,
        purpose,
        otpHash: this.hash(phone, purpose, code),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      });
    });
    await this.deps.sms.send(toE164(phone), `${code} is your ProjectX verification code. It expires in 10 minutes.`);
  }

  /** Consumes the code when correct. Every wrong guess counts towards the code's `max_attempts`. */
  async verify(phone: Phone, purpose: OtpPurposeCode, code: string): Promise<boolean> {
    const outcome = await withTransaction(this.deps.pool, async (db) => {
      const otp = await this.deps.repository.findActiveOtpForUpdate(db, phone, purpose);
      if (!otp) return 'invalid';
      if (otp.attemptCount >= otp.maxAttempts) return 'locked';

      const expected = Buffer.from(otp.otpHash, 'hex');
      const actual = Buffer.from(this.hash(phone, purpose, code), 'hex');
      const valid = expected.length === actual.length && timingSafeEqual(expected, actual);
      await this.deps.repository.recordOtpAttempt(db, otp.id, valid);
      return valid ? 'valid' : 'invalid';
    });

    if (outcome === 'locked') {
      throw AppError.tooManyRequests('OTP_ATTEMPTS_EXCEEDED', 'Too many incorrect codes. Request a new code.');
    }
    return outcome === 'valid';
  }

  private hash(phone: Phone, purpose: OtpPurposeCode, code: string): string {
    return createHmac('sha256', this.deps.hashKey).update(`${purpose}:${toE164(phone)}:${code}`).digest('hex');
  }
}
