import type pg from 'pg';
import type { Logger } from 'pino';
import { withTransaction, type Queryable } from '../../database/pool.js';
import { AppError } from '../../utils/app-error.js';
import type { AuthRepository, LoginLogEntry } from './auth.repository.js';
import {
  LoginAction,
  LoginMethod,
  LoginStatus,
  OtpPurpose,
  toPublicUser,
  UserStatus,
  type AuthContext,
  type AuthResult,
  type ClientContext,
  type IdentityProvider,
  type OtpPurposeCode,
  type PublicUser,
  type SocialProfile,
  type UserRecord,
} from './auth.types.js';
import type {
  AppleSignInInput,
  ForgotPasswordInput,
  GoogleSignInInput,
  LoginInput,
  PhoneStartInput,
  PhoneVerifyInput,
  RegisterCompleteInput,
  RegisterStartInput,
  ResetPasswordInput,
} from './auth.validation.js';
import type { OtpService } from './otp.service.js';
import { hashPassword, verifyAgainstDummy, verifyPassword } from './password.js';
import type { SocialIdentityVerifier } from './providers/social-identity.js';
import type { TokenService } from './token.service.js';
import type { SessionCache } from './session-cache.js';

const UNIQUE_VIOLATION = '23505';

export interface AuthServiceDeps {
  pool: pg.Pool;
  repository: AuthRepository;
  tokens: TokenService;
  otp: OtpService;
  google: SocialIdentityVerifier | null;
  apple: SocialIdentityVerifier | null;
  logger: Logger;
  /** Skips the per-request session lookup in Postgres while an answer is cached. */
  sessions?: SessionCache;
}

const errors = {
  invalidCredentials: () => AppError.unauthorized('INVALID_CREDENTIALS', 'Incorrect username/email/phone or password.'),
  invalidCode: () => AppError.badRequest('INVALID_CODE', 'That code is incorrect or has expired.'),
  invalidRefreshToken: () => AppError.unauthorized('INVALID_REFRESH_TOKEN', 'Your session has ended. Please sign in again.'),
  accountDisabled: () => AppError.forbidden('ACCOUNT_DISABLED', 'This account has been disabled.'),
  usernameTaken: () => AppError.conflict('USERNAME_TAKEN', 'This username is already taken.'),
  emailTaken: () => AppError.conflict('EMAIL_TAKEN', 'An account with this email already exists.'),
  phoneTaken: () => AppError.conflict('PHONE_TAKEN', 'An account with this phone number already exists.'),
  accountExists: () => AppError.conflict('ACCOUNT_EXISTS', 'An account with these details already exists.'),
  socialAccountNotFound: () =>
    new AppError(404, 'ACCOUNT_NOT_FOUND', 'No account uses this email. Create an account first, then sign in with it.'),
};

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === UNIQUE_VIOLATION;
}

export class AuthService {
  constructor(private readonly deps: AuthServiceDeps) {}

  /** Step 1 of sign-up: reject duplicates, then text a code to the phone number. */
  async startRegistration(input: RegisterStartInput): Promise<void> {
    await this.assertAvailable(input);
    await this.deps.otp.send(input.phone, OtpPurpose.REGISTRATION, null);
  }

  /** Step 2 of sign-up: verify the code and create the account and its first session. */
  async completeRegistration(input: RegisterCompleteInput, client: ClientContext): Promise<AuthResult> {
    await this.assertAvailable(input);
    if (!(await this.deps.otp.verify(input.phone, OtpPurpose.REGISTRATION, input.code))) throw errors.invalidCode();
    const passwordHash = await hashPassword(input.password);

    try {
      return await withTransaction(this.deps.pool, async (db) => {
        const user = await this.deps.repository.createUser(db, {
          username: input.username,
          fullName: input.fullName,
          email: input.email,
          phone: input.phone,
          passwordHash,
        });
        return this.issueSession(db, user, client);
      });
    } catch (error) {
      // Another sign-up claimed the username/email/phone between the check and the insert.
      if (isUniqueViolation(error)) throw errors.accountExists();
      throw error;
    }
  }

