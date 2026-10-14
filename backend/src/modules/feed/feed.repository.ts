import type { Queryable } from '../../database/pool.js';
import { UserStatus } from '../auth/auth.types.js';
import { PostVisibility } from '../match/match.codes.js';
import { FollowStatus } from '../profile/profile.types.js';

export interface FeedPost {
  id: string;
  content: string | null;
  createdAt: string;
  author: { id: string; username: string; fullName: string };
  /** The match the post is about, when there is one. */
  match: FeedMatch | null;
  visibility: 'public' | 'followers';
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
}

export interface FeedMatch {
  id: string;
  sport: { code: string; name: string };
  /** "Singles", "Doubles", "Team". */
  format: string | null;
  /** From start to the result being saved; null when either time is missing. */
  durationSeconds: number | null;
  /** From match_result.result_data; null if the match has no saved result. */
  result: {
    summary: string;
    /** 1 or 2; null on a draw. */
    winnerSide: 1 | 2 | null;
    sides: { no: 1 | 2; name: string; headline: number }[];
    /** Games, sets, halves or innings played. */
    periodCount: number;
  } | null;
}

export type FeedRow = Omit<FeedPost, 'createdAt'> & { createdAt: Date };

/**
 * Columns of a post as the app shows it; `$1` is the viewer. Expects `sp` (social_post), `u` (author),
 * `pr` (author profile), `m` (match), `s` (sport), `f` (format) and `mr` (result) as in POST_FROM.
 */
export const POST_COLUMNS = `
  sp.id, sp.content, sp.created_at AS "createdAt",
  json_build_object('id', u.id, 'username', u.username, 'fullName', coalesce(pr.display_name, u.username)) AS author,
  CASE WHEN m.id IS NULL THEN NULL
       ELSE json_build_object(
         'id', m.id,
         'sport', json_build_object('code', s.code, 'name', s.name),
         'format', f.name,
         'durationSeconds', CASE WHEN m.started_at IS NOT NULL AND m.completed_at IS NOT NULL
                                 THEN greatest(extract(epoch FROM m.completed_at - m.started_at), 0)::int END,
         'result', CASE WHEN mr.id IS NULL THEN NULL ELSE json_build_object(
           'summary', mr.result_data->>'summary',
           'winnerSide', mr.result_data->'winnerSide',
           'sides', coalesce(mr.result_data->'sides', '[]'::jsonb),
           'periodCount', jsonb_array_length(coalesce(mr.result_data->'periods', '[]'::jsonb))) END) END AS match,
  CASE WHEN sp.visibility_id = ${PostVisibility.FOLLOWERS} THEN 'followers' ELSE 'public' END AS visibility,
  (SELECT count(*)::int FROM social_post_like l WHERE l.post_id = sp.id) AS "likeCount",
  (SELECT count(*)::int FROM social_post_comment c WHERE c.post_id = sp.id) AS "commentCount",
  EXISTS (SELECT 1 FROM social_post_like l WHERE l.post_id = sp.id AND l.user_id = $1) AS "likedByMe"`;

export const POST_FROM = `
  FROM social_post sp
  JOIN usr_user u ON u.id = sp.user_id
  LEFT JOIN usr_user_profile pr ON pr.user_id = u.id
  LEFT JOIN match_master m ON m.id = sp.match_id
  LEFT JOIN mst_sport s ON s.id = m.sport_id
  LEFT JOIN mst_sport_format f ON f.id = m.format_id
  LEFT JOIN match_result mr ON mr.match_id = m.id`;

/** Neither the viewer (`$1`) nor the author has blocked the other. */
export const NOT_BLOCKED = `
  NOT EXISTS (SELECT 1 FROM usr_user_block b
               WHERE (b.blocker_id = $1 AND b.blocked_id = sp.user_id)
                  OR (b.blocker_id = sp.user_id AND b.blocked_id = $1))`;

export function toFeedPost(row: FeedRow): FeedPost {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

export const feedRepository = {
  /**
   * The user's own posts and those of players they follow (accepted follows only), newest
   * first, excluding anyone blocked in either direction and inactive accounts.
   */
  async findFeed(db: Queryable, userId: string, options: { limit: number; afterPostId: string | null }): Promise<FeedPost[]> {
    const { rows } = await db.query<FeedRow>(
      `SELECT ${POST_COLUMNS}
       ${POST_FROM}
        WHERE (sp.user_id = $1
               OR sp.user_id IN (SELECT following_id FROM usr_user_follow WHERE follower_id = $1 AND status_id = $2))
          AND ${NOT_BLOCKED}
          AND u.status = $3
          -- Keyset pagination. The cursor post's own created_at is read in SQL because the column has
          -- microsecond precision that a JS Date would truncate; the id breaks timestamp ties.
          AND ($4::uuid IS NULL OR (sp.created_at, sp.id) < (SELECT c.created_at, c.id FROM social_post c WHERE c.id = $4::uuid))
        ORDER BY sp.created_at DESC, sp.id DESC
        LIMIT $5`,
      [userId, FollowStatus.ACCEPTED, UserStatus.ACTIVE, options.afterPostId, options.limit],
    );
    return rows.map(toFeedPost);
  },
};

export type FeedRepository = typeof feedRepository;
