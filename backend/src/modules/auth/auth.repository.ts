import type { Queryable } from '../../database/pool.js';
import {
  UserStatus,
  type ClientContext,
  type Identifier,
  type LoginMethodCode,
  type OtpPurposeCode,
  type OtpRecord,
  type SessionRecord,
  type UserRecord,
} from './auth.types.js';
import type { Phone } from './phone.js';

type UserRow = Omit<UserRecord, 'phone'> & { phoneCountryCode: string; phoneNumber: string };

const USER_COLUMNS = `
  u.id, u.username, p.display_name AS "fullName", u.email,
  u.phone_country_code AS "phoneCountryCode", u.phone_number AS "phoneNumber",
  u.password_hash AS "passwordHash", u.is_email_verified AS "isEmailVerified",
  u.is_phone_verified AS "isPhoneVerified", u.status, u.created_at AS "createdAt"`;

const USER_FROM = 'usr_user u LEFT JOIN usr_user_profile p ON p.user_id = u.id';

function toUser({ phoneCountryCode, phoneNumber, ...row }: UserRow): UserRecord {
  return { ...row, phone: { countryCode: phoneCountryCode, number: phoneNumber } };
}

export interface NewUser {
  username: string;
  fullName: string;
  email: string;
  phone: Phone;
  passwordHash: string;
}

export interface NewSession {
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  client: ClientContext;
}

export interface LoginLogEntry {
  userId: string | null;
  identifier: Identifier | null;
  method: LoginMethodCode;
  action: number;
  status: number;
  failureReason?: string;
  client: ClientContext;
}

/**
 * Data access for the auth tables of the project_x schema. Every method takes the connection
 * to run on so callers decide whether it is part of a transaction.
 */
