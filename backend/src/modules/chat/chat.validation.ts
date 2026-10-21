import { z } from 'zod';

const userIds = z
  .array(z.uuid('Invalid player'))
  .min(1, 'Pick at least one player')
  .max(49, 'Groups can have at most 50 members')
  .refine((ids) => new Set(ids).size === ids.length, 'Each player can be added once');

export const createConversationSchema = z
  .object({
    userIds,
    /** Required for a group (more than one other player); not allowed for a direct conversation. */
    title: z.string().trim().min(1, 'Name the group').max(100, 'Group names can be at most 100 characters').optional(),
  })
  .refine((body) => body.userIds.length === 1 || body.title !== undefined, { message: 'Name the group', path: ['title'] });

export const addMembersSchema = z.object({ userIds });

export const sendMessageSchema = z
  .object({
    content: z.string().trim().max(4000, 'Messages can be at most 4000 characters').default(''),
    /** Share a match result card (one the sender played in or created). */
    matchId: z.uuid().optional(),
  })
  .refine((body) => body.content.length > 0 || body.matchId !== undefined, { message: 'Write a message first', path: ['content'] });

export const messagesQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(30),
    /** Older messages than this one (scrolling back). */
    before: z.uuid().optional(),
    /** Newer messages than this one (polling for new ones). */
    after: z.uuid().optional(),
  })
  .refine((query) => !(query.before && query.after), { message: 'Use either before or after' });

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type MessagesQuery = z.infer<typeof messagesQuerySchema>;
