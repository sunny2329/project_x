import type { Queryable } from '../../database/pool.js';
import { UserStatus } from '../auth/auth.types.js';
import { FollowStatus } from '../profile/profile.types.js';

/** A sport rating as search results and profile cards show it ("● 1186"). */
export interface SportRating {
  sportId: string;
  slug: string;
  name: string;
  accentColor: string;
  rating: number;
}

/** A person in search results, follower lists and pickers. */
export interface UserSummary {
  id: string;
  username: string;
  fullName: string;
  photoUrl: string | null;
  city: string | null;
  isFollowing: boolean;
  /** Rated sports, most played first. */
  ratings: SportRating[];
}

/** Someone in a followers / following list. */
export interface FollowListUser extends UserSummary {
  /** They follow the viewer (for "Follow back"). */
  followsMe: boolean;
}

export type FollowList = 'followers' | 'following';

/** Keyset position in a follow list: the follow row's exact `created_at` text and its id. */
export interface FollowCursor {
  createdAt: string;
  id: string;
}

export interface HeadToHead {
  /** Viewer vs this user. */
  wins: number;
  losses: number;
  /** Viewer and this user on the same side. */
  partnerWins: number;
  partnerLosses: number;
  /** Viewer's results against this user, oldest first, at most 5. */
  recent: Array<'W' | 'L'>;
}

/** `$1` is the viewer; expects `u` (usr_user) and `pr` (usr_user_profile). */
export const USER_SUMMARY_COLUMNS = `
  u.id, u.username, coalesce(pr.display_name, u.username) AS "fullName", pr.profile_photo AS "photoUrl", pr.city,
  EXISTS (SELECT 1 FROM usr_user_follow f WHERE f.follower_id = $1 AND f.following_id = u.id AND f.status_id = ${FollowStatus.ACCEPTED}) AS "isFollowing",
  coalesce((SELECT json_agg(json_build_object('sportId', s.id::text, 'slug', s.slug, 'name', s.name, 'accentColor', s.accent_color,
                                              'rating', round(r.rating)::int) ORDER BY r.rated_matches DESC, s.sort_order)
              FROM players pl JOIN player_ratings r ON r.player_id = pl.id JOIN sports s ON s.id = r.sport_id
             WHERE pl.user_id = u.id AND s.is_active), '[]'::json) AS ratings`;

/** Neither the viewer (`$1`) nor `u` has blocked the other. */
const NOT_BLOCKED = `
  NOT EXISTS (SELECT 1 FROM usr_user_block b
               WHERE (b.blocker_id = $1 AND b.blocked_id = u.id) OR (b.blocker_id = u.id AND b.blocked_id = $1))`;

