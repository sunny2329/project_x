import type { Queryable } from '../../database/pool.js';
import { UserStatus } from '../auth/auth.types.js';
import { PostVisibility } from './post.codes.js';
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
  context: 'friendly' | 'tournament';
  sport: { id: string; slug: string; name: string; iconKey: string; accentColor: string };
  /** "Singles", "Doubles". */
  format: string | null;
  /** From start to the result being saved; null when either time is missing. */
  durationSeconds: number | null;
  /** From the match's ScoreSummary; null while it is not decided. */
  result: {
    headline: string;
    winnerSideIndex: number | null;
    /** played / retired. */
    resultType: string | null;
    sides: { index: number; name: string; primary: string }[];
    /** Games or sets played. */
    segmentCount: number;
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
         'context', m.context,
         'sport', json_build_object('id', s.id::text, 'slug', s.slug, 'name', s.name, 'iconKey', s.icon_key, 'accentColor', s.accent_color),
         'format', f.name,
         'durationSeconds', CASE WHEN m.started_at IS NOT NULL AND m.completed_at IS NOT NULL
                                 THEN greatest(extract(epoch FROM m.completed_at - m.started_at), 0)::int END,
         'result', CASE WHEN m.status NOT IN ('completed', 'retired', 'walkover') THEN NULL ELSE json_build_object(
           'headline', m.summary->>'headline',
           'winnerSideIndex', m.summary->'winnerSideIndex',
           'resultType', m.result_type,
           'sides', (SELECT coalesce(json_agg(json_build_object(
                        'index', ms.side_index,
                        'name', coalesce(ms.name, (SELECT string_agg(split_part(pl.display_name, ' ', 1), ' & ' ORDER BY mp.sort_order)
                                                     FROM match_participants mp JOIN players pl ON pl.id = mp.player_id WHERE mp.side_id = ms.id)),
                        'primary', m.summary->'sides'->ms.side_index->>'primary') ORDER BY ms.side_index), '[]'::json)
                       FROM match_sides ms WHERE ms.match_id = m.id),
           'segmentCount', jsonb_array_length(coalesce(m.summary->'segments', '[]'::jsonb))) END) END AS match,
  CASE WHEN sp.visibility_id = ${PostVisibility.FOLLOWERS} THEN 'followers' ELSE 'public' END AS visibility,
  (SELECT count(*)::int FROM social_post_like l WHERE l.post_id = sp.id) AS "likeCount",
  (SELECT count(*)::int FROM social_post_comment c WHERE c.post_id = sp.id) AS "commentCount",
  EXISTS (SELECT 1 FROM social_post_like l WHERE l.post_id = sp.id AND l.user_id = $1) AS "likedByMe"`;

export const POST_FROM = `
  FROM social_post sp
  JOIN usr_user u ON u.id = sp.user_id
  LEFT JOIN usr_user_profile pr ON pr.user_id = u.id
  LEFT JOIN matches m ON m.id = sp.match_id
  LEFT JOIN sports s ON s.id = m.sport_id
  LEFT JOIN sport_formats f ON f.id = m.sport_format_id`;

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
