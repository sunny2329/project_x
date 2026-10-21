import { z } from 'zod';

export const createPostSchema = z
  .object({
    content: z.string().trim().max(2000, 'Posts can be at most 2000 characters').default(''),
    visibility: z.enum(['public', 'followers']).default('public'),
    /** Photos uploaded to /api/v1/media, in order. */
    mediaIds: z.array(z.uuid()).max(4, 'At most 4 photos').default([]),
    /** A match to attach (one the author played in or scored). */
    matchId: z.uuid().optional(),
  })
  .refine((post) => post.content.length > 0 || post.mediaIds.length > 0 || post.matchId !== undefined, {
    message: 'Write something first',
    path: ['content'],
  });

export const createCommentSchema = z.object({
  content: z.string().trim().min(1, 'Write a comment first').max(1000, 'Comments can be at most 1000 characters'),
});

export const commentsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  /** The previous page's `nextCursor` (the id of the last comment shown). */
  cursor: z.uuid().optional(),
});

export const uuidParam = z.uuid();

export type CreatePostInput = z.infer<typeof createPostSchema>;
