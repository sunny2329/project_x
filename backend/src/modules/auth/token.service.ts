import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { errors as joseErrors, jwtVerify, SignJWT } from 'jose';
import { AppError } from '../../utils/app-error.js';
import type { AuthContext } from './auth.types.js';

const ISSUER = 'project-x-api';
const AUDIENCE = 'project-x-app';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface TokenServiceOptions {
  accessSecret: string;
  accessTtlSeconds: number;
  refreshTtlDays: number;
}

export interface ParsedRefreshToken {
  sessionId: string;
  secret: string;
}

export class TokenService {
  private readonly accessKey: Uint8Array;

  constructor(private readonly options: TokenServiceOptions) {
    this.accessKey = new TextEncoder().encode(options.accessSecret);
  }

  async signAccessToken(auth: AuthContext): Promise<{ token: string; expiresAt: Date }> {
    const expiresAt = new Date(Date.now() + this.options.accessTtlSeconds * 1000);
    const token = await new SignJWT({ sid: auth.sessionId })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(auth.userId)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
      .sign(this.accessKey);
    return { token, expiresAt };
  }

  async verifyAccessToken(token: string): Promise<AuthContext> {
    try {
      const { payload } = await jwtVerify(token, this.accessKey, {
        issuer: ISSUER,
        audience: AUDIENCE,
        algorithms: ['HS256'],
      });
      if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') throw new Error('Missing claims');
      return { userId: payload.sub, sessionId: payload.sid };
    } catch (error) {
      if (error instanceof joseErrors.JWTExpired) {
        throw AppError.unauthorized('ACCESS_TOKEN_EXPIRED', 'Your session has expired.');
      }
      throw AppError.unauthorized('INVALID_ACCESS_TOKEN', 'Invalid access token.');
    }
  }

  refreshExpiry(from = new Date()): Date {
    return new Date(from.getTime() + this.options.refreshTtlDays * 24 * 60 * 60 * 1000);
  }

  /** Creates a fresh secret for a session. Only the returned hash is persisted. */
  generateRefreshSecret(): { secret: string; hash: string } {
    const secret = randomBytes(32).toString('base64url');
    return { secret, hash: hashSecret(secret) };
  }

  formatRefreshToken(sessionId: string, secret: string): string {
    return `${sessionId}.${secret}`;
  }

  parseRefreshToken(token: string): ParsedRefreshToken | null {
    const [sessionId, secret, ...rest] = token.split('.');
    if (!sessionId || !secret || rest.length > 0 || !UUID.test(sessionId)) return null;
    return { sessionId, secret };
  }

  secretMatches(secret: string, storedHash: string): boolean {
    const candidate = Buffer.from(hashSecret(secret), 'hex');
    const stored = Buffer.from(storedHash, 'hex');
    return candidate.length === stored.length && timingSafeEqual(candidate, stored);
  }
}

/** Hex SHA-256, stored in `auth_session.refresh_token_hash`. */
function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}
