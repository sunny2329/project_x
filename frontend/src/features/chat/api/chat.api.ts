import { apiRequest } from '@/shared/api/client';
import type { ChatMessage, Conversation } from '../types';

type ConversationResponse = { conversation: Conversation };

/** One function per backend endpoint; see wiki.md "Messages API". */
export const chatApi = {
  list: () => apiRequest<{ conversations: Conversation[] }>('/api/v1/conversations', { authenticated: true }),

  unread: () => apiRequest<{ count: number }>('/api/v1/conversations/unread', { authenticated: true }),

  /** One other player: the direct conversation with them. More: a new group (title required). */
  create: (userIds: string[], title?: string) =>
    apiRequest<ConversationResponse>('/api/v1/conversations', {
      method: 'POST',
      body: title ? { userIds, title } : { userIds },
      authenticated: true,
    }),

  get: (id: string) => apiRequest<ConversationResponse>(`/api/v1/conversations/${id}`, { authenticated: true }),

  addMembers: (id: string, userIds: string[]) =>
    apiRequest<ConversationResponse>(`/api/v1/conversations/${id}/members`, { method: 'POST', body: { userIds }, authenticated: true }),

  leave: (id: string) => apiRequest<{ left: true }>(`/api/v1/conversations/${id}/leave`, { method: 'POST', authenticated: true }),

  /** Time order. `after`: only newer messages (polling); `before`: the older page. */
  messages: (id: string, cursor?: { after?: string; before?: string }) => {
    const query = cursor?.after ? `?after=${cursor.after}` : cursor?.before ? `?before=${cursor.before}` : '';
    return apiRequest<{ messages: ChatMessage[] }>(`/api/v1/conversations/${id}/messages${query}`, { authenticated: true });
  },

  send: (id: string, content: string) =>
    apiRequest<{ message: ChatMessage }>(`/api/v1/conversations/${id}/messages`, { method: 'POST', body: { content }, authenticated: true }),

  deleteMessage: (id: string, messageId: string) =>
    apiRequest<{ deleted: true }>(`/api/v1/conversations/${id}/messages/${messageId}`, { method: 'DELETE', authenticated: true }),

  markRead: (id: string) => apiRequest<{ read: true }>(`/api/v1/conversations/${id}/read`, { method: 'POST', authenticated: true }),
};
