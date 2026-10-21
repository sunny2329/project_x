import { apiRequest } from '@/shared/api/client';
import type { AuthResult, LinkedIdentity, MessageResponse, SessionInfo, SignupDetails, User } from '../types';

const BASE = '/api/v1/auth';

/** One function per backend endpoint (backend/src/modules/auth/auth.routes.ts). */
export const authApi = {
  usernameAvailable: (username: string) =>
    apiRequest<{ available: boolean; reason: string | null }>(`${BASE}/username-available?username=${encodeURIComponent(username)}`),

  /** Sign-up step 1: texts a code to the phone (the username is checked too). */
  startRegistration: (phone: string, username: string) =>
    apiRequest<MessageResponse>(`${BASE}/register/start`, { method: 'POST', body: { phone, username } }),

  /** Step 2: the code -> a token proving the phone is verified. */
  verifyRegistration: (phone: string, code: string) =>
    apiRequest<{ registrationToken: string }>(`${BASE}/register/verify`, { method: 'POST', body: { phone, code } }),

  /** Step 3: creates the account. */
  completeRegistration: (details: SignupDetails) =>
    apiRequest<AuthResult>(`${BASE}/register/complete`, { method: 'POST', body: details }),

  login: (identifier: string, password: string) =>
    apiRequest<AuthResult>(`${BASE}/login`, { method: 'POST', body: { identifier, password } }),

  startPhoneSignIn: (phone: string) =>
    apiRequest<MessageResponse>(`${BASE}/phone/start`, { method: 'POST', body: { phone } }),

  verifyPhoneSignIn: (phone: string, code: string) =>
    apiRequest<AuthResult>(`${BASE}/phone/verify`, { method: 'POST', body: { phone, code } }),

  forgotPassword: (identifier: string) =>
    apiRequest<MessageResponse>(`${BASE}/password/forgot`, { method: 'POST', body: { identifier } }),

  resetPassword: (identifier: string, code: string, newPassword: string) =>
    apiRequest<MessageResponse>(`${BASE}/password/reset`, { method: 'POST', body: { identifier, code, newPassword } }),

  google: (idToken: string) => apiRequest<AuthResult>(`${BASE}/google`, { method: 'POST', body: { idToken } }),

  apple: (identityToken: string, fullName?: string) =>
    apiRequest<AuthResult>(`${BASE}/apple`, { method: 'POST', body: { identityToken, fullName } }),

  refresh: (refreshToken: string) =>
    apiRequest<AuthResult>(`${BASE}/refresh`, { method: 'POST', body: { refreshToken } }),

  logout: (refreshToken: string) => apiRequest<void>(`${BASE}/logout`, { method: 'POST', body: { refreshToken } }),

  me: () => apiRequest<{ user: User }>(`${BASE}/me`, { authenticated: true }),

  sessions: () => apiRequest<{ sessions: SessionInfo[] }>(`${BASE}/sessions`, { authenticated: true }),

  signOutOtherDevices: () =>
    apiRequest<{ signedOut: number }>(`${BASE}/sessions/sign-out-others`, { method: 'POST', authenticated: true }),

  identities: () => apiRequest<{ identities: LinkedIdentity[] }>(`${BASE}/identities`, { authenticated: true }),

  linkGoogle: (idToken: string) =>
    apiRequest<{ identities: LinkedIdentity[] }>(`${BASE}/identities/google`, { method: 'POST', body: { idToken }, authenticated: true }),

  linkApple: (identityToken: string) =>
    apiRequest<{ identities: LinkedIdentity[] }>(`${BASE}/identities/apple`, { method: 'POST', body: { identityToken }, authenticated: true }),

  unlink: (provider: 'google' | 'apple') =>
    apiRequest<{ identities: LinkedIdentity[] }>(`${BASE}/identities/${provider}`, { method: 'DELETE', authenticated: true }),
};
