import { Router, type RequestHandler } from 'express';
import type pg from 'pg';
import { z } from 'zod';
import { sendSuccess } from '../../utils/api-response.js';
import { AppError } from '../../utils/app-error.js';
import { profileRepository } from '../profile/profile.repository.js';
import { usersRepository } from './users.repository.js';

const searchQuerySchema = z.object({
  q: z.string().trim().min(1, 'Type a name').max(50),
  limit: z.coerce.number().int().min(1).max(30).default(15),
});
const historyQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(50).default(10) });

const notFound = () => AppError.notFound('USER_NOT_FOUND', 'Player not found.');

function userIdParam(raw: unknown): string {
  const parsed = z.uuid().safeParse(raw);
  if (!parsed.success) throw notFound();
  return parsed.data;
}

/** `/api/v1/users`: finding and following people, and another player's profile. */
export function createUsersRouter(pool: pg.Pool, requireAuth: RequestHandler): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/search', async (req, res) => {
    const query = searchQuerySchema.safeParse(req.query);
    if (!query.success) throw AppError.badRequest('VALIDATION_ERROR', 'Invalid query.', z.flattenError(query.error).fieldErrors);
    sendSuccess(res, { users: await usersRepository.search(pool, req.auth!.userId, query.data.q, query.data.limit) });
  });

  /** Another player: ratings and record per sport, head to head with me, followers. */
  router.get('/:id', async (req, res) => {
    const viewerId = req.auth!.userId;
    const userId = userIdParam(req.params.id);
    const summary = await usersRepository.findSummary(pool, viewerId, userId);
    if (!summary) throw notFound();
    const [extras, sports, follows, headToHead, recentMatches] = await Promise.all([
      usersRepository.findExtras(pool, userId),
      profileRepository.findPlayerSports(pool, userId),
      profileRepository.countFollows(pool, userId),
      viewerId === userId ? null : usersRepository.headToHead(pool, viewerId, userId),
      profileRepository.findMatchHistory(pool, userId, 5),
    ]);
    sendSuccess(res, {
      user: { ...summary, ...extras, ...follows, isMe: viewerId === userId, sports, headToHead, recentMatches },
    });
  });

  router.get('/:id/matches', async (req, res) => {
    const userId = userIdParam(req.params.id);
    if (!(await usersRepository.findSummary(pool, req.auth!.userId, userId))) throw notFound();
    const { limit } = historyQuerySchema.parse(req.query);
    sendSuccess(res, { matches: await profileRepository.findMatchHistory(pool, userId, limit) });
  });

  router.put('/:id/follow', async (req, res) => {
    const viewerId = req.auth!.userId;
    const userId = userIdParam(req.params.id);
    if (userId === viewerId) throw AppError.badRequest('CANNOT_FOLLOW_SELF', "You can't follow yourself.");
    if (!(await usersRepository.findSummary(pool, viewerId, userId))) throw notFound();
    await usersRepository.follow(pool, viewerId, userId);
    sendSuccess(res, { isFollowing: true, followers: (await profileRepository.countFollows(pool, userId)).followers });
  });

  router.delete('/:id/follow', async (req, res) => {
    const userId = userIdParam(req.params.id);
    await usersRepository.unfollow(pool, req.auth!.userId, userId);
    sendSuccess(res, { isFollowing: false, followers: (await profileRepository.countFollows(pool, userId)).followers });
  });

  return router;
}
