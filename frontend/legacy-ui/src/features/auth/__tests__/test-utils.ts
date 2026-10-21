import type { AuthResult } from '../types';

export function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

export const ok = <T>(data: T, status = 200) => jsonResponse(status, { success: true, data });

export const fail = (status: number, code: string, message = code, details?: Record<string, string[]>) =>
  jsonResponse(status, { success: false, error: { code, message, ...(details ? { details } : {}) } });

export function authResult(overrides: { accessToken?: string; refreshToken?: string; expiresInMs?: number } = {}): AuthResult {
  return {
    user: {
      id: 'user-1',
      username: 'athlete',
      fullName: 'Test Athlete',
      email: 'athlete@example.com',
      phone: '+919876543210',
      emailVerified: false,
      phoneVerified: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    tokens: {
      accessToken: overrides.accessToken ?? 'access-1',
      accessTokenExpiresAt: new Date(Date.now() + (overrides.expiresInMs ?? 15 * 60_000)).toISOString(),
      refreshToken: overrides.refreshToken ?? 'refresh-1',
      refreshTokenExpiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    },
  };
}
