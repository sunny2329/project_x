import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { validateBody } from '../../middleware/validate.js';
import { sendSuccess } from '../../utils/api-response.js';
import { AppError } from '../../utils/app-error.js';
import type { PlayersService } from './players.service.js';

const searchQuerySchema = z.object({
  q: z.string().trim().min(2, 'Type at least 2 characters').max(50),
  limit: z.coerce.number().int().min(1).max(20).default(10),
  /** Sport slug: each result carries its rating in that sport. */
  sport: z.string().trim().max(40).optional(),
});

const claimSchema = z.object({ playerIds: z.array(z.uuid()).max(50).optional() });

export const createGuestSchema = z.object({
  displayName: z.string().trim().min(1, 'Enter a name').max(80),
  phone: z
    .string()
    .regex(/^\+[1-9][0-9]{7,14}$/, 'Phone must be in international format, e.g. +919876543210')
    .nullish(),
});

/** `/api/v1/players`: finding people to play with, guest players, and claiming guest history. */
export function createPlayersRouter(service: PlayersService, requireAuth: RequestHandler): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/', async (req, res) => {
    const query = searchQuerySchema.safeParse(req.query);
    if (!query.success) throw AppError.badRequest('VALIDATION_ERROR', 'Invalid query.', z.flattenError(query.error).fieldErrors);
    sendSuccess(res, { players: await service.search(req.auth!.userId, query.data.q, query.data.limit, query.data.sport) });
  });
  router.get('/me', async (req, res) => {
    sendSuccess(res, { player: await service.ensureForUser(req.auth!.userId) });
  });
  router.get('/guests', async (req, res) => {
    sendSuccess(res, { players: await service.recentGuests(req.auth!.userId) });
  });
  router.post('/guests', validateBody(createGuestSchema), async (req, res) => {
    sendSuccess(res, { player: await service.createGuest(req.auth!.userId, req.body) }, 201);
  });
  /** Matches friends scored with me as a guest (by my phone number), to claim after sign-up. */
  router.get('/claimable', async (req, res) => {
    sendSuccess(res, { matches: await service.claimableMatches(req.auth!.userId) });
  });
  /** Merges guest players that carry my verified phone number into me (only `playerIds` when given). */
  router.post('/claim', validateBody(claimSchema), async (req, res) => {
    sendSuccess(res, { claimed: await service.claimGuests(req.auth!.userId, req.body.playerIds) });
  });
  return router;
}
