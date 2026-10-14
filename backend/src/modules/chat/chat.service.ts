import type pg from 'pg';
import type { Cache } from '../../cache/cache.js';
import { AppError } from '../../utils/app-error.js';
import type { ChatRepository } from './chat.repository.js';
import type { ChatMessage, Conversation } from './chat.types.js';
import type { CreateConversationInput, MessagesQuery } from './chat.validation.js';

export interface ChatServiceDeps {
  pool: pg.Pool;
  repository: ChatRepository;
  cache: Cache;
}

const CONVERSATION_LIST_LIMIT = 50;
/** Member lists change rarely and every change clears them, so they can be kept a while. */
const MEMBERS_TTL_SECONDS = 10 * 60;
/** The newest message id; every send overwrites it. */
const LAST_MESSAGE_TTL_SECONDS = 60 * 60;

const keys = {
  members: (id: string) => `chat:members:${id}`,
  last: (id: string) => `chat:last:${id}`,
};

const notFound = () => AppError.notFound('CONVERSATION_NOT_FOUND', 'This conversation does not exist.');

/**
 * Conversations and messages. Polling for new messages is served from the cache (members and the
 * newest message id) when nothing changed, so most polls never reach Postgres.
 */
export class ChatService {
  constructor(private readonly deps: ChatServiceDeps) {}

  listConversations(userId: string): Promise<Conversation[]> {
    return this.deps.repository.listConversations(this.deps.pool, userId, CONVERSATION_LIST_LIMIT);
  }

  unreadTotal(userId: string): Promise<number> {
    return this.deps.repository.unreadTotal(this.deps.pool, userId);
  }

  async getConversation(userId: string, conversationId: string): Promise<Conversation> {
    const conversation = await this.deps.repository.findConversation(this.deps.pool, userId, conversationId);
    if (!conversation) throw notFound();
    return conversation;
  }

  /** One other player: their direct conversation (found or created). More: a new group. */
  async createConversation(userId: string, input: CreateConversationInput): Promise<Conversation> {
    const { pool, repository } = this.deps;
    const others = input.userIds.filter((id) => id !== userId);
    if (!others.length) throw AppError.badRequest('VALIDATION_ERROR', 'Some fields are invalid.', { userIds: ['Pick someone other than yourself'] });
    const reachable = await repository.findReachableUsers(pool, userId, others);
    if (reachable.length !== others.length) {
      throw AppError.badRequest('VALIDATION_ERROR', 'Some fields are invalid.', { userIds: ['Some players cannot be messaged'] });
    }
    const id =
      others.length === 1 && input.title === undefined
        ? await repository.findOrCreateDirect(pool, userId, others[0]!)
        : await repository.createGroup(pool, userId, input.title ?? 'Group', others);
    return this.getConversation(userId, id);
  }

  async addMembers(userId: string, conversationId: string, userIds: string[]): Promise<Conversation> {
    const { pool, repository } = this.deps;
    const conversation = await this.getConversation(userId, conversationId);
    if (conversation.type !== 'group') throw AppError.badRequest('NOT_A_GROUP', 'People can only be added to groups.');
    if (!conversation.isAdmin) throw AppError.forbidden('NOT_GROUP_ADMIN', 'Only group admins can add people.');
    const reachable = await repository.findReachableUsers(pool, userId, userIds);
    if (reachable.length !== userIds.length) {
      throw AppError.badRequest('VALIDATION_ERROR', 'Some fields are invalid.', { userIds: ['Some players cannot be added'] });
    }
    await repository.addMembers(pool, conversationId, userIds);
    await this.deps.cache.del(keys.members(conversationId));
    return this.getConversation(userId, conversationId);
  }

  async leave(userId: string, conversationId: string): Promise<void> {
    const conversation = await this.getConversation(userId, conversationId);
    if (conversation.type !== 'group') throw AppError.badRequest('NOT_A_GROUP', 'Only groups can be left.');
    await this.deps.repository.leave(this.deps.pool, conversationId, userId);
    await this.deps.cache.del(keys.members(conversationId));
  }

  /** Messages in time order. With `after`, answers from the cache when there is nothing newer. */
  async listMessages(userId: string, conversationId: string, query: MessagesQuery): Promise<ChatMessage[]> {
    const lastId = await this.requireMember(userId, conversationId);
    if (query.after && lastId === query.after) return [];
    return this.deps.repository.listMessages(this.deps.pool, conversationId, query);
  }

  async sendMessage(userId: string, conversationId: string, content: string): Promise<ChatMessage> {
    const members = await this.requireMemberIds(userId, conversationId);
    const conversation = members.length === 2 ? await this.getConversation(userId, conversationId) : null;
    if (conversation?.type === 'direct') {
      const other = members.find((id) => id !== userId)!;
      const reachable = await this.deps.repository.findReachableUsers(this.deps.pool, userId, [other]);
      if (!reachable.length) throw AppError.forbidden('CANNOT_MESSAGE', 'You can’t message this player.');
    }
    const message = await this.deps.repository.insertMessage(this.deps.pool, { conversationId, senderId: userId, content });
    await this.deps.cache.set(keys.last(conversationId), message.id, LAST_MESSAGE_TTL_SECONDS);
    return message;
  }

  async deleteMessage(userId: string, conversationId: string, messageId: string): Promise<void> {
    await this.requireMember(userId, conversationId);
    const deleted = await this.deps.repository.deleteOwnMessage(this.deps.pool, conversationId, messageId, userId);
    if (!deleted) throw AppError.notFound('MESSAGE_NOT_FOUND', 'This message does not exist or is not yours to delete.');
    // Pollers only look at the newest id, so drop it to make them fetch (and see the deletion) once.
    await this.deps.cache.del(keys.last(conversationId));
  }

  async markRead(userId: string, conversationId: string): Promise<void> {
    await this.requireMember(userId, conversationId);
    await this.deps.repository.markRead(this.deps.pool, conversationId, userId);
  }

  /** Throws unless the user is a current member. Returns the cached newest message id, if any. */
  private async requireMember(userId: string, conversationId: string): Promise<string | null> {
    const [membersRaw, lastId] = await this.deps.cache.mget([keys.members(conversationId), keys.last(conversationId)]);
    const members = membersRaw ? (JSON.parse(membersRaw) as string[]) : await this.loadMembers(conversationId);
    if (!members.includes(userId)) throw notFound();
    return lastId ?? null;
  }

  private async requireMemberIds(userId: string, conversationId: string): Promise<string[]> {
    const [membersRaw] = await this.deps.cache.mget([keys.members(conversationId)]);
    const members = membersRaw ? (JSON.parse(membersRaw) as string[]) : await this.loadMembers(conversationId);
    if (!members.includes(userId)) throw notFound();
    return members;
  }

  private async loadMembers(conversationId: string): Promise<string[]> {
    const members = await this.deps.repository.findMemberIds(this.deps.pool, conversationId);
    await this.deps.cache.set(keys.members(conversationId), JSON.stringify(members), MEMBERS_TTL_SECONDS);
    return members;
  }
}
