import { Router, type RequestHandler } from 'express';
import type pg from 'pg';
import { z } from 'zod';
import { sendSuccess } from '../../utils/api-response.js';
import { AppError } from '../../utils/app-error.js';
import type { NotificationsRepository } from './notifications.repository.js';

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(30),
  /** The previous page's `nextCursor` (the id of the last notification shown). */
  cursor: z.uuid().optional(),
});

const notFound = () => AppError.notFound('NOTIFICATION_NOT_FOUND', 'This notification does not exist.');

/** `/api/v1/notifications`: the bell on Home (likes, comments, new posts, follows). */
export function createNotificationsRouter(pool: pg.Pool, repository: NotificationsRepository, requireAuth: RequestHandler): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/', async (req, res) => {
    const query = listQuerySchema.safeParse(req.query);
    if (!query.success) throw AppError.badRequest('VALIDATION_ERROR', 'Invalid query.', z.flattenError(query.error).fieldErrors);
    const userId = req.auth!.userId;
    const [notifications, unreadCount] = await Promise.all([
      repository.list(pool, userId, { limit: query.data.limit, afterId: query.data.cursor ?? null }),
      repository.unreadCount(pool, userId),
    ]);
    const last = notifications.at(-1);
    sendSuccess(res, { notifications, unreadCount, nextCursor: last && notifications.length === query.data.limit ? last.id : null });
  });

  router.get('/unread', async (req, res) => {
    sendSuccess(res, { count: await repository.unreadCount(pool, req.auth!.userId) });
  });

  router.post('/read', async (req, res) => {
    await repository.markAllRead(pool, req.auth!.userId);
    sendSuccess(res, { read: true });
  });

  router.post('/:id/read', async (req, res) => {
    const id = z.uuid().safeParse(req.params.id);
    if (!id.success || !(await repository.markRead(pool, req.auth!.userId, id.data))) throw notFound();
    sendSuccess(res, { read: true });
  });

  return router;
}
