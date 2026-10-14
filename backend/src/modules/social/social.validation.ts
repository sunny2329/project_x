import { z } from 'zod';

export const createPostSchema = z.object({
  content: z.string().trim().min(1, 'Write something first').max(2000, 'Posts can be at most 2000 characters'),
  visibility: z.enum(['public', 'followers']).default('public'),
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
