/** Mirrors the backend `PublicUser` (backend/src/modules/auth/auth.types.ts). */
export interface User {
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
  user: User;
  tokens: AuthTokens;
}

/** Sign-up in progress: phone + username (step 1), then the token from the code (step 2). */
export interface PendingSignup {
  phone: string;
  username: string;
  registrationToken: string | null;
}

export interface SignupDetails {
  registrationToken: string;
  username: string;
  fullName: string;
  displayName: string;
  password: string;
}

export interface SessionInfo {
  id: string;
  deviceName: string | null;
  userAgent: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  current: boolean;
}

export interface LinkedIdentity {
  provider: 'google' | 'apple';
  email: string | null;
  linkedAt: string;
}

export interface MessageResponse {
  message: string;
}
