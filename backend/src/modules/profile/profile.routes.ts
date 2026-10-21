import { Router, type RequestHandler } from 'express';
import { validateBody } from '../../middleware/validate.js';
import { sendSuccess } from '../../utils/api-response.js';
import { AppError } from '../../utils/app-error.js';
import type { ProfileService } from './profile.service.js';
import { matchHistoryQuerySchema, updateProfileSchema, updateSportsSchema } from './profile.validation.js';

/** `/api/v1/profile`: the signed-in player's own profile. Every route requires a bearer token. */
export function createProfileRouter(service: ProfileService, requireAuth: RequestHandler): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/me', async (req, res) => {
    sendSuccess(res, { profile: await service.getProfile(req.auth!.userId) });
  });

  router.patch('/me', validateBody(updateProfileSchema), async (req, res) => {
    sendSuccess(res, { profile: await service.updateProfile(req.auth!.userId, req.body) });
  });

  router.put('/me/sports', validateBody(updateSportsSchema), async (req, res) => {
    sendSuccess(res, { profile: await service.updateSports(req.auth!.userId, req.body) });
  });

  router.get('/me/matches', async (req, res) => {
    const query = matchHistoryQuerySchema.safeParse(req.query);
    if (!query.success) throw AppError.badRequest('VALIDATION_ERROR', 'Invalid query.', { limit: ['Must be 1-100'] });
    sendSuccess(res, await service.getMatchHistory(req.auth!.userId, query.data.limit, query.data.sport));
  });

  return router;
}
