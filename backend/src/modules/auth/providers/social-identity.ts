import { OAuth2Client } from 'google-auth-library';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { AppError } from '../../../utils/app-error.js';
import type { SocialProfile } from '../auth.types.js';

/** Verifies a provider-issued token and returns the identity it asserts. */
export interface SocialIdentityVerifier {
  verify(token: string): Promise<SocialProfile>;
}

const invalidToken = () => AppError.unauthorized('INVALID_SOCIAL_TOKEN', 'Sign-in with this provider failed. Try again.');

export class GoogleIdentityVerifier implements SocialIdentityVerifier {
  private readonly client = new OAuth2Client();

  constructor(private readonly clientIds: string[]) {}

  async verify(idToken: string): Promise<SocialProfile> {
    try {
      const ticket = await this.client.verifyIdToken({ idToken, audience: this.clientIds });
      const payload = ticket.getPayload();
      if (!payload?.sub) throw new Error('Missing subject');
      return {
        subject: payload.sub,
        email: payload.email?.toLowerCase() ?? null,
        emailVerified: payload.email_verified === true,
        fullName: payload.name ?? null,
      };
    } catch {
      throw invalidToken();
    }
  }
}

const APPLE_ISSUER = 'https://appleid.apple.com';
const appleKeys = createRemoteJWKSet(new URL(`${APPLE_ISSUER}/auth/keys`));

export class AppleIdentityVerifier implements SocialIdentityVerifier {
  constructor(private readonly bundleIds: string[]) {}

  async verify(identityToken: string): Promise<SocialProfile> {
    try {
      const { payload } = await jwtVerify(identityToken, appleKeys, {
        issuer: APPLE_ISSUER,
        audience: this.bundleIds,
      });
      if (!payload.sub) throw new Error('Missing subject');
      const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : null;
      // Apple sends email_verified as either a boolean or the string "true".
      const emailVerified = payload.email_verified === true || payload.email_verified === 'true';
      // Apple never puts the name in the token; the app forwards it on first sign-in.
      return { subject: payload.sub, email, emailVerified, fullName: null };
    } catch {
      throw invalidToken();
    }
  }
}
