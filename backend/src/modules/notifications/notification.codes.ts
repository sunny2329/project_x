/** `notification.notification_type_id` (type_master category 14). */
export const NotificationType = { LIKE: 1401, COMMENT: 1402, POST: 1403, FOLLOW: 1404 } as const;

export type NotificationKind = 'like' | 'comment' | 'post' | 'follow';