export const usersRepository = {
  /** Active users by username prefix or name, exact username first; never the viewer or anyone blocked. */
  async search(db: Queryable, viewerId: string, query: string, limit: number): Promise<UserSummary[]> {
    const pattern = query.toLowerCase().replace(/^@/, '').replace(/[\\%_]/g, (c) => `\\${c}`);
    const { rows } = await db.query<UserSummary>(
      `SELECT ${USER_SUMMARY_COLUMNS}
         FROM usr_user u LEFT JOIN usr_user_profile pr ON pr.user_id = u.id
        WHERE u.status = $2 AND u.id <> $1 AND ${NOT_BLOCKED}
          AND (lower(u.username) LIKE $3 || '%' OR lower(pr.display_name) LIKE '%' || $3 || '%')
        ORDER BY lower(u.username) = $3 DESC, lower(coalesce(pr.display_name, u.username))
        LIMIT $4`,
      [viewerId, UserStatus.ACTIVE, pattern, limit],
    );
    return rows;
  },

  async findSummary(db: Queryable, viewerId: string, userId: string): Promise<UserSummary | null> {
    const { rows } = await db.query<UserSummary>(
      `SELECT ${USER_SUMMARY_COLUMNS}
         FROM usr_user u LEFT JOIN usr_user_profile pr ON pr.user_id = u.id
        WHERE u.id = $2 AND u.status = $3 AND ${NOT_BLOCKED}`,
      [viewerId, userId, UserStatus.ACTIVE],
    );
    return rows[0] ?? null;
  },

  async findExtras(db: Queryable, userId: string): Promise<{ bio: string | null; displayName: string | null }> {
    const { rows } = await db.query<{ bio: string | null; displayName: string | null }>(
      `SELECT pr.bio, pl.display_name AS "displayName"
         FROM usr_user u LEFT JOIN usr_user_profile pr ON pr.user_id = u.id LEFT JOIN players pl ON pl.user_id = u.id
        WHERE u.id = $1`,
      [userId],
    );
    return rows[0] ?? { bio: null, displayName: null };
  },

  async follow(db: Queryable, followerId: string, followingId: string): Promise<void> {
    await db.query(
      `INSERT INTO usr_user_follow (follower_id, following_id, status_id) VALUES ($1, $2, $3)
       ON CONFLICT (follower_id, following_id) DO UPDATE SET status_id = EXCLUDED.status_id, updated_at = CURRENT_TIMESTAMP`,
      [followerId, followingId, FollowStatus.ACCEPTED],
    );
  },

  async unfollow(db: Queryable, followerId: string, followingId: string): Promise<void> {
    await db.query('DELETE FROM usr_user_follow WHERE follower_id = $1 AND following_id = $2', [followerId, followingId]);
  },

  /**
   * Who follows `userId` (or whom they follow), newest first, as `viewerId` sees them: active
   * accounts only, nobody blocked either way, optionally filtered by username / name.
   */
  async listFollows(
    db: Queryable,
    viewerId: string,
    userId: string,
    list: FollowList,
    options: { q?: string | undefined; limit: number; after?: FollowCursor | undefined },
  ): Promise<{ users: FollowListUser[]; next: FollowCursor | null }> {
    const [self, other] = list === 'followers' ? ['following_id', 'follower_id'] : ['follower_id', 'following_id'];
    const pattern = options.q ? options.q.toLowerCase().replace(/^@/, '').replace(/[\\%_]/g, (c) => `\\${c}`) : null;
    const { rows } = await db.query<FollowListUser & { cursorAt: string; cursorId: string }>(
      `SELECT ${USER_SUMMARY_COLUMNS},
              EXISTS (SELECT 1 FROM usr_user_follow b WHERE b.follower_id = u.id AND b.following_id = $1 AND b.status_id = $3) AS "followsMe",
              f.created_at::text AS "cursorAt", f.id AS "cursorId"
         FROM usr_user_follow f
         JOIN usr_user u ON u.id = f.${other}
         LEFT JOIN usr_user_profile pr ON pr.user_id = u.id
        WHERE f.${self} = $2 AND f.status_id = $3 AND u.status = $4 AND ${NOT_BLOCKED}
          AND ($5::text IS NULL OR lower(u.username) LIKE $5 || '%' OR lower(pr.display_name) LIKE '%' || $5 || '%')
          AND ($6::timestamp IS NULL OR (f.created_at, f.id) < ($6::timestamp, $7::uuid))
        ORDER BY f.created_at DESC, f.id DESC
        LIMIT $8`,
      [viewerId, userId, FollowStatus.ACCEPTED, UserStatus.ACTIVE, pattern, options.after?.createdAt ?? null, options.after?.id ?? null, options.limit + 1],
    );
    const page = rows.slice(0, options.limit);
    const last = page[page.length - 1];
    return {
      users: page.map(({ cursorAt: _at, cursorId: _id, ...user }) => user),
      next: rows.length > options.limit && last ? { createdAt: last.cursorAt, id: last.cursorId } : null,
    };
  },

  /** Decided matches the two users played together, from the viewer's side. */
  async headToHead(db: Queryable, viewerId: string, userId: string): Promise<HeadToHead> {
    const { rows } = await db.query<{ partners: boolean; won: boolean }>(
      `SELECT a.side_id = b.side_id AS partners, sa.outcome = 'won' AS won
         FROM matches m
         JOIN match_participants a ON a.match_id = m.id AND a.player_id = (SELECT id FROM players WHERE user_id = $1)
         JOIN match_participants b ON b.match_id = m.id AND b.player_id = (SELECT id FROM players WHERE user_id = $2)
         JOIN match_sides sa ON sa.id = a.side_id
        WHERE m.status IN ('completed', 'retired', 'walkover') AND sa.outcome IN ('won', 'lost')
        ORDER BY coalesce(m.completed_at, m.created_at)`,
      [viewerId, userId],
    );
    const against = rows.filter((r) => !r.partners);
    const together = rows.filter((r) => r.partners);
    return {
      wins: against.filter((r) => r.won).length,
      losses: against.filter((r) => !r.won).length,
      partnerWins: together.filter((r) => r.won).length,
      partnerLosses: together.filter((r) => !r.won).length,
      recent: against.slice(-5).map((r) => (r.won ? 'W' : 'L')),
    };
  },
};

export type UsersRepository = typeof usersRepository;
