import type { Queryable } from '../../database/pool.js';
import { UserStatus } from '../auth/auth.types.js';
import { FollowStatus } from '../profile/profile.types.js';
import { NotificationType, type NotificationKind } from './notification.codes.js';

export interface AppNotification {
  id: string;
  type: NotificationKind;
  /** "Asha liked your post", written when it happened. */
  title: string;
  /** The comment, or the start of the new post. */
  message: string | null;
  isRead: boolean;
  createdAt: string;
  actor: { id: string; username: string; fullName: string; photoUrl: string | null };
  /** The post for likes, comments and new posts; null for follows. */
  postId: string | null;
}

type NotificationRow = Omit<AppNotification, 'createdAt'> & { createdAt: Date };

/** Long comments and posts are cut for the list; the post itself has the full text. */
const PREVIEW_LENGTH = 140;

function preview(text: string | null | undefined): string | null {
  const trimmed = text?.trim();
  if (!trimmed) return null;
  return trimmed.length > PREVIEW_LENGTH ? `${trimmed.slice(0, PREVIEW_LENGTH - 1)}…` : trimmed;
}

/** The actor's name as the app shows it; `$1` is always the actor in the writes below. */
const ACTOR_NAME = `(SELECT coalesce(pr.display_name, u.username) FROM usr_user u LEFT JOIN usr_user_profile pr ON pr.user_id = u.id WHERE u.id = $1)`;

/** Neither of the two users (SQL expressions) has blocked the other. */
function notBlocked(a: string, b: string): string {
  return `NOT EXISTS (SELECT 1 FROM usr_user_block b WHERE (b.blocker_id = ${a} AND b.blocked_id = ${b}) OR (b.blocker_id = ${b} AND b.blocked_id = ${a}))`;
}

/**
 * Shown to `$1`: from an active actor nobody in the pair has blocked, and the post (if any) still
 * exists. Expects `n` (notification) and `a` (actor).
 */
const VISIBLE = `
  n.user_id = $1
  AND a.status = ${UserStatus.ACTIVE}
  AND ${notBlocked('$1', 'n.actor_id')}
  AND (n.reference_id IS NULL OR EXISTS (SELECT 1 FROM social_post sp WHERE sp.id = n.reference_id))`;

const KIND = `CASE n.notification_type_id
  WHEN ${NotificationType.LIKE} THEN 'like' WHEN ${NotificationType.COMMENT} THEN 'comment'
  WHEN ${NotificationType.POST} THEN 'post' ELSE 'follow' END`;

