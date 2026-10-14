import type { Queryable } from '../../database/pool.js';
import { UserStatus } from '../auth/auth.types.js';
import { MatchStatus } from '../match/match.codes.js';
import { FollowStatus, type MatchHistoryItem, type PlayerSearchResult, type PlayerSport, type Sport } from './profile.types.js';

/** Data access for the player profile: `usr_user_profile`, `usr_user_sport`, stats, ratings and match history. */
export const profileRepository = {
  async listSports(db: Queryable): Promise<Sport[]> {
    const { rows } = await db.query<Sport>('SELECT id::text AS id, code, name FROM mst_sport ORDER BY id');
    return rows;
  },

  async countExistingSports(db: Queryable, sportIds: string[]): Promise<number> {
    const { rows } = await db.query<{ count: number }>('SELECT count(*)::int AS count FROM mst_sport WHERE id = ANY($1::bigint[])', [
      sportIds,
    ]);
    return rows[0]!.count;
  },

  async findBio(db: Queryable, userId: string): Promise<string | null> {
    const { rows } = await db.query<{ bio: string | null }>('SELECT bio FROM usr_user_profile WHERE user_id = $1', [userId]);
    return rows[0]?.bio ?? null;
  },

  async findPlayerSports(db: Queryable, userId: string): Promise<PlayerSport[]> {
    const { rows } = await db.query<PlayerSport>(
      `SELECT s.id::text AS id, s.code, s.name, us.is_primary AS "isPrimary",
              coalesce(r.rating, 1000)::float8 AS rating,
              coalesce(st.matches_played, 0) AS "matchesPlayed",
              coalesce(st.matches_won, 0) AS "matchesWon",
              coalesce(st.matches_lost, 0) AS "matchesLost",
              coalesce(st.points_scored, 0)::float8 AS "pointsScored",
              coalesce(st.points_conceded, 0)::float8 AS "pointsConceded"
         FROM usr_user_sport us
         JOIN mst_sport s ON s.id = us.sport_id
         LEFT JOIN usr_sport_rating r ON r.user_id = us.user_id AND r.sport_id = us.sport_id
         LEFT JOIN usr_sport_stats st ON st.user_id = us.user_id AND st.sport_id = us.sport_id
        WHERE us.user_id = $1
        ORDER BY us.is_primary DESC, s.id`,
      [userId],
    );
    return rows;
  },

  async findRecord(db: Queryable, userId: string): Promise<{ played: number; won: number; lost: number }> {
    const { rows } = await db.query<{ played: number; won: number; lost: number }>(
      `SELECT coalesce(sum(matches_played), 0)::int AS played,
              coalesce(sum(matches_won), 0)::int AS won,
              coalesce(sum(matches_lost), 0)::int AS lost
         FROM usr_sport_stats WHERE user_id = $1`,
      [userId],
    );
    return rows[0]!;
  },

  async countFollows(db: Queryable, userId: string): Promise<{ followers: number; following: number }> {
    const { rows } = await db.query<{ followers: number; following: number }>(
      `SELECT count(*) FILTER (WHERE following_id = $1)::int AS followers,
              count(*) FILTER (WHERE follower_id = $1)::int AS following
         FROM usr_user_follow
        WHERE (following_id = $1 OR follower_id = $1) AND status_id = $2`,
      [userId, FollowStatus.ACCEPTED],
    );
    return rows[0]!;
  },

  /** Creates the profile row if missing (e.g. users created outside the app), then applies the changes. */
  async updateProfile(
    db: Queryable,
    userId: string,
    fallbackName: string,
    changes: { fullName?: string | undefined; bio?: string | null | undefined },
  ): Promise<void> {
    await db.query(
      'INSERT INTO usr_user_profile (user_id, display_name) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING',
      [userId, fallbackName],
    );
    await db.query(
      `UPDATE usr_user_profile
          SET display_name = coalesce($2, display_name),
              bio = CASE WHEN $3 THEN $4 ELSE bio END,
              updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1`,
      [userId, changes.fullName ?? null, changes.bio !== undefined, changes.bio ?? null],
    );
  },

  /**
   * Replaces the user's sports. Stats and ratings are kept for removed sports (history), and
   * created at their defaults for new ones.
   */
  async replacePlayerSports(db: Queryable, userId: string, sportIds: string[], primarySportId: string | null): Promise<void> {
    await db.query('DELETE FROM usr_user_sport WHERE user_id = $1 AND NOT (sport_id = ANY($2::bigint[]))', [userId, sportIds]);
    await db.query(
      `INSERT INTO usr_user_sport (user_id, sport_id, is_primary)
       SELECT $1, sport_id, sport_id = $3::bigint FROM unnest($2::bigint[]) AS sport_id
       ON CONFLICT (user_id, sport_id)
       DO UPDATE SET is_primary = EXCLUDED.is_primary, updated_at = CURRENT_TIMESTAMP
        WHERE usr_user_sport.is_primary IS DISTINCT FROM EXCLUDED.is_primary`,
      [userId, sportIds, primarySportId],
    );
    await db.query(
      `INSERT INTO usr_sport_rating (user_id, sport_id) SELECT $1, unnest($2::bigint[])
       ON CONFLICT (user_id, sport_id) DO NOTHING`,
      [userId, sportIds],
    );
    await db.query(
      `INSERT INTO usr_sport_stats (user_id, sport_id) SELECT $1, unnest($2::bigint[])
       ON CONFLICT (user_id, sport_id) DO NOTHING`,
      [userId, sportIds],
    );
  },

  /** Every match the user took part in, newest first. */
  async findMatchHistory(db: Queryable, userId: string, limit: number): Promise<MatchHistoryItem[]> {
    const { rows } = await db.query<Omit<MatchHistoryItem, 'playedAt'> & { playedAt: Date }>(
      `SELECT m.id AS "matchId",
              json_build_object('code', s.code, 'name', s.name) AS sport,
              coalesce(m.completed_at, m.started_at, m.scheduled_at, m.created_at) AS "playedAt",
              CASE
                WHEN r.id IS NULL THEN 'in_progress'
                WHEN r.winner_participant_id IS NULL AND r.winner_team_id IS NULL THEN 'draw'
                WHEN r.winner_participant_id = p.id
                  OR r.winner_team_id IN (SELECT tm.team_id FROM match_team_member tm WHERE tm.participant_id = p.id)
                  THEN 'won'
                ELSE 'lost'
              END AS outcome,
              coalesce(
                (SELECT array_agg(coalesce(op.display_name, ou.username) ORDER BY o.participant_no)
                   FROM match_participant o
                   JOIN usr_user ou ON ou.id = o.user_id
                   LEFT JOIN usr_user_profile op ON op.user_id = o.user_id
                  WHERE o.match_id = m.id AND o.id <> p.id),
                '{}'
              ) AS "otherPlayers",
              r.result_data AS result
         FROM match_participant p
         JOIN match_master m ON m.id = p.match_id
         JOIN mst_sport s ON s.id = m.sport_id
         LEFT JOIN match_result r ON r.match_id = m.id
        WHERE p.user_id = $1 AND m.status_id <> $3
        ORDER BY "playedAt" DESC
        LIMIT $2`,
      [userId, limit, MatchStatus.ABANDONED],
    );
    return rows.map((row) => ({ ...row, playedAt: row.playedAt.toISOString() }));
  },

  /**
   * Active players whose username starts with, or whose name contains, `query`; never the
   * searcher or anyone blocked in either direction. Exact username matches first.
   */
  async searchPlayers(db: Queryable, userId: string, query: string, limit: number): Promise<PlayerSearchResult[]> {
    const pattern = query.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`);
    const { rows } = await db.query<PlayerSearchResult>(
      `SELECT u.id, u.username, coalesce(p.display_name, u.username) AS "fullName"
         FROM usr_user u
         LEFT JOIN usr_user_profile p ON p.user_id = u.id
        WHERE u.status = $2 AND u.id <> $1
          AND (lower(u.username) LIKE $3 || '%' OR lower(p.display_name) LIKE '%' || $3 || '%')
          AND NOT EXISTS (SELECT 1 FROM usr_user_block b
                           WHERE (b.blocker_id = $1 AND b.blocked_id = u.id) OR (b.blocker_id = u.id AND b.blocked_id = $1))
        ORDER BY lower(u.username) = $3 DESC, lower(u.username)
        LIMIT $4`,
      [userId, UserStatus.ACTIVE, pattern, limit],
    );
    return rows;
  },
};

export type ProfileRepository = typeof profileRepository;
