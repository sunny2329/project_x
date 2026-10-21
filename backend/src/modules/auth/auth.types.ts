import { toE164, type Phone } from './phone.js';

/*
 * Integer codes stored in the project_x schema. `type_master` holds no rows yet, so the values
 * are defined here; see wiki.md "Auth module > Status codes".
 */
export const UserStatus = { ACTIVE: 1, SUSPENDED: 2, DELETED: 3 } as const;
export const OtpPurpose = { REGISTRATION: 1, PHONE_LOGIN: 2, PASSWORD_RESET: 3 } as const;
export const LoginMethod = { PASSWORD: 1, OTP: 2, GOOGLE: 3, APPLE: 4 } as const;
export const LoginAction = { LOGIN: 1, LOGOUT: 2 } as const;
export const LoginStatus = { SUCCESS: 1, FAILED: 2 } as const;

export type OtpPurposeCode = (typeof OtpPurpose)[keyof typeof OtpPurpose];
export type LoginMethodCode = (typeof LoginMethod)[keyof typeof LoginMethod];
export type IdentityProvider = 'google' | 'apple';

/** `usr_user` joined with `usr_user_profile`. */
export interface UserRecord {
  id: string;
  username: string;
  fullName: string | null;
  email: string | null;
  phone: Phone;
  passwordHash: string;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  status: number;
  createdAt: Date;
}

export interface SessionRecord {
  id: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface OtpRecord {
  id: string;
  otpHash: string;
  attemptCount: number;
  maxAttempts: number;
}

/** The only user shape that is ever serialized to clients. */
export interface PublicUser {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  phone: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

export interface AuthResult {
  user: PublicUser;
  tokens: AuthTokens;
}

/** Request metadata stored with sessions and login log entries. */
export interface ClientContext {
  ip: string | undefined;
  userAgent: string | undefined;
  /** "Pixel 8": sent by the app in X-Device-Name, shown under Settings > Devices. */
  deviceName?: string | undefined;
}

/** A signed-in device, for Settings > Devices. */
export interface SessionInfo {
  id: string;
  deviceName: string | null;
  userAgent: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  current: boolean;
}

/** A Google or Apple account linked for sign-in. */
export interface LinkedIdentity {
  provider: IdentityProvider;
  email: string | null;
  linkedAt: string;
}

export interface AuthContext {
  userId: string;
  sessionId: string;
}

/** Identity asserted by a verified Google/Apple token. */
export interface SocialProfile {
  subject: string;
  email: string | null;
  emailVerified: boolean;
  fullName: string | null;
}

export type Identifier =
  | { kind: 'email'; value: string }
  | { kind: 'phone'; value: Phone }
  | { kind: 'username'; value: string };

export function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName ?? user.username,
    email: user.email,
    phone: toE164(user.phone),
    emailVerified: user.isEmailVerified,
    phoneVerified: user.isPhoneVerified,
    createdAt: user.createdAt.toISOString(),
  };
}
