import { Router, type Request } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { createRateLimiter } from '../../middleware/rate-limit.js';
import { validateBody } from '../../middleware/validate.js';
import { createAuthController } from './auth.controller.js';
import type { AuthService } from './auth.service.js';
import type { Identifier } from './auth.types.js';
import { toE164, type Phone } from './phone.js';
import {
  appleSignInSchema,
  forgotPasswordSchema,
  googleSignInSchema,
  loginSchema,
  phoneStartSchema,
  phoneVerifySchema,
  refreshTokenSchema,
  registerCompleteSchema,
  registerStartSchema,
  resetPasswordSchema,
} from './auth.validation.js';

const MINUTE = 60_000;

/** Rate-limit key for the account being targeted; runs after validation so values are normalized. */
function targetKey(req: Request): string {
  const body = req.body as { phone?: Phone; identifier?: Identifier };
  const target = body.phone ?? body.identifier?.value;
  return typeof target === 'object' ? toE164(target) : (target?.toLowerCase() ?? '');
}

export function createAuthRouter(service: AuthService, rateLimiting: boolean): Router {
  const controller = createAuthController(service);
  const limit = (name: string, windowMs: number, max: number, byTarget = false) =>
    createRateLimiter({ name, windowMs, limit: max, ...(byTarget ? { key: targetKey } : {}) }, rateLimiting);

  const perIp = limit('auth-ip', 15 * MINUTE, 300);
  const sendCodePerIp = limit('send-code-ip', 60 * MINUTE, 20);
  const sendCodePerTarget = limit('send-code-target', 60 * MINUTE, 5, true);
  const checkCodePerTarget = limit('check-code-target', 15 * MINUTE, 10, true);
  const loginPerTarget = limit('login-target', 15 * MINUTE, 10, true);

  const router = Router();
  router.use(perIp);

  router.post('/register/start', validateBody(registerStartSchema), sendCodePerIp, sendCodePerTarget, controller.registerStart);
  router.post('/register/complete', validateBody(registerCompleteSchema), checkCodePerTarget, controller.registerComplete);
  router.post('/login', validateBody(loginSchema), loginPerTarget, controller.login);
  router.post('/phone/start', validateBody(phoneStartSchema), sendCodePerIp, sendCodePerTarget, controller.phoneStart);
  router.post('/phone/verify', validateBody(phoneVerifySchema), checkCodePerTarget, controller.phoneVerify);
  router.post('/password/forgot', validateBody(forgotPasswordSchema), sendCodePerIp, sendCodePerTarget, controller.forgotPassword);
  router.post('/password/reset', validateBody(resetPasswordSchema), checkCodePerTarget, controller.resetPassword);
  router.post('/google', validateBody(googleSignInSchema), controller.google);
  router.post('/apple', validateBody(appleSignInSchema), controller.apple);
  router.post('/refresh', validateBody(refreshTokenSchema), controller.refresh);
  router.post('/logout', validateBody(refreshTokenSchema), controller.logout);
  router.get('/me', authenticate((token) => service.authenticate(token)), controller.me);

  return router;
}
