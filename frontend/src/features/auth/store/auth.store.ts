import { create } from 'zustand';
import { ApiError, registerSessionHandlers } from '@/shared/api/client';
import { authApi } from '../api/auth.api';
import { getAppleCredential } from '../social/apple';
import { getGoogleIdToken, signOutOfGoogle } from '../social/google';
import { sessionStorage, toStoredSession, type StoredSession } from '../storage/session-storage';
import type { AuthResult, PendingSignup, User } from '../types';

export type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated';

/** Refresh slightly before expiry so a request never leaves with a token about to lapse. */
const ACCESS_TOKEN_LEEWAY_MS = 30_000;

interface AuthState {
  status: AuthStatus;
  user: User | null;
  /** Sign-up in progress, kept in memory (never in route params). */
  pendingSignup: PendingSignup | null;
  /** Set right after sign-up: the app shows "What do you play?" and "Claim matches" before Home. */
  onboarding: boolean;

  bootstrap(): Promise<void>;
  signIn(identifier: string, password: string): Promise<void>;
  /** Step 1: phone + username, texts a code. */
  startSignup(phone: string, username: string): Promise<void>;
  resendSignupCode(): Promise<void>;
  /** Step 2: checks the code. */
  verifySignup(code: string): Promise<void>;
  /** Step 3: creates the account and signs in. */
  completeSignup(details: { fullName: string; displayName: string; password: string }): Promise<void>;
  finishOnboarding(): void;
  startPhoneSignIn(phone: string): Promise<void>;
  verifyPhoneSignIn(phone: string, code: string): Promise<void>;
  requestPasswordReset(identifier: string): Promise<void>;
  resetPassword(identifier: string, code: string, newPassword: string): Promise<void>;
  /** Resolves false when the user dismissed the provider sheet. */
  signInWithGoogle(): Promise<boolean>;
  signInWithApple(): Promise<boolean>;
  signOut(): Promise<void>;
  /** Re-fetches the signed-in user from the server. */
  syncUser(): Promise<void>;
}

// Tokens are kept outside React state so they never trigger renders or end up in devtools.
let session: StoredSession | null = null;
let refreshInFlight: Promise<string | null> | null = null;

export const useAuthStore = create<AuthState>()((set, get) => {
  async function establishSession(result: AuthResult): Promise<void> {
    session = toStoredSession(result);
    await sessionStorage.save(session);
    set({ status: 'authenticated', user: result.user, pendingSignup: null });
  }

  async function clearLocalSession(): Promise<void> {
    session = null;
    await sessionStorage.clear();
    set({ status: 'unauthenticated', user: null, onboarding: false });
  }

  /**
   * Single-flight: concurrent callers share one request, because the backend treats a
   * second use of the same refresh token as theft and revokes the session.
   */
  function refreshAccessToken(): Promise<string | null> {
    refreshInFlight ??= (async () => {
      const current = session;
      if (!current) return null;
      try {
        await establishSession(await authApi.refresh(current.refreshToken));
        return session?.accessToken ?? null;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          await clearLocalSession();
          return null;
        }
        throw error;
      }
    })().finally(() => {
      refreshInFlight = null;
    });
    return refreshInFlight;
  }

  registerSessionHandlers({
    async getAccessToken() {
      if (!session) return null;
      const expiresAt = Date.parse(session.accessTokenExpiresAt);
      return expiresAt - Date.now() > ACCESS_TOKEN_LEEWAY_MS ? session.accessToken : refreshAccessToken();
    },
    refreshAccessToken,
    onSessionExpired: () => void clearLocalSession(),
  });

  return {
    status: 'checking',
    user: null,
    pendingSignup: null,
    onboarding: false,

    async bootstrap() {
      const stored = await sessionStorage.load().catch(() => null);
      if (!stored) return set({ status: 'unauthenticated' });

      session = stored;
      set({ status: 'authenticated', user: stored.user });
      try {
        await refreshAccessToken();
      } catch {
        // Offline or server unreachable: stay signed in with the cached user; the next
        // authenticated request refreshes again.
      }
    },

    async signIn(identifier, password) {
      await establishSession(await authApi.login(identifier, password));
    },

    async startSignup(phone, username) {
      await authApi.startRegistration(phone, username);
      set({ pendingSignup: { phone, username, registrationToken: null } });
    },

    async resendSignupCode() {
      const pending = get().pendingSignup;
      if (pending) await authApi.startRegistration(pending.phone, pending.username);
    },

    async verifySignup(code) {
      const pending = get().pendingSignup;
      if (!pending) throw new ApiError(0, 'REGISTRATION_EXPIRED', 'Please enter your phone number again.');
      const { registrationToken } = await authApi.verifyRegistration(pending.phone, code);
      set({ pendingSignup: { ...pending, registrationToken } });
    },

    async completeSignup(details) {
      const pending = get().pendingSignup;
      if (!pending?.registrationToken) throw new ApiError(0, 'REGISTRATION_EXPIRED', 'Please verify your phone number again.');
      const result = await authApi.completeRegistration({ ...details, username: pending.username, registrationToken: pending.registrationToken });
      set({ onboarding: true });
      await establishSession(result);
    },

    finishOnboarding() {
      set({ onboarding: false });
    },

    async startPhoneSignIn(phone) {
      await authApi.startPhoneSignIn(phone);
    },

    async verifyPhoneSignIn(phone, code) {
      await establishSession(await authApi.verifyPhoneSignIn(phone, code));
    },

    async requestPasswordReset(identifier) {
      await authApi.forgotPassword(identifier);
    },

    async resetPassword(identifier, code, newPassword) {
      await authApi.resetPassword(identifier, code, newPassword);
    },

    async signInWithGoogle() {
      const idToken = await getGoogleIdToken();
      if (!idToken) return false;
      await establishSession(await authApi.google(idToken));
      return true;
    },

    async signInWithApple() {
      const credential = await getAppleCredential();
      if (!credential) return false;
      await establishSession(await authApi.apple(credential.identityToken, credential.fullName));
      return true;
    },

    async signOut() {
      const refreshToken = session?.refreshToken;
      // Sign out locally first so the UI never waits on the network.
      await clearLocalSession();
      await signOutOfGoogle();
      if (refreshToken) await authApi.logout(refreshToken).catch(() => undefined);
    },

    async syncUser() {
      const { user } = await authApi.me();
      if (!session) return;
      session = { ...session, user };
      await sessionStorage.save(session);
      set({ user });
    },
  };
});
