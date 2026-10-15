import type { Queryable } from '../../database/pool.js';
import { FollowStatus, type MatchHistoryItem, type PlayerSport } from './profile.types.js';

const SPORT_JSON = "json_build_object('id', s.id::text, 'slug', s.slug, 'name', s.name, 'iconKey', s.icon_key, 'accentColor', s.accent_color)";

/**
 * Data access for the player profile: `usr_user_profile`, and the user's player row in the new
 * core (`player_sports`, `player_sport_stats`, `player_ratings`, match history).
 */
export const profileRepository = {
  /** Active sport ids among `sportIds`. */
  async countActiveSports(db: Queryable, sportIds: string[]): Promise<number> {
    const { rows } = await db.query<{ count: number }>('SELECT count(*)::int AS count FROM sports WHERE is_active AND id = ANY($1::int[])', [sportIds]);
    return rows[0]!.count;
  },

  async findBio(db: Queryable, userId: string): Promise<string | null> {
    const { rows } = await db.query<{ bio: string | null }>('SELECT bio FROM usr_user_profile WHERE user_id = $1', [userId]);
    return rows[0]?.bio ?? null;
  },

  async findPlayerSports(db: Queryable, userId: string): Promise<PlayerSport[]> {
    const { rows } = await db.query<PlayerSport>(
      `SELECT s.id::text AS id, s.slug, s.name, s.icon_key AS "iconKey", s.accent_color AS "accentColor",
              ps.is_primary AS "isPrimary",
              coalesce(r.rating, 1000)::float8 AS rating, coalesce(r.rated_matches, 0) AS "ratedMatches",
              coalesce(st.matches_played, 0) AS "matchesPlayed", coalesce(st.won, 0) AS "matchesWon", coalesce(st.lost, 0) AS "matchesLost",
              coalesce(st.major_won, 0) AS "majorWon", coalesce(st.major_lost, 0) AS "majorLost",
              coalesce(st.minor_won, 0) AS "minorWon", coalesce(st.minor_lost, 0) AS "minorLost"
         FROM players p
         JOIN player_sports ps ON ps.player_id = p.id
         JOIN sports s ON s.id = ps.sport_id AND s.is_active
         LEFT JOIN player_ratings r ON r.player_id = p.id AND r.sport_id = s.id
         LEFT JOIN player_sport_stats st ON st.player_id = p.id AND st.sport_id = s.id
        WHERE p.user_id = $1
        ORDER BY ps.is_primary DESC, s.sort_order, s.id`,
      [userId],
    );
    return rows;
  },

  async findRecord(db: Queryable, userId: string): Promise<{ played: number; won: number; lost: number }> {
    const { rows } = await db.query<{ played: number; won: number; lost: number }>(
      `SELECT coalesce(sum(st.matches_played), 0)::int AS played, coalesce(sum(st.won), 0)::int AS won, coalesce(sum(st.lost), 0)::int AS lost
         FROM players p JOIN player_sport_stats st ON st.player_id = p.id
        WHERE p.user_id = $1`,
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

  /** Replaces the player's sports ("sports I play"); records and ratings are kept for removed ones. */
  async replacePlayerSports(db: Queryable, playerId: string, sportIds: string[], primarySportId: string | null): Promise<void> {
    await db.query('DELETE FROM player_sports WHERE player_id = $1 AND NOT (sport_id = ANY($2::int[]))', [playerId, sportIds]);
    // Clear the old primary first: one primary per player is a unique index.
    await db.query('UPDATE player_sports SET is_primary = false WHERE player_id = $1 AND is_primary AND sport_id IS DISTINCT FROM $2::int', [playerId, primarySportId]);
    await db.query(
      `INSERT INTO player_sports (player_id, sport_id, is_primary)
       SELECT $1, sport_id, sport_id = $3::int FROM unnest($2::int[]) AS sport_id
       ON CONFLICT (player_id, sport_id) DO UPDATE SET is_primary = EXCLUDED.is_primary`,
      [playerId, sportIds, primarySportId],
    );
  },

  /** Every match the user's player took part in (not abandoned), newest first. */
  async findMatchHistory(db: Queryable, userId: string, limit: number): Promise<MatchHistoryItem[]> {
    const { rows } = await db.query<Omit<MatchHistoryItem, 'playedAt' | 'headline'> & { playedAt: Date; headline: string | null; sideIndex: number; summary: { segments?: Array<{ complete: boolean; scores: number[] }> } | null }>(
      `SELECT m.id AS "matchId", m.context::text AS context, ${SPORT_JSON} AS sport,
              coalesce(m.completed_at, m.started_at, m.created_at) AS "playedAt",
              CASE WHEN m.status = 'disputed' THEN 'disputed'
                   WHEN ms.outcome IS NULL THEN 'in_progress'
                   WHEN ms.outcome = 'drawn' THEN 'draw'
                   ELSE ms.outcome::text END AS outcome,
              m.result_type::text AS "resultType",
              coalesce((SELECT array_agg(op.display_name ORDER BY os.side_index, o.sort_order)
                          FROM match_participants o JOIN players op ON op.id = o.player_id JOIN match_sides os ON os.id = o.side_id
                         WHERE o.match_id = m.id AND o.id <> mp.id), '{}') AS "otherPlayers",
              m.summary->>'headline' AS headline, ms.side_index AS "sideIndex", m.summary AS summary,
              (SELECT h.rating_after - h.rating_before FROM player_rating_history h WHERE h.match_id = m.id AND h.player_id = p.id) AS "ratingChange"
         FROM players p
         JOIN match_participants mp ON mp.player_id = p.id
         JOIN match_sides ms ON ms.id = mp.side_id
         JOIN matches m ON m.id = mp.match_id
         JOIN sports s ON s.id = m.sport_id
        WHERE p.user_id = $1 AND m.status <> 'abandoned'
        ORDER BY "playedAt" DESC
        LIMIT $2`,
      [userId, limit],
    );
    return rows.map(({ summary, sideIndex, ...row }) => {
      // The score line from the user's side: "21-15, 18-21" reads "my points first".
      const segments = (summary?.segments ?? []).filter((g) => g.complete || g.scores.some((n) => n > 0));
      const own = segments.length ? segments.map((g) => `${g.scores[sideIndex]}-${g.scores[1 - sideIndex]}`).join(', ') : row.headline;
      return { ...row, headline: own, playedAt: row.playedAt.toISOString() };
    });
  },
};

export type ProfileRepository = typeof profileRepository;