  async login(input: LoginInput, client: ClientContext): Promise<AuthResult> {
    const { repository, pool } = this.deps;
    const user = await repository.findUserByIdentifier(pool, input.identifier);
    const attempt = { userId: user?.id ?? null, identifier: input.identifier, method: LoginMethod.PASSWORD, client };

    const passwordOk = user ? await verifyPassword(user.passwordHash, input.password) : await verifyAgainstDummy(input.password);
    if (!user || !passwordOk) {
      await this.logAttempt({ ...attempt, failureReason: user ? 'wrong_password' : 'unknown_account' });
      throw errors.invalidCredentials();
    }
    await this.assertActive(user, attempt);

    await repository.recordLogin(pool, user.id);
    await this.logAttempt(attempt);
    return this.issueSession(pool, user, client);
  }

  /** Sends a sign-in code only to registered numbers; the response never reveals which. */
  async startPhoneLogin(input: PhoneStartInput): Promise<void> {
    const user = await this.deps.repository.findUserByIdentifier(this.deps.pool, { kind: 'phone', value: input.phone });
    if (user?.status === UserStatus.ACTIVE) await this.sendCodeSilently(user, OtpPurpose.PHONE_LOGIN);
  }

  async completePhoneLogin(input: PhoneVerifyInput, client: ClientContext): Promise<AuthResult> {
    const { repository, pool } = this.deps;
    const identifier = { kind: 'phone', value: input.phone } as const;
    const user = await repository.findUserByIdentifier(pool, identifier);
    const attempt = { userId: user?.id ?? null, identifier, method: LoginMethod.OTP, client };
    if (!user) throw errors.invalidCode();

    if (!(await this.deps.otp.verify(input.phone, OtpPurpose.PHONE_LOGIN, input.code))) {
      await this.logAttempt({ ...attempt, failureReason: 'invalid_code' });
      throw errors.invalidCode();
    }
    await this.assertActive(user, attempt);

    await repository.recordLogin(pool, user.id, { phoneVerified: true });
    await this.logAttempt(attempt);
    return this.issueSession(pool, user, client);
  }

  /** Texts a reset code to the account's phone; the response never reveals whether the account exists. */
  async forgotPassword(input: ForgotPasswordInput): Promise<void> {
    const user = await this.deps.repository.findUserByIdentifier(this.deps.pool, input.identifier);
    if (user?.status === UserStatus.ACTIVE) await this.sendCodeSilently(user, OtpPurpose.PASSWORD_RESET);
  }

  /** Sets a new password and signs out every device. */
  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const { repository, pool } = this.deps;
    const user = await repository.findUserByIdentifier(pool, input.identifier);
    if (!user) throw errors.invalidCode();
    if (!(await this.deps.otp.verify(user.phone, OtpPurpose.PASSWORD_RESET, input.code))) throw errors.invalidCode();
    if (user.status !== UserStatus.ACTIVE) throw errors.accountDisabled();

