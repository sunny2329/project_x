import { Router, type RequestHandler } from 'express';
import type pg from 'pg';
import { z } from 'zod';
import { sendSuccess } from '../../utils/api-response.js';
import { AppError } from '../../utils/app-error.js';
import type { FeedRepository } from './feed.repository.js';

const feedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  /** The previous page's `nextCursor` (the id of the last post shown). */
  cursor: z.uuid().optional(),
});

/** `/api/v1/feed`: match posts from the player and the people they follow. */
export function createFeedRouter(pool: pg.Pool, repository: FeedRepository, requireAuth: RequestHandler): Router {
  const router = Router();
  router.get('/', requireAuth, async (req, res) => {
    const query = feedQuerySchema.safeParse(req.query);
    if (!query.success) throw AppError.badRequest('VALIDATION_ERROR', 'Invalid query.', z.flattenError(query.error).fieldErrors);
    const posts = await repository.findFeed(pool, req.auth!.userId, {
      limit: query.data.limit,
      afterPostId: query.data.cursor ?? null,
    });
    const last = posts.at(-1);
    sendSuccess(res, { posts, nextCursor: last && posts.length === query.data.limit ? last.id : null });
  });
  return router;
}
