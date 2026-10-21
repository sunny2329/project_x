import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { validateBody } from '../../middleware/validate.js';
import { sendSuccess } from '../../utils/api-response.js';
import { AppError } from '../../utils/app-error.js';
import type { ChatService } from './chat.service.js';
import { addMembersSchema, createConversationSchema, messagesQuerySchema, sendMessageSchema } from './chat.validation.js';

const uuid = z.uuid();

function conversationId(raw: string | string[] | undefined): string {
  const parsed = uuid.safeParse(raw);
  if (!parsed.success) throw AppError.notFound('CONVERSATION_NOT_FOUND', 'This conversation does not exist.');
  return parsed.data;
}

/** `/api/v1/conversations`: direct and group messaging. Every route requires a bearer token. */
export function createChatRouter(service: ChatService, requireAuth: RequestHandler): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/', async (req, res) => {
    sendSuccess(res, { conversations: await service.listConversations(req.auth!.userId) });
  });

  router.get('/unread', async (req, res) => {
    sendSuccess(res, { count: await service.unreadTotal(req.auth!.userId) });
  });

  router.post('/', validateBody(createConversationSchema), async (req, res) => {
    sendSuccess(res, { conversation: await service.createConversation(req.auth!.userId, req.body) }, 201);
  });

  router.get('/:id', async (req, res) => {
    sendSuccess(res, { conversation: await service.getConversation(req.auth!.userId, conversationId(req.params.id)) });
  });

  router.post('/:id/members', validateBody(addMembersSchema), async (req, res) => {
    sendSuccess(res, { conversation: await service.addMembers(req.auth!.userId, conversationId(req.params.id), req.body.userIds) });
  });

  router.post('/:id/leave', async (req, res) => {
    await service.leave(req.auth!.userId, conversationId(req.params.id));
    sendSuccess(res, { left: true });
  });

  router.get('/:id/messages', async (req, res) => {
    const query = messagesQuerySchema.safeParse(req.query);
    if (!query.success) throw AppError.badRequest('VALIDATION_ERROR', 'Invalid query.', z.flattenError(query.error).fieldErrors);
    sendSuccess(res, { messages: await service.listMessages(req.auth!.userId, conversationId(req.params.id), query.data) });
  });

  router.post('/:id/messages', validateBody(sendMessageSchema), async (req, res) => {
    sendSuccess(res, { message: await service.sendMessage(req.auth!.userId, conversationId(req.params.id), req.body.content, req.body.matchId) }, 201);
  });

  router.delete('/:id/messages/:messageId', async (req, res) => {
    const messageId = uuid.safeParse(req.params.messageId);
    if (!messageId.success) throw AppError.notFound('MESSAGE_NOT_FOUND', 'This message does not exist.');
    await service.deleteMessage(req.auth!.userId, conversationId(req.params.id), messageId.data);
    sendSuccess(res, { deleted: true });
  });

  router.post('/:id/read', async (req, res) => {
    await service.markRead(req.auth!.userId, conversationId(req.params.id));
    sendSuccess(res, { read: true });
  });

  return router;
}
