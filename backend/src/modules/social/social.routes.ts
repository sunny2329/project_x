import { Router, type RequestHandler } from 'express';
import type pg from 'pg';
import { z } from 'zod';
import { validateBody } from '../../middleware/validate.js';
import { sendSuccess } from '../../utils/api-response.js';
import { AppError } from '../../utils/app-error.js';
import { PostVisibility } from '../match/match.codes.js';
import type { SocialRepository } from './social.repository.js';
import { commentsQuerySchema, createCommentSchema, createPostSchema, uuidParam, type CreatePostInput } from './social.validation.js';

const postNotFound = () => AppError.notFound('POST_NOT_FOUND', 'This post does not exist or is not visible to you.');

function idParam(raw: string | string[] | undefined, notFound: () => AppError): string {
  const parsed = uuidParam.safeParse(raw);
  if (!parsed.success) throw notFound();
  return parsed.data;
}

/** `/api/v1/posts`: writing posts, and liking and commenting on posts the player can see. */
export function createSocialRouter(pool: pg.Pool, repository: SocialRepository, requireAuth: RequestHandler): Router {
  const router = Router();
  router.use(requireAuth);

  /** The post id from the URL, after checking the viewer may see the post. */
  async function visiblePostId(userId: string, raw: string | string[] | undefined): Promise<string> {
    const postId = idParam(raw, postNotFound);
    if (!(await repository.canSeePost(pool, userId, postId))) throw postNotFound();
    return postId;
  }

  router.post('/', validateBody(createPostSchema), async (req, res) => {
    const userId = req.auth!.userId;
    const body = req.body as CreatePostInput;
    const postId = await repository.createPost(pool, {
      userId,
      content: body.content,
      visibilityId: body.visibility === 'followers' ? PostVisibility.FOLLOWERS : PostVisibility.PUBLIC,
    });
    sendSuccess(res, { post: await repository.findVisiblePost(pool, userId, postId) }, 201);
  });

  router.get('/:id', async (req, res) => {
    const post = await repository.findVisiblePost(pool, req.auth!.userId, idParam(req.params.id, postNotFound));
    if (!post) throw postNotFound();
    sendSuccess(res, { post });
  });

  router.delete('/:id', async (req, res) => {
    const deleted = await repository.deleteOwnPost(pool, req.auth!.userId, idParam(req.params.id, postNotFound));
    if (!deleted) throw postNotFound();
    sendSuccess(res, { deleted: true });
  });

  router.put('/:id/like', async (req, res) => {
    const userId = req.auth!.userId;
    const postId = await visiblePostId(userId, req.params.id);
    await repository.like(pool, userId, postId);
    sendSuccess(res, await repository.likeState(pool, userId, postId));
  });

  router.delete('/:id/like', async (req, res) => {
    const userId = req.auth!.userId;
    const postId = await visiblePostId(userId, req.params.id);
    await repository.unlike(pool, userId, postId);
    sendSuccess(res, await repository.likeState(pool, userId, postId));
  });

  router.get('/:id/comments', async (req, res) => {
    const userId = req.auth!.userId;
    const query = commentsQuerySchema.safeParse(req.query);
    if (!query.success) throw AppError.badRequest('VALIDATION_ERROR', 'Invalid query.', z.flattenError(query.error).fieldErrors);
    const postId = await visiblePostId(userId, req.params.id);
    const comments = await repository.listComments(pool, userId, postId, { limit: query.data.limit, afterCommentId: query.data.cursor ?? null });
    const last = comments.at(-1);
    sendSuccess(res, { comments, nextCursor: last && comments.length === query.data.limit ? last.id : null });
  });

  router.post('/:id/comments', validateBody(createCommentSchema), async (req, res) => {
    const userId = req.auth!.userId;
    const postId = await visiblePostId(userId, req.params.id);
    sendSuccess(res, { comment: await repository.createComment(pool, { postId, userId, content: req.body.content }) }, 201);
  });

  router.delete('/:id/comments/:commentId', async (req, res) => {
    const userId = req.auth!.userId;
    const postId = idParam(req.params.id, postNotFound);
    const commentId = idParam(req.params.commentId, () => AppError.notFound('COMMENT_NOT_FOUND', 'This comment does not exist.'));
    if (!(await repository.deleteComment(pool, userId, postId, commentId))) {
      throw AppError.notFound('COMMENT_NOT_FOUND', 'This comment does not exist or is not yours to delete.');
    }
    sendSuccess(res, { deleted: true });
  });

  return router;
}
