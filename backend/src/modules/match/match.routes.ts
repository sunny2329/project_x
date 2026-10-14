import { Router, type RequestHandler } from 'express';
import { validateBody } from '../../middleware/validate.js';
import { sendSuccess } from '../../utils/api-response.js';
import { AppError } from '../../utils/app-error.js';
import type { MatchService } from './match.service.js';
import { createMatchSchema, matchIdSchema, scoreEventSchema, versionSchema } from './match.validation.js';

function matchId(raw: string | string[] | undefined): string {
  const parsed = matchIdSchema.safeParse(raw);
  if (!parsed.success) throw AppError.notFound('MATCH_NOT_FOUND', 'This match does not exist.');
  return parsed.data;
}

/** `/api/v1/matches`: starting, live-scoring and finishing friendly matches. Every route requires a bearer token. */
export function createMatchRouter(service: MatchService, requireAuth: RequestHandler): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/setup', async (_req, res) => {
    sendSuccess(res, { sports: await service.listSetup() });
  });

  router.get('/live', async (req, res) => {
    sendSuccess(res, { matches: await service.listLive(req.auth!.userId) });
  });

  router.post('/', validateBody(createMatchSchema), async (req, res) => {
    sendSuccess(res, { match: await service.createMatch(req.auth!.userId, req.body) }, 201);
  });

  router.get('/:id', async (req, res) => {
    sendSuccess(res, { match: await service.getMatch(req.auth!.userId, matchId(req.params.id)) });
  });

  router.post('/:id/events', validateBody(scoreEventSchema), async (req, res) => {
    sendSuccess(res, { match: await service.scoreEvent(req.auth!.userId, matchId(req.params.id), req.body) });
  });

  router.post('/:id/undo', validateBody(versionSchema), async (req, res) => {
    sendSuccess(res, { match: await service.undo(req.auth!.userId, matchId(req.params.id), req.body.version) });
  });

  router.post('/:id/finish', validateBody(versionSchema), async (req, res) => {
    sendSuccess(res, { match: await service.finish(req.auth!.userId, matchId(req.params.id), req.body.version) });
  });

  router.post('/:id/abandon', async (req, res) => {
    sendSuccess(res, { match: await service.abandon(req.auth!.userId, matchId(req.params.id)) });
  });

  return router;
}
