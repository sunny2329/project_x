import type { Request, RequestHandler } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { sendFailure } from '../utils/api-response.js';

export interface RateLimitRule {
  name: string;
  windowMs: number;
  limit: number;
  /** Extra key component (e.g. the submitted phone number) on top of the client IP. */
  key?: (req: Request) => string;
}

/**
 * In-memory limiter. Adequate for a single API instance; switch the store to Redis
 * when the API is scaled horizontally.
 */
export function createRateLimiter(rule: RateLimitRule, enabled: boolean): RequestHandler {
  if (!enabled) return (_req, _res, next) => next();
  return rateLimit({
    windowMs: rule.windowMs,
    limit: rule.limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => {
      const base = rule.key ? rule.key(req) : ipKeyGenerator(req.ip ?? '');
      return `${rule.name}:${base}`;
    },
    handler: (_req, res) =>
      sendFailure(res, 429, { code: 'RATE_LIMITED', message: 'Too many attempts. Please wait and try again.' }),
  });
}
