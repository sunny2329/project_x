import type { Queryable } from '../../database/pool.js';
import { UserStatus } from '../auth/auth.types.js';
import { NOT_BLOCKED, POST_COLUMNS, POST_FROM, toFeedPost, type FeedPost, type FeedRow } from '../feed/feed.repository.js';
import { PostType, PostVisibility } from '../match/match.codes.js';
import { FollowStatus } from '../profile/profile.types.js';

export interface PostComment {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; username: string; fullName: string };
}

type CommentRow = Omit<PostComment, 'createdAt'> & { createdAt: Date };

/**
 * The viewer (`$1`) may see the post: it is theirs, or it is public, or it is for followers and
 * they follow the author; and nobody is blocked and the author's account is active.
 */
const CAN_SEE = `
  (sp.user_id = $1
   OR coalesce(sp.visibility_id, ${PostVisibility.PUBLIC}) = ${PostVisibility.PUBLIC}
   OR EXISTS (SELECT 1 FROM usr_user_follow f
               WHERE f.follower_id = $1 AND f.following_id = sp.user_id AND f.status_id = ${FollowStatus.ACCEPTED}))
  AND ${NOT_BLOCKED}
  AND u.status = ${UserStatus.ACTIVE}`;

const COMMENT_COLUMNS = `
  c.id, c.content, c.created_at AS "createdAt",
  json_build_object('id', cu.id, 'username', cu.username, 'fullName', coalesce(cpr.display_name, cu.username)) AS author`;

export const socialRepository = {
  async createPost(db: Queryable, post: { userId: string; content: string; visibilityId: number }): Promise<string> {
    const { rows } = await db.query<{ id: string }>(
      'INSERT INTO social_post (user_id, post_type_id, content, visibility_id) VALUES ($1, $2, $3, $4) RETURNING id',
      [post.userId, PostType.TEXT, post.content, post.visibilityId],
    );
    return rows[0]!.id;
  },

  /** The post if the viewer may see it. */
  async findVisiblePost(db: Queryable, viewerId: string, postId: string): Promise<FeedPost | null> {
    const { rows } = await db.query<FeedRow>(`SELECT ${POST_COLUMNS} ${POST_FROM} WHERE sp.id = $2 AND ${CAN_SEE}`, [viewerId, postId]);
    return rows[0] ? toFeedPost(rows[0]) : null;
  },

  async canSeePost(db: Queryable, viewerId: string, postId: string): Promise<boolean> {
    const { rows } = await db.query(`SELECT 1 FROM social_post sp JOIN usr_user u ON u.id = sp.user_id WHERE sp.id = $2 AND ${CAN_SEE}`, [
      viewerId,
      postId,
    ]);
    return rows.length > 0;
  },

  /** Deletes the user's own written post (automatic match-result posts stay). Likes and comments cascade. */
  async deleteOwnPost(db: Queryable, userId: string, postId: string): Promise<boolean> {
    const { rowCount } = await db.query('DELETE FROM social_post WHERE id = $1 AND user_id = $2 AND post_type_id = $3', [
      postId,
      userId,
      PostType.TEXT,
    ]);
    return (rowCount ?? 0) > 0;
  },

  async like(db: Queryable, userId: string, postId: string): Promise<void> {
    await db.query('INSERT INTO social_post_like (post_id, user_id) VALUES ($1, $2) ON CONFLICT (post_id, user_id) DO NOTHING', [postId, userId]);
  },

  async unlike(db: Queryable, userId: string, postId: string): Promise<void> {
    await db.query('DELETE FROM social_post_like WHERE post_id = $1 AND user_id = $2', [postId, userId]);
  },

  async likeState(db: Queryable, userId: string, postId: string): Promise<{ likeCount: number; likedByMe: boolean }> {
    const { rows } = await db.query<{ likeCount: number; likedByMe: boolean }>(
      `SELECT count(*)::int AS "likeCount", coalesce(bool_or(user_id = $1), false) AS "likedByMe"
         FROM social_post_like WHERE post_id = $2`,
      [userId, postId],
    );
    return rows[0]!;
  },

  /** Oldest first, keyset-paginated after `afterCommentId`; comments by people blocked either way are hidden. */
  async listComments(db: Queryable, viewerId: string, postId: string, options: { limit: number; afterCommentId: string | null }): Promise<PostComment[]> {
    const { rows } = await db.query<CommentRow>(
      `SELECT ${COMMENT_COLUMNS}
         FROM social_post_comment c
         JOIN usr_user cu ON cu.id = c.user_id
         LEFT JOIN usr_user_profile cpr ON cpr.user_id = cu.id
        WHERE c.post_id = $2
          AND cu.status = ${UserStatus.ACTIVE}
          AND NOT EXISTS (SELECT 1 FROM usr_user_block b
                           WHERE (b.blocker_id = $1 AND b.blocked_id = c.user_id)
                              OR (b.blocker_id = c.user_id AND b.blocked_id = $1))
          AND ($3::uuid IS NULL OR (c.created_at, c.id) > (SELECT x.created_at, x.id FROM social_post_comment x WHERE x.id = $3::uuid))
        ORDER BY c.created_at, c.id
        LIMIT $4`,
      [viewerId, postId, options.afterCommentId, options.limit],
    );
    return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
  },

  async createComment(db: Queryable, comment: { postId: string; userId: string; content: string }): Promise<PostComment> {
    const { rows } = await db.query<CommentRow>(
      `WITH c AS (
         INSERT INTO social_post_comment (post_id, user_id, content) VALUES ($1, $2, $3)
         RETURNING id, content, created_at, user_id
       )
       SELECT ${COMMENT_COLUMNS}
         FROM c
         JOIN usr_user cu ON cu.id = c.user_id
         LEFT JOIN usr_user_profile cpr ON cpr.user_id = cu.id`,
      [comment.postId, comment.userId, comment.content],
    );
    const row = rows[0]!;
    return { ...row, createdAt: row.createdAt.toISOString() };
  },

  /** The comment's author or the post's author may delete it. */
  async deleteComment(db: Queryable, userId: string, postId: string, commentId: string): Promise<boolean> {
    const { rowCount } = await db.query(
      `DELETE FROM social_post_comment c USING social_post sp
        WHERE c.id = $1 AND c.post_id = $2 AND sp.id = c.post_id AND (c.user_id = $3 OR sp.user_id = $3)`,
      [commentId, postId, userId],
    );
    return (rowCount ?? 0) > 0;
  },
};

export type SocialRepository = typeof socialRepository;