export const authRepository = {
  async findUserById(db: Queryable, id: string): Promise<UserRecord | null> {
    const { rows } = await db.query<UserRow>(`SELECT ${USER_COLUMNS} FROM ${USER_FROM} WHERE u.id = $1`, [id]);
    return rows[0] ? toUser(rows[0]) : null;
  },

  async findUserByIdentifier(db: Queryable, identifier: Identifier): Promise<UserRecord | null> {
    const [where, params] =
      identifier.kind === 'phone'
        ? ['u.phone_country_code = $1 AND u.phone_number = $2', [identifier.value.countryCode, identifier.value.number]]
        : identifier.kind === 'email'
          ? ['u.email = $1', [identifier.value]]
          : ['lower(u.username) = lower($1)', [identifier.value]];
    const { rows } = await db.query<UserRow>(`SELECT ${USER_COLUMNS} FROM ${USER_FROM} WHERE ${where}`, params);
    return rows[0] ? toUser(rows[0]) : null;
  },

  async findTakenFields(
    db: Queryable,
    fields: { username: string; email: string; phone: Phone },
  ): Promise<{ username: boolean; email: boolean; phone: boolean }> {
    const { rows } = await db.query<{ username: boolean; email: boolean; phone: boolean }>(
      `SELECT lower(username) = lower($1) AS username,
              email = $2 AS email,
              (phone_country_code = $3 AND phone_number = $4) AS phone
         FROM usr_user
        WHERE lower(username) = lower($1) OR email = $2 OR (phone_country_code = $3 AND phone_number = $4)`,
      [fields.username, fields.email, fields.phone.countryCode, fields.phone.number],
    );
    return {
      username: rows.some((row) => row.username),
      email: rows.some((row) => row.email),
      phone: rows.some((row) => row.phone),
    };
  },

  /** Creates the user, their profile and the first password history entry. */
  async createUser(db: Queryable, user: NewUser): Promise<UserRecord> {
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO usr_user (username, phone_country_code, phone_number, email, password_hash, status, is_phone_verified, last_login_at)
       VALUES ($1, $2, $3, $4, $5, $6, true, now())
       RETURNING id`,
      [user.username, user.phone.countryCode, user.phone.number, user.email, user.passwordHash, UserStatus.ACTIVE],
    );
    const id = rows[0]!.id;
    await db.query('INSERT INTO usr_user_profile (user_id, display_name) VALUES ($1, $2)', [id, user.fullName]);
    await db.query('INSERT INTO auth_password_history (user_id, password_hash) VALUES ($1, $2)', [id, user.passwordHash]);
    return (await authRepository.findUserById(db, id))!;
  },

  async recordLogin(db: Queryable, userId: string, options: { phoneVerified?: boolean; emailVerified?: boolean } = {}): Promise<void> {
    await db.query(
      `UPDATE usr_user
          SET last_login_at = now(),
              is_phone_verified = is_phone_verified OR $2,
              is_email_verified = is_email_verified OR $3,
              updated_at = CASE WHEN ($2 AND NOT is_phone_verified) OR ($3 AND NOT is_email_verified) THEN now() ELSE updated_at END
        WHERE id = $1`,
      [userId, options.phoneVerified ?? false, options.emailVerified ?? false],
    );
  },

  async updatePassword(db: Queryable, userId: string, passwordHash: string): Promise<void> {
    await db.query('UPDATE usr_user SET password_hash = $2, updated_at = now() WHERE id = $1', [userId, passwordHash]);
    await db.query('INSERT INTO auth_password_history (user_id, password_hash) VALUES ($1, $2)', [userId, passwordHash]);
  },

  async logLogin(db: Queryable, entry: LoginLogEntry): Promise<void> {
    const { identifier } = entry;
    await db.query(
      `INSERT INTO auth_login_log
         (user_id, username, phone_country_code, phone_number, login_method, action, status, failure_reason, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        entry.userId,
        identifier?.kind === 'username' ? identifier.value.slice(0, 50) : null,
        identifier?.kind === 'phone' ? identifier.value.countryCode : null,
        identifier?.kind === 'phone' ? identifier.value.number : null,
        entry.method,
        entry.action,
        entry.status,
        entry.failureReason ?? null,
        entry.client.ip ?? null,
        entry.client.userAgent ?? null,
      ],
    );
  },

  async createSession(db: Queryable, session: NewSession): Promise<string> {
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO auth_session (user_id, refresh_token_hash, expires_at, user_agent, ip_address, last_used_at)
       VALUES ($1, $2, $3, $4, $5, now())
       RETURNING id`,
      [session.userId, session.refreshTokenHash, session.expiresAt, session.client.userAgent ?? null, session.client.ip ?? null],
    );
    return rows[0]!.id;
  },

  /** Locks the session row so concurrent refreshes of the same token serialize. */
  async findSessionForUpdate(db: Queryable, sessionId: string): Promise<SessionRecord | null> {
    const { rows } = await db.query<SessionRecord>(
      `SELECT id, user_id AS "userId", refresh_token_hash AS "refreshTokenHash",
              expires_at AS "expiresAt", revoked_at AS "revokedAt"
         FROM auth_session WHERE id = $1 FOR UPDATE`,
      [sessionId],
    );
    return rows[0] ?? null;
  },

  async rotateSession(db: Queryable, sessionId: string, refreshTokenHash: string, expiresAt: Date): Promise<void> {
    await db.query(
      'UPDATE auth_session SET refresh_token_hash = $2, expires_at = $3, last_used_at = now() WHERE id = $1',
      [sessionId, refreshTokenHash, expiresAt],
    );
  },

  async revokeSession(db: Queryable, sessionId: string): Promise<void> {
    await db.query('UPDATE auth_session SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL', [sessionId]);
  },

  async revokeAllUserSessions(db: Queryable, userId: string): Promise<void> {
    await db.query('UPDATE auth_session SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [userId]);
  },

  /** True when the session is live and belongs to an active user; checked on every authenticated request. */
  async isSessionActive(db: Queryable, sessionId: string, userId: string): Promise<boolean> {
    const { rowCount } = await db.query(
      `SELECT 1
         FROM auth_session s JOIN usr_user u ON u.id = s.user_id
        WHERE s.id = $1 AND s.user_id = $2 AND s.revoked_at IS NULL AND s.expires_at > now() AND u.status = $3`,
      [sessionId, userId, UserStatus.ACTIVE],
    );
    return rowCount === 1;
  },

  /** Expires any outstanding code for this phone and purpose, so only the newest one works. */
  async expireOtps(db: Queryable, phone: Phone, purpose: OtpPurposeCode): Promise<void> {
    await db.query(
      `UPDATE auth_otp SET expires_at = now()
        WHERE phone_country_code = $1 AND phone_number = $2 AND purpose = $3 AND verified_at IS NULL AND expires_at > now()`,
      [phone.countryCode, phone.number, purpose],
    );
  },

  async createOtp(
    db: Queryable,
    otp: { userId: string | null; phone: Phone; purpose: OtpPurposeCode; otpHash: string; expiresAt: Date },
  ): Promise<void> {
    await db.query(
      `INSERT INTO auth_otp (user_id, phone_country_code, phone_number, otp_hash, purpose, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [otp.userId, otp.phone.countryCode, otp.phone.number, otp.otpHash, otp.purpose, otp.expiresAt],
    );
  },

  /** The newest live code for this phone and purpose, locked so concurrent checks serialize. */
  async findActiveOtpForUpdate(db: Queryable, phone: Phone, purpose: OtpPurposeCode): Promise<OtpRecord | null> {
    const { rows } = await db.query<OtpRecord>(
      `SELECT id, otp_hash AS "otpHash", attempt_count AS "attemptCount", max_attempts AS "maxAttempts"
         FROM auth_otp
        WHERE phone_country_code = $1 AND phone_number = $2 AND purpose = $3 AND verified_at IS NULL AND expires_at > now()
        ORDER BY created_at DESC
        LIMIT 1
          FOR UPDATE`,
      [phone.countryCode, phone.number, purpose],
    );
    return rows[0] ?? null;
  },

  async recordOtpAttempt(db: Queryable, otpId: string, verified: boolean): Promise<void> {
    await db.query(
      `UPDATE auth_otp
          SET attempt_count = attempt_count + 1, verified_at = CASE WHEN $2 THEN now() END
        WHERE id = $1`,
      [otpId, verified],
    );
  },
};

export type AuthRepository = typeof authRepository;
