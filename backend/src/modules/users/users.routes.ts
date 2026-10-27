import { Router, type Request, type RequestHandler, type Response } from 'express';
import type pg from 'pg';
import { z } from 'zod';
import { sendSuccess } from '../../utils/api-response.js';
import { AppError } from '../../utils/app-error.js';
import { notificationsRepository } from '../notifications/notifications.repository.js';
import { profileRepository } from '../profile/profile.repository.js';
import { usersRepository, type FollowCursor, type FollowList } from './users.repository.js';

const searchQuerySchema = z.object({
  q: z.string().trim().min(1, 'Type a name').max(50),
  limit: z.coerce.number().int().min(1).max(30).default(15),
});
const historyQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(50).default(10) });

/** `<created_at>_<follow id>`, as returned in `nextCursor`. */
const followCursor = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,6})?_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid cursor')
  .transform((value): FollowCursor => {
    const at = value.lastIndexOf('_');
    return { createdAt: value.slice(0, at), id: value.slice(at + 1) };
  });
const followListQuerySchema = z.object({
  q: z.string().trim().max(50).optional(),
  cursor: followCursor.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});

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

  /** Removes someone from my followers (Instagram's "Remove"); they aren't told. */
  router.delete('/me/followers/:id', async (req, res) => {
    const me = req.auth!.userId;
    const followerId = userIdParam(req.params.id);
    await usersRepository.unfollow(pool, followerId, me);
    await notificationsRepository.unfollowed(pool, followerId, me);
    sendSuccess(res, { removed: true, ...(await profileRepository.countFollows(pool, me)) });
  });

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

  const followList = (list: FollowList) => async (req: Request, res: Response) => {
    const viewerId = req.auth!.userId;
    const userId = userIdParam(req.params.id);
    const query = followListQuerySchema.safeParse(req.query);
    if (!query.success) throw AppError.badRequest('VALIDATION_ERROR', 'Invalid query.', z.flattenError(query.error).fieldErrors);
    if (!(await usersRepository.findSummary(pool, viewerId, userId))) throw notFound();
    const { q, cursor, limit } = query.data;
    const page = await usersRepository.listFollows(pool, viewerId, userId, list, { q: q || undefined, limit, after: cursor });
    sendSuccess(res, { users: page.users, nextCursor: page.next ? `${page.next.createdAt}_${page.next.id}` : null });
  };
  router.get('/:id/followers', followList('followers'));
  router.get('/:id/following', followList('following'));

  router.put('/:id/follow', async (req, res) => {
    const viewerId = req.auth!.userId;
    const userId = userIdParam(req.params.id);
    if (userId === viewerId) throw AppError.badRequest('CANNOT_FOLLOW_SELF', "You can't follow yourself.");
    if (!(await usersRepository.findSummary(pool, viewerId, userId))) throw notFound();
    await usersRepository.follow(pool, viewerId, userId);
    await notificationsRepository.followed(pool, viewerId, userId);
    sendSuccess(res, { isFollowing: true, followers: (await profileRepository.countFollows(pool, userId)).followers });
  });

  router.delete('/:id/follow', async (req, res) => {
    const userId = userIdParam(req.params.id);
    await usersRepository.unfollow(pool, req.auth!.userId, userId);
    await notificationsRepository.unfollowed(pool, req.auth!.userId, userId);
    sendSuccess(res, { isFollowing: false, followers: (await profileRepository.countFollows(pool, userId)).followers });
  });

  return router;
}
