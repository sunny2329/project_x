import type { Request, Response } from 'express';
import { sendSuccess } from '../../utils/api-response.js';
import type { AuthService } from './auth.service.js';
import type { ClientContext } from './auth.types.js';

const CODE_SENT = { message: 'Verification code sent.' };
const CODE_SENT_IF_REGISTERED = { message: 'If an account exists for these details, a code has been sent to its phone.' };

function clientContext(req: Request): ClientContext {
  return { ip: req.ip, userAgent: req.get('user-agent')?.slice(0, 255) };
}

/** Thin HTTP adapters: bodies arrive already validated by `validateBody`. */
export function createAuthController(service: AuthService) {
  return {
    async registerStart(req: Request, res: Response) {
      await service.startRegistration(req.body);
      sendSuccess(res, CODE_SENT);
    },

    async registerComplete(req: Request, res: Response) {
      sendSuccess(res, await service.completeRegistration(req.body, clientContext(req)), 201);
    },

    async login(req: Request, res: Response) {
      sendSuccess(res, await service.login(req.body, clientContext(req)));
    },

    async phoneStart(req: Request, res: Response) {
      await service.startPhoneLogin(req.body);
      sendSuccess(res, CODE_SENT_IF_REGISTERED);
    },

    async phoneVerify(req: Request, res: Response) {
      sendSuccess(res, await service.completePhoneLogin(req.body, clientContext(req)));
    },

    async forgotPassword(req: Request, res: Response) {
      await service.forgotPassword(req.body);
      sendSuccess(res, CODE_SENT_IF_REGISTERED);
    },

    async resetPassword(req: Request, res: Response) {
      await service.resetPassword(req.body);
      sendSuccess(res, { message: 'Password updated. Please sign in with your new password.' });
    },

    async google(req: Request, res: Response) {
      sendSuccess(res, await service.signInWithGoogle(req.body, clientContext(req)));
    },

    async apple(req: Request, res: Response) {
      sendSuccess(res, await service.signInWithApple(req.body, clientContext(req)));
    },

    async refresh(req: Request, res: Response) {
      sendSuccess(res, await service.refresh(req.body.refreshToken));
    },

    async logout(req: Request, res: Response) {
      await service.logout(req.body.refreshToken, clientContext(req));
      res.status(204).end();
    },

    async me(req: Request, res: Response) {
      sendSuccess(res, { user: await service.getCurrentUser(req.auth!) });
    },
  };
}
