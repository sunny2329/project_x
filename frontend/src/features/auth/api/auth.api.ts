import { apiRequest } from '@/shared/api/client';
import type { AuthResult, MessageResponse, RegistrationForm, User } from '../types';

const BASE = '/api/v1/auth';

/** One function per backend endpoint; see wiki.md "Auth API" for the contracts. */
export const authApi = {
  startRegistration: (form: RegistrationForm) =>
    apiRequest<MessageResponse>(`${BASE}/register/start`, { method: 'POST', body: form }),

  completeRegistration: (form: RegistrationForm, code: string) =>
    apiRequest<AuthResult>(`${BASE}/register/complete`, { method: 'POST', body: { ...form, code } }),

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
};
