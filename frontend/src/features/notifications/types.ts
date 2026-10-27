/** Mirrors AppNotification in backend/src/modules/notifications/notifications.repository.ts. */
export interface AppNotification {
  id: string;
  type: 'like' | 'comment' | 'post' | 'follow';
  /** "Asha liked your post". */
  title: string;
  /** The comment, or the start of the new post. */
  message: string | null;
  isRead: boolean;
  createdAt: string;
  actor: { id: string; username: string; fullName: string; photoUrl: string | null };
  /** The post for likes, comments and new posts; null for follows. */
  postId: string | null;
}

export interface NotificationPage {
  notifications: AppNotification[];
  unreadCount: number;
  nextCursor: string | null;
}
