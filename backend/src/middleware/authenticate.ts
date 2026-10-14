import type { RequestHandler } from 'express';
import type { AuthContext } from '../modules/auth/auth.types.js';
import { AppError } from '../utils/app-error.js';

declare module 'express-serve-static-core' {
  interface Request {
    /** Set by `authenticate` for requests with a valid access token. */
    auth?: AuthContext;
  }
}

export type AccessTokenAuthenticator = (accessToken: string) => Promise<AuthContext>;

/** Requires `Authorization: Bearer <access token>` belonging to a live session. */
export function authenticate(verify: AccessTokenAuthenticator): RequestHandler {
  return async (req, _res, next) => {
    const [scheme, token] = req.get('authorization')?.split(' ') ?? [];
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      return next(AppError.unauthorized('AUTH_REQUIRED', 'Please sign in to continue.'));
    }
    req.auth = await verify(token);
    next();
  };
}
