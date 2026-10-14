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

export interface RegistrationForm {
  username: string;
  fullName: string;
  email: string;
  phone: string;
  password: string;
}

export interface MessageResponse {
  message: string;
}
