import * as SecureStore from 'expo-secure-store';
import { apiRequest, ApiError } from '@/shared/api/client';
import { useAuthStore } from '../store/auth.store';
import { authResult, fail, ok } from './test-utils';

jest.mock('../social/google', () => ({ getGoogleIdToken: jest.fn(), signOutOfGoogle: jest.fn() }));
jest.mock('../social/apple', () => ({ getAppleCredential: jest.fn(), isAppleSignInAvailable: jest.fn() }));

const fetchMock = jest.fn();
global.fetch = fetchMock;
const secureStore = (SecureStore as unknown as { __store: Map<string, string> }).__store;

function lastRequest() {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return { url, init, body: init.body ? JSON.parse(String(init.body)) : undefined };
}

beforeEach(async () => {
  fetchMock.mockReset();
  secureStore.clear();
  // Drop any in-memory session left by a previous test, then reset to the start-up state.
  fetchMock.mockResolvedValueOnce(ok(undefined, 204));
  await useAuthStore.getState().signOut();
  fetchMock.mockReset();
  useAuthStore.setState({ status: 'checking', user: null, pendingRegistration: null });
});

describe('auth store', () => {
  it('signs in, persists the session securely and becomes authenticated', async () => {
    fetchMock.mockResolvedValueOnce(ok(authResult()));
    await useAuthStore.getState().signIn('athlete@example.com', 'Sprint2026');

    expect(lastRequest().url).toBe('http://api.test/api/v1/auth/login');
    expect(lastRequest().body).toEqual({ identifier: 'athlete@example.com', password: 'Sprint2026' });
    expect(useAuthStore.getState()).toMatchObject({ status: 'authenticated', user: { fullName: 'Test Athlete' } });
    const stored = JSON.parse(secureStore.get('projectx.auth.session')!);
    expect(stored.refreshToken).toBe('refresh-1');
  });

  it('surfaces API errors without changing state', async () => {
    fetchMock.mockResolvedValueOnce(fail(401, 'INVALID_CREDENTIALS', 'Incorrect email/phone or password.'));
    await expect(useAuthStore.getState().signIn('a@b.co', 'x')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(useAuthStore.getState().status).toBe('checking');
  });

  it('restores a stored session on start-up by rotating the refresh token', async () => {
    fetchMock.mockResolvedValueOnce(ok(authResult()));
    await useAuthStore.getState().signIn('athlete@example.com', 'Sprint2026');
    useAuthStore.setState({ status: 'checking', user: null });

    fetchMock.mockResolvedValueOnce(ok(authResult({ accessToken: 'access-2', refreshToken: 'refresh-2' })));
    await useAuthStore.getState().bootstrap();

    expect(lastRequest().body).toEqual({ refreshToken: 'refresh-1' });
    expect(useAuthStore.getState().status).toBe('authenticated');
    expect(JSON.parse(secureStore.get('projectx.auth.session')!).refreshToken).toBe('refresh-2');
  });

  it('signs out on start-up when the stored session was revoked', async () => {
    fetchMock.mockResolvedValueOnce(ok(authResult()));
    await useAuthStore.getState().signIn('athlete@example.com', 'Sprint2026');

    fetchMock.mockResolvedValueOnce(fail(401, 'INVALID_REFRESH_TOKEN'));
    await useAuthStore.getState().bootstrap();

    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expect(secureStore.has('projectx.auth.session')).toBe(false);
  });

  it('stays signed in with the cached user when offline at start-up', async () => {
    fetchMock.mockResolvedValueOnce(ok(authResult()));
    await useAuthStore.getState().signIn('athlete@example.com', 'Sprint2026');

    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
    await useAuthStore.getState().bootstrap();

    expect(useAuthStore.getState()).toMatchObject({ status: 'authenticated', user: { id: 'user-1' } });
  });

  it('with no stored session, start-up is unauthenticated without any request', async () => {
    await useAuthStore.getState().bootstrap();
    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('signOut clears local state and revokes the session on the server', async () => {
    fetchMock.mockResolvedValueOnce(ok(authResult()));
    await useAuthStore.getState().signIn('athlete@example.com', 'Sprint2026');

    fetchMock.mockResolvedValueOnce(ok(undefined, 204));
    await useAuthStore.getState().signOut();

    expect(lastRequest().url).toBe('http://api.test/api/v1/auth/logout');
    expect(lastRequest().body).toEqual({ refreshToken: 'refresh-1' });
    expect(useAuthStore.getState()).toMatchObject({ status: 'unauthenticated', user: null });
    expect(secureStore.has('projectx.auth.session')).toBe(false);
  });

  it('keeps the sign-up form in memory between the form and code screens', async () => {
    const form = { username: 'athlete', fullName: 'Test Athlete', email: 'athlete@example.com', phone: '+919876543210', password: 'Sprint2026' };
    fetchMock.mockResolvedValueOnce(ok({ message: 'Verification code sent.' }));
    await useAuthStore.getState().startRegistration(form);

    fetchMock.mockResolvedValueOnce(ok(authResult(), 201));
    await useAuthStore.getState().completeRegistration('123456');

    expect(lastRequest().body).toEqual({ ...form, code: '123456' });
    expect(useAuthStore.getState()).toMatchObject({ status: 'authenticated', pendingRegistration: null });
  });
});

describe('authenticated requests', () => {
  async function signInWith(expiresInMs: number) {
    fetchMock.mockResolvedValueOnce(ok(authResult({ expiresInMs })));
    await useAuthStore.getState().signIn('athlete@example.com', 'Sprint2026');
  }

  it('attaches the bearer token', async () => {
    await signInWith(15 * 60_000);
    fetchMock.mockResolvedValueOnce(ok({ user: authResult().user }));
    await apiRequest('/api/v1/auth/me', { authenticated: true });
    expect((lastRequest().init.headers as Record<string, string>).Authorization).toBe('Bearer access-1');
  });

  it('refreshes proactively when the access token is about to expire', async () => {
    await signInWith(5_000);
    fetchMock
      .mockResolvedValueOnce(ok(authResult({ accessToken: 'access-2', refreshToken: 'refresh-2' })))
      .mockResolvedValueOnce(ok({ user: authResult().user }));
    await apiRequest('/api/v1/auth/me', { authenticated: true });

    expect(fetchMock.mock.calls.at(-2)![0]).toBe('http://api.test/api/v1/auth/refresh');
    expect((lastRequest().init.headers as Record<string, string>).Authorization).toBe('Bearer access-2');
  });

  it('refreshes once and retries after ACCESS_TOKEN_EXPIRED, sharing a single refresh across concurrent calls', async () => {
    await signInWith(15 * 60_000);
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (url.endsWith('/refresh')) return ok(authResult({ accessToken: 'access-2', refreshToken: 'refresh-2' }));
      const auth = (init.headers as Record<string, string>).Authorization;
      return auth === 'Bearer access-2' ? ok({ user: authResult().user }) : fail(401, 'ACCESS_TOKEN_EXPIRED');
    });

    await Promise.all([
      apiRequest('/api/v1/auth/me', { authenticated: true }),
      apiRequest('/api/v1/auth/me', { authenticated: true }),
    ]);
    const refreshCalls = fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/refresh'));
    expect(refreshCalls).toHaveLength(1);
  });

  it('signs the user out when the session was revoked server-side', async () => {
    await signInWith(15 * 60_000);
    fetchMock.mockResolvedValueOnce(fail(401, 'SESSION_REVOKED'));
    await expect(apiRequest('/api/v1/auth/me', { authenticated: true })).rejects.toBeInstanceOf(ApiError);
    await Promise.resolve();
    expect(useAuthStore.getState().status).toBe('unauthenticated');
  });

  it('normalizes network failures', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
    await expect(apiRequest('/health')).rejects.toMatchObject({ code: 'NETWORK_ERROR', status: 0 });
  });
});