export const notificationsRepository = {
  /** "Liked your post": once per person and post, to the post's author (never for your own post). */
  async liked(db: Queryable, actorId: string, postId: string): Promise<void> {
    await db.query(
      `INSERT INTO notification (user_id, actor_id, notification_type_id, title, reference_id)
       SELECT sp.user_id, $1::uuid, ${NotificationType.LIKE}, ${ACTOR_NAME} || ' liked your post', sp.id
         FROM social_post sp
        WHERE sp.id = $2 AND sp.user_id <> $1 AND ${notBlocked('sp.user_id', '$1')}
          AND NOT EXISTS (SELECT 1 FROM notification n
                           WHERE n.user_id = sp.user_id AND n.actor_id = $1 AND n.reference_id = sp.id
                             AND n.notification_type_id = ${NotificationType.LIKE})`,
      [actorId, postId],
    );
  },

  /** Taking a like back takes its notification back too. */
  async unliked(db: Queryable, actorId: string, postId: string): Promise<void> {
    await db.query('DELETE FROM notification WHERE actor_id = $1 AND reference_id = $2 AND notification_type_id = $3', [
      actorId,
      postId,
      NotificationType.LIKE,
    ]);
  },

  /** "Commented on your post", with the comment, to the post's author (never for your own post). */
  async commented(db: Queryable, actorId: string, postId: string, content: string): Promise<void> {
    await db.query(
      `INSERT INTO notification (user_id, actor_id, notification_type_id, title, message, reference_id)
       SELECT sp.user_id, $1::uuid, ${NotificationType.COMMENT}, ${ACTOR_NAME} || ' commented on your post', $3::text, sp.id
         FROM social_post sp
        WHERE sp.id = $2 AND sp.user_id <> $1 AND ${notBlocked('sp.user_id', '$1')}`,
      [actorId, postId, preview(content)],
    );
  },

  /** "Posted": to everyone following the author, when the post is one they may see. */
  async posted(db: Queryable, actorId: string, postId: string, content: string | null): Promise<void> {
    await db.query(
      `INSERT INTO notification (user_id, actor_id, notification_type_id, title, message, reference_id)
       SELECT f.follower_id, $1::uuid, ${NotificationType.POST}, ${ACTOR_NAME} || ' shared a new post', $3::text, $2::uuid
         FROM usr_user_follow f
         JOIN usr_user fu ON fu.id = f.follower_id AND fu.status = ${UserStatus.ACTIVE}
        WHERE f.following_id = $1 AND f.status_id = ${FollowStatus.ACCEPTED} AND f.follower_id <> $1
          AND ${notBlocked('f.follower_id', '$1')}`,
      [actorId, postId, preview(content)],
    );
  },

  /** "Started following you": once per follower while the follow lasts. */
  async followed(db: Queryable, actorId: string, userId: string): Promise<void> {
    await db.query(
      `INSERT INTO notification (user_id, actor_id, notification_type_id, title)
       SELECT $2::uuid, $1::uuid, ${NotificationType.FOLLOW}, ${ACTOR_NAME} || ' started following you'
        WHERE $1::uuid <> $2::uuid AND ${notBlocked('$2::uuid', '$1::uuid')}
          AND NOT EXISTS (SELECT 1 FROM notification n
                           WHERE n.user_id = $2 AND n.actor_id = $1 AND n.notification_type_id = ${NotificationType.FOLLOW})`,
      [actorId, userId],
    );
  },

  async unfollowed(db: Queryable, actorId: string, userId: string): Promise<void> {
    await db.query('DELETE FROM notification WHERE user_id = $1 AND actor_id = $2 AND notification_type_id = $3', [
      userId,
      actorId,
      NotificationType.FOLLOW,
    ]);
  },

  /** Notifications about a deleted post go with it. */
  async postDeleted(db: Queryable, postId: string): Promise<void> {
    await db.query('DELETE FROM notification WHERE reference_id = $1', [postId]);
  },

  /** Newest first, keyset-paginated after `afterId`. */
  async list(db: Queryable, userId: string, options: { limit: number; afterId: string | null }): Promise<AppNotification[]> {
    const { rows } = await db.query<NotificationRow>(
      `SELECT n.id, ${KIND} AS type, n.title, n.message, n.is_read AS "isRead", n.created_at AS "createdAt",
              json_build_object('id', a.id, 'username', a.username, 'fullName', coalesce(apr.display_name, a.username), 'photoUrl', apr.profile_photo) AS actor,
              n.reference_id AS "postId"
         FROM notification n
         JOIN usr_user a ON a.id = n.actor_id
         LEFT JOIN usr_user_profile apr ON apr.user_id = a.id
        WHERE ${VISIBLE}
          AND ($2::uuid IS NULL OR (n.created_at, n.id) < (SELECT x.created_at, x.id FROM notification x WHERE x.id = $2::uuid))
        ORDER BY n.created_at DESC, n.id DESC
        LIMIT $3`,
      [userId, options.afterId, options.limit],
    );
    return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
  },

  /** The number on the bell. */
  async unreadCount(db: Queryable, userId: string): Promise<number> {
    const { rows } = await db.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM notification n JOIN usr_user a ON a.id = n.actor_id WHERE ${VISIBLE} AND NOT n.is_read`,
      [userId],
    );
    return rows[0]!.count;
  },

  async markRead(db: Queryable, userId: string, notificationId: string): Promise<boolean> {
    const { rowCount } = await db.query('UPDATE notification SET is_read = true, read_at = coalesce(read_at, CURRENT_TIMESTAMP) WHERE id = $1 AND user_id = $2', [
      notificationId,
      userId,
    ]);
    return (rowCount ?? 0) > 0;
  },

  async markAllRead(db: Queryable, userId: string): Promise<void> {
    await db.query('UPDATE notification SET is_read = true, read_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND NOT is_read', [userId]);
  },
};

export type NotificationsRepository = typeof notificationsRepository;
