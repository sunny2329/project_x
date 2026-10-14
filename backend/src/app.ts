import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import type pg from 'pg';
import { pinoHttp } from 'pino-http';
import type { Logger } from 'pino';
import { MemoryCache, type Cache } from './cache/cache.js';
import type { Env } from './config/env.js';
import { authenticate } from './middleware/authenticate.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { authRepository } from './modules/auth/auth.repository.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { AuthService } from './modules/auth/auth.service.js';
import { OtpService } from './modules/auth/otp.service.js';
import { SessionCache } from './modules/auth/session-cache.js';
import type { SmsSender } from './modules/auth/providers/sms-sender.js';
import type { SocialIdentityVerifier } from './modules/auth/providers/social-identity.js';
import { TokenService } from './modules/auth/token.service.js';
import { chatRepository } from './modules/chat/chat.repository.js';
import { createChatRouter } from './modules/chat/chat.routes.js';
import { ChatService } from './modules/chat/chat.service.js';
import { feedRepository } from './modules/feed/feed.repository.js';
import { createFeedRouter } from './modules/feed/feed.routes.js';
import type { LiveStore } from './modules/match/live/live-store.js';
import { matchRepository } from './modules/match/match.repository.js';
import { createMatchRouter } from './modules/match/match.routes.js';
import { MatchService } from './modules/match/match.service.js';
import { profileRepository } from './modules/profile/profile.repository.js';
import { createPlayersRouter, createProfileRouter, createSportsRouter } from './modules/profile/profile.routes.js';
import { ProfileService } from './modules/profile/profile.service.js';
import { socialRepository } from './modules/social/social.repository.js';
import { createSocialRouter } from './modules/social/social.routes.js';
import { sendSuccess } from './utils/api-response.js';

export interface AppDependencies {
  env: Env;
  logger: Logger;
  pool: pg.Pool;
  sms: SmsSender;
  google: SocialIdentityVerifier | null;
  apple: SocialIdentityVerifier | null;
  rateLimiting?: boolean;
  /** Live match store; a shared Redis-backed one lets scoring answer before Postgres is written. */
  live?: { store: LiveStore; shared: boolean };
  /** Shared cache (Redis). Defaults to process memory. */
  cache?: Cache;
}

export interface AppServices {
  matchService: MatchService;
}

export function createApp(deps: AppDependencies): Express & { services: AppServices } {
  const { env, logger } = deps;
  const app = express();

  app.set('trust proxy', env.TRUST_PROXY);
  app.disable('x-powered-by');
  app.use(helmet());
  // Native mobile clients send no Origin header, so CORS only matters for browser tooling.
  app.use(cors({ origin: env.CORS_ORIGINS.length ? env.CORS_ORIGINS : false }));
  app.use(express.json({ limit: '100kb' }));
  app.use(
    pinoHttp({
      logger,
      // Log only method, path and status; bodies and headers can contain credentials.
      serializers: {
        req: (req: { method: string; url: string }) => ({ method: req.method, url: req.url.split('?')[0] }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
    }),
  );

  const tokens = new TokenService({
    accessSecret: env.JWT_ACCESS_SECRET,
    accessTtlSeconds: env.ACCESS_TOKEN_TTL_SECONDS,
    refreshTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
  });
  const otp = new OtpService({
    pool: deps.pool,
    repository: authRepository,
    sms: deps.sms,
    hashKey: env.JWT_ACCESS_SECRET,
    ...(env.SMS_PROVIDER === 'dev' ? { fixedCode: env.DEV_OTP_CODE } : {}),
  });
  const cache = deps.cache ?? new MemoryCache();
  const authService = new AuthService({
    sessions: new SessionCache(cache),
    pool: deps.pool,
    repository: authRepository,
    tokens,
    otp,
    google: deps.google,
    apple: deps.apple,
    logger,
  });

  app.get('/health', (_req, res) => sendSuccess(res, { status: 'ok' }));
  const requireAuth = authenticate((token) => authService.authenticate(token));
  const profileService = new ProfileService({ pool: deps.pool, repository: profileRepository, users: authRepository });
  const matchService = new MatchService({
    pool: deps.pool,
    repository: matchRepository,
    live: deps.live?.store,
    persistInBackground: deps.live?.shared ?? false,
    logger,
  });

  app.use('/api/v1/auth', createAuthRouter(authService, deps.rateLimiting ?? true));
  app.use('/api/v1/sports', createSportsRouter(profileService, requireAuth));
  app.use('/api/v1/profile', createProfileRouter(profileService, requireAuth));
  app.use('/api/v1/players', createPlayersRouter(profileService, requireAuth));
  app.use('/api/v1/matches', createMatchRouter(matchService, requireAuth));
  app.use('/api/v1/feed', createFeedRouter(deps.pool, feedRepository, requireAuth));
  app.use('/api/v1/posts', createSocialRouter(deps.pool, socialRepository, requireAuth));
  app.use('/api/v1/conversations', createChatRouter(new ChatService({ pool: deps.pool, repository: chatRepository, cache }), requireAuth));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return Object.assign(app, { services: { matchService } });
}