    const passwordHash = await hashPassword(input.newPassword);
    await withTransaction(pool, async (db) => {
      await repository.updatePassword(db, user.id, passwordHash);
      await repository.revokeAllUserSessions(db, user.id);
    });
    await this.deps.sessions?.revokeUser(user.id);
  }

  async signInWithGoogle(input: GoogleSignInInput, client: ClientContext): Promise<AuthResult> {
    const profile = await this.requireVerifier(this.deps.google, 'Google').verify(input.idToken);
    return this.socialSignIn('google', profile, client);
  }

  async signInWithApple(input: AppleSignInInput, client: ClientContext): Promise<AuthResult> {
    const profile = await this.requireVerifier(this.deps.apple, 'Apple').verify(input.identityToken);
    return this.socialSignIn('apple', profile, client);
  }

  /** Rotates the refresh token. Replaying an already-rotated token revokes the whole session. */
  async refresh(refreshToken: string): Promise<AuthResult> {
    const { tokens, repository, pool } = this.deps;
    const parsed = tokens.parseRefreshToken(refreshToken);
    if (!parsed) throw errors.invalidRefreshToken();

    let reusedSessionId: string | null = null;
    const outcome = await withTransaction(pool, async (db) => {
      const session = await repository.findSessionForUpdate(db, parsed.sessionId);
      if (!session || session.revokedAt || session.expiresAt <= new Date()) return null;

      if (!tokens.secretMatches(parsed.secret, session.refreshTokenHash)) {
        this.deps.logger.warn({ sessionId: session.id, userId: session.userId }, 'Refresh token reuse detected; session revoked');
        await repository.revokeSession(db, session.id);
        reusedSessionId = session.id;
        return null;
      }

      const user = await repository.findUserById(db, session.userId);
      if (!user || user.status !== UserStatus.ACTIVE) return null;

      const { secret, hash } = tokens.generateRefreshSecret();
      const refreshExpiresAt = tokens.refreshExpiry();
      await repository.rotateSession(db, session.id, hash, refreshExpiresAt);
      return { user, sessionId: session.id, secret, refreshExpiresAt };
    });

    if (reusedSessionId) await this.deps.sessions?.revokeSession(reusedSessionId);
    if (!outcome) throw errors.invalidRefreshToken();
    return this.buildAuthResult(outcome.user, outcome.sessionId, outcome.secret, outcome.refreshExpiresAt);
  }

  /** Revokes the session the refresh token belongs to. Idempotent: unknown tokens are ignored. */
  async logout(refreshToken: string, client: ClientContext): Promise<void> {
    const { tokens, repository, pool } = this.deps;
    const parsed = tokens.parseRefreshToken(refreshToken);
    if (!parsed) return;

    const userId = await withTransaction(pool, async (db) => {
      const session = await repository.findSessionForUpdate(db, parsed.sessionId);
      if (session && !session.revokedAt && tokens.secretMatches(parsed.secret, session.refreshTokenHash)) {
        await repository.revokeSession(db, session.id);
        return session.userId;
      }
      return null;
    });
    if (userId) await this.deps.sessions?.revokeSession(parsed.sessionId);
    if (userId) {
      await this.logAttempt({ userId, identifier: null, method: LoginMethod.PASSWORD, action: LoginAction.LOGOUT, client });
    }
  }

  async getCurrentUser(auth: AuthContext): Promise<PublicUser> {
    const user = await this.deps.repository.findUserById(this.deps.pool, auth.userId);
    if (!user) throw errors.invalidRefreshToken();
    return toPublicUser(user);
  }

  /** Resolves a bearer access token to a live session; used by the authenticate middleware. */
  async authenticate(accessToken: string): Promise<AuthContext> {
    const auth = await this.deps.tokens.verifyAccessToken(accessToken);
    if (await this.deps.sessions?.isActive(auth.sessionId, auth.userId)) return auth;
    const active = await this.deps.repository.isSessionActive(this.deps.pool, auth.sessionId, auth.userId);
    if (!active) throw AppError.unauthorized('SESSION_REVOKED', 'Your session has ended. Please sign in again.');
    await this.deps.sessions?.markActive(auth.sessionId);
    return auth;
  }

  /**
   * The schema has no provider-identity table and `usr_user` requires a username, phone and
   * password, so social sign-in only signs in an existing account whose email the provider has verified.
   */
  private async socialSignIn(provider: IdentityProvider, profile: SocialProfile, client: ClientContext): Promise<AuthResult> {
    const { repository, pool } = this.deps;
    if (!profile.email || !profile.emailVerified) {
      throw AppError.badRequest('EMAIL_NOT_VERIFIED', 'Your account with this provider has no verified email.');
    }
    const identifier = { kind: 'email', value: profile.email } as const;
    const user = await repository.findUserByIdentifier(pool, identifier);
    const attempt = {
      userId: user?.id ?? null,
      identifier,
      method: provider === 'google' ? LoginMethod.GOOGLE : LoginMethod.APPLE,
      client,
    };
    if (!user) {
      await this.logAttempt({ ...attempt, failureReason: 'unknown_account' });
      throw errors.socialAccountNotFound();
    }
    await this.assertActive(user, attempt);

    // A provider-verified email proves ownership of the address.
    await repository.recordLogin(pool, user.id, { emailVerified: true });
    await this.logAttempt(attempt);
    return this.issueSession(pool, { ...user, isEmailVerified: true }, client);
  }

  private async issueSession(db: Queryable, user: UserRecord, client: ClientContext): Promise<AuthResult> {
    const { secret, hash } = this.deps.tokens.generateRefreshSecret();
    const refreshExpiresAt = this.deps.tokens.refreshExpiry();
    const sessionId = await this.deps.repository.createSession(db, {
      userId: user.id,
      refreshTokenHash: hash,
      expiresAt: refreshExpiresAt,
      client,
    });
    return this.buildAuthResult(user, sessionId, secret, refreshExpiresAt);
  }

  private async buildAuthResult(user: UserRecord, sessionId: string, secret: string, refreshExpiresAt: Date): Promise<AuthResult> {
    const access = await this.deps.tokens.signAccessToken({ userId: user.id, sessionId });
    return {
      user: toPublicUser(user),
      tokens: {
        accessToken: access.token,
        accessTokenExpiresAt: access.expiresAt.toISOString(),
        refreshToken: this.deps.tokens.formatRefreshToken(sessionId, secret),
        refreshTokenExpiresAt: refreshExpiresAt.toISOString(),
      },
    };
  }

  private async assertAvailable(input: RegisterStartInput): Promise<void> {
    const taken = await this.deps.repository.findTakenFields(this.deps.pool, input);
    if (taken.username) throw errors.usernameTaken();
    if (taken.email) throw errors.emailTaken();
    if (taken.phone) throw errors.phoneTaken();
  }

  private async assertActive(user: UserRecord, attempt: Omit<LoginLogEntry, 'action' | 'status'>): Promise<void> {
    if (user.status === UserStatus.ACTIVE) return;
    await this.logAttempt({ ...attempt, failureReason: 'account_disabled' });
    throw errors.accountDisabled();
  }

  /**
   * Writes `auth_login_log`. Best effort: a logging failure must not block signing in.
   * Entries with a failureReason are recorded as failed.
   */
  private async logAttempt(entry: Omit<LoginLogEntry, 'action' | 'status'> & { action?: number }): Promise<void> {
    try {
      await this.deps.repository.logLogin(this.deps.pool, {
        ...entry,
        action: entry.action ?? LoginAction.LOGIN,
        status: entry.failureReason ? LoginStatus.FAILED : LoginStatus.SUCCESS,
      });
    } catch (error) {
      this.deps.logger.error({ err: error }, 'Failed to write auth_login_log');
    }
  }

  /** Used where revealing a send failure would reveal that the account exists. */
  private async sendCodeSilently(user: UserRecord, purpose: OtpPurposeCode): Promise<void> {
    try {
      await this.deps.otp.send(user.phone, purpose, user.id);
    } catch (error) {
      this.deps.logger.error({ err: error }, 'Failed to send verification SMS');
    }
  }

  private requireVerifier(verifier: SocialIdentityVerifier | null, name: string): SocialIdentityVerifier {
    if (!verifier) throw AppError.serviceUnavailable('PROVIDER_NOT_CONFIGURED', `${name} sign-in is not available.`);
    return verifier;
  }
}
