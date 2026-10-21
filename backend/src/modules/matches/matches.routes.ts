import { Router, type RequestHandler } from 'express';
import { validateBody } from '../../middleware/validate.js';
import { sendSuccess } from '../../utils/api-response.js';
import { AppError } from '../../utils/app-error.js';
import type { MatchesService } from './matches.service.js';
import { addScorerSchema, confirmSchema, createMatchSchema, matchIdSchema, retireSchema, scoreEventSchema, versionSchema, walkoverSchema } from './matches.validation.js';

function matchId(raw: string | string[] | undefined): string {
  const parsed = matchIdSchema.safeParse(raw);
  if (!parsed.success) throw AppError.notFound('MATCH_NOT_FOUND', 'This match does not exist.');
  return parsed.data;
}

/** `/api/v1/matches`: friendly matches and live scoring (tournament matches are scored here too). */
export function createMatchesRouter(service: MatchesService, requireAuth: RequestHandler): Router {
  const router = Router();
  router.use(requireAuth);
  const me = (req: { auth?: { userId: string } }) => req.auth!.userId;

  router.post('/', validateBody(createMatchSchema), async (req, res) => {
    sendSuccess(res, { match: await service.createFriendly(me(req), req.body) }, 201);
  });
  router.get('/live', async (req, res) => {
    sendSuccess(res, { matches: await service.listLive(me(req)) });
  });
  router.get('/pending-confirmations', async (req, res) => {
    sendSuccess(res, { matches: await service.pendingConfirmations(me(req)) });
  });
  router.get('/:id', async (req, res) => {
    sendSuccess(res, { match: await service.get(me(req), matchId(req.params.id)) });
  });
  router.get('/:id/details', async (req, res) => {
    sendSuccess(res, { details: await service.details(matchId(req.params.id)) });
  });
  router.post('/:id/events', validateBody(scoreEventSchema), async (req, res) => {
    sendSuccess(res, { match: await service.score(me(req), matchId(req.params.id), req.body) });
  });
  router.post('/:id/undo', validateBody(versionSchema), async (req, res) => {
    sendSuccess(res, { match: await service.undo(me(req), matchId(req.params.id), req.body.version) });
  });
  router.post('/:id/complete', validateBody(versionSchema), async (req, res) => {
    sendSuccess(res, { match: await service.complete(me(req), matchId(req.params.id), req.body.version) });
  });
  router.post('/:id/retire', validateBody(retireSchema), async (req, res) => {
    sendSuccess(res, { match: await service.retire(me(req), matchId(req.params.id), req.body) });
  });
  router.post('/:id/walkover', validateBody(walkoverSchema), async (req, res) => {
    sendSuccess(res, { match: await service.walkover(me(req), matchId(req.params.id), req.body) });
  });
  router.post('/:id/abandon', async (req, res) => {
    sendSuccess(res, { match: await service.abandon(me(req), matchId(req.params.id)) });
  });
  router.post('/:id/confirm', validateBody(confirmSchema), async (req, res) => {
    sendSuccess(res, { match: await service.confirm(me(req), matchId(req.params.id), req.body) });
  });
  router.post('/:id/scorers', validateBody(addScorerSchema), async (req, res) => {
    sendSuccess(res, { match: await service.addScorer(me(req), matchId(req.params.id), req.body.userId) });
  });
  return router;
}
