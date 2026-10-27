import { apiRequest } from '@/shared/api/client';
import type { NotificationPage } from '../types';

/** One function per backend endpoint; see wiki.md "Notifications API". */
export const notificationsApi = {
  list: (cursor?: string) => apiRequest<NotificationPage>(`/api/v1/notifications${cursor ? `?cursor=${cursor}` : ''}`, { authenticated: true }),

  /** The number on the bell. */
  unread: () => apiRequest<{ count: number }>('/api/v1/notifications/unread', { authenticated: true }),

  readAll: () => apiRequest<{ read: true }>('/api/v1/notifications/read', { method: 'POST', authenticated: true }),

  read: (id: string) => apiRequest<{ read: true }>(`/api/v1/notifications/${id}/read`, { method: 'POST', authenticated: true }),
};
