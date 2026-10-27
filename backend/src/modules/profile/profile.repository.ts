import type { Queryable } from '../../database/pool.js';
import { UserStatus } from '../auth/auth.types.js';
import { FollowStatus, type MatchHistoryItem, type PlayerSport, type RatingTrend } from './profile.types.js';

/** How many rated matches the profile trend line shows. */
const TREND_POINTS = 12;

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

  async findExtras(db: Queryable, userId: string): Promise<{ city: string | null; photoUrl: string | null; displayName: string | null }> {
    const { rows } = await db.query<{ city: string | null; photoUrl: string | null; displayName: string | null }>(
      `SELECT pr.city, pr.profile_photo AS "photoUrl", pl.display_name AS "displayName"
         FROM usr_user u LEFT JOIN usr_user_profile pr ON pr.user_id = u.id LEFT JOIN players pl ON pl.user_id = u.id
        WHERE u.id = $1`,
      [userId],
    );
    return rows[0] ?? { city: null, photoUrl: null, displayName: null };
  },

  /** Per sport: 1000, then the rating after each of the last rated matches. */
  async findRatingTrends(db: Queryable, userId: string): Promise<RatingTrend[]> {
    const { rows } = await db.query<{ sportId: string; points: number[] }>(
      `SELECT sport_id::text AS "sportId", array_agg(rating_after ORDER BY created_at) AS points
         FROM (SELECT h.sport_id, h.rating_after, h.created_at,
                      row_number() OVER (PARTITION BY h.sport_id ORDER BY h.created_at DESC) AS n
                 FROM player_rating_history h JOIN players p ON p.id = h.player_id
                WHERE p.user_id = $1) t
        WHERE n <= $2
        GROUP BY sport_id`,
      [userId, TREND_POINTS],
    );
    return rows.map((r) => ({ sportId: r.sportId, points: [1000, ...r.points.map((x) => Math.round(x))] }));
  },

  /** Matches per sport slug (not abandoned), for the history filter chips. */
  async countMatchesBySport(db: Queryable, userId: string): Promise<Record<string, number>> {
    const { rows } = await db.query<{ slug: string; count: number }>(
      `SELECT s.slug, count(*)::int AS count
         FROM players p JOIN match_participants mp ON mp.player_id = p.id
         JOIN matches m ON m.id = mp.match_id JOIN sports s ON s.id = m.sport_id
        WHERE p.user_id = $1 AND m.status <> 'abandoned'
        GROUP BY s.slug`,
      [userId],
    );
    return Object.fromEntries(rows.map((r) => [r.slug, r.count]));
  },

  async isUsernameTaken(db: Queryable, username: string, exceptUserId: string): Promise<boolean> {
    const { rows } = await db.query('SELECT 1 FROM usr_user WHERE lower(username) = lower($1) AND id <> $2', [username, exceptUserId]);
    return rows.length > 0;
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

  /** Suspended accounts don't count, matching the follower / following lists. */
  async countFollows(db: Queryable, userId: string): Promise<{ followers: number; following: number }> {
    const { rows } = await db.query<{ followers: number; following: number }>(
      `SELECT count(*) FILTER (WHERE f.following_id = $1)::int AS followers,
              count(*) FILTER (WHERE f.follower_id = $1)::int AS following
         FROM usr_user_follow f
         JOIN usr_user u ON u.id = CASE WHEN f.following_id = $1 THEN f.follower_id ELSE f.following_id END
        WHERE (f.following_id = $1 OR f.follower_id = $1) AND f.status_id = $2 AND u.status = $3`,
      [userId, FollowStatus.ACCEPTED, UserStatus.ACTIVE],
    );
    return rows[0]!;
  },

  /** Creates the profile row if missing (e.g. users created outside the app), then applies the changes. */
  async updateProfile(
    db: Queryable,
    userId: string,
    fallbackName: string,
    changes: {
      fullName?: string | undefined;
      bio?: string | null | undefined;
      city?: string | null | undefined;
      photoUrl?: string | null | undefined;
      displayName?: string | undefined;
      username?: string | undefined;
    },
  ): Promise<void> {
    await db.query(
      'INSERT INTO usr_user_profile (user_id, display_name) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING',
      [userId, fallbackName],
    );
    await db.query(
      `UPDATE usr_user_profile
          SET display_name = coalesce($2, display_name),
              bio = CASE WHEN $3 THEN $4 ELSE bio END,
              city = CASE WHEN $5 THEN $6 ELSE city END,
              profile_photo = CASE WHEN $7 THEN $8 ELSE profile_photo END,
              updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1`,
      [
        userId,
        changes.fullName ?? null,
        changes.bio !== undefined,
        changes.bio ?? null,
        changes.city !== undefined,
        changes.city ?? null,
        changes.photoUrl !== undefined,
        changes.photoUrl ?? null,
      ],
    );
    if (changes.displayName !== undefined) {
      await db.query('UPDATE players SET display_name = $2, updated_at = now() WHERE user_id = $1', [userId, changes.displayName]);
    }
    if (changes.username !== undefined) {
      await db.query('UPDATE usr_user SET username = $2, updated_at = now() WHERE id = $1', [userId, changes.username]);
    }
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
  async findMatchHistory(db: Queryable, userId: string, limit: number, sportSlug?: string): Promise<MatchHistoryItem[]> {
    type Row = Omit<MatchHistoryItem, 'playedAt' | 'headline'> & {
      playedAt: Date;
      headline: string | null;
      sideIndex: number;
      createdByMe: boolean;
      summary: { segments?: Array<{ complete: boolean; scores: number[] }> } | null;
    };
    const { rows } = await db.query<Row>(
      `SELECT m.id AS "matchId", m.context::text AS context, ${SPORT_JSON} AS sport,
              coalesce(m.completed_at, m.started_at, m.created_at) AS "playedAt",
              CASE WHEN m.status = 'disputed' THEN 'disputed'
                   WHEN ms.outcome IS NULL THEN 'in_progress'
                   WHEN ms.outcome = 'drawn' THEN 'draw'
                   ELSE ms.outcome::text END AS outcome,
              m.result_type::text AS "resultType", m.status::text AS status, m.verification::text AS verification,
              f.name AS format,
              coalesce((SELECT array_agg(op.display_name ORDER BY os.side_index, o.sort_order)
                          FROM match_participants o JOIN players op ON op.id = o.player_id JOIN match_sides os ON os.id = o.side_id
                         WHERE o.match_id = m.id AND o.id <> mp.id), '{}') AS "otherPlayers",
              coalesce((SELECT array_agg(op.display_name ORDER BY o.sort_order)
                          FROM match_participants o JOIN players op ON op.id = o.player_id
                         WHERE o.side_id = mp.side_id AND o.id <> mp.id), '{}') AS partners,
              coalesce((SELECT array_agg(op.display_name ORDER BY os.side_index, o.sort_order)
                          FROM match_participants o JOIN players op ON op.id = o.player_id JOIN match_sides os ON os.id = o.side_id
                         WHERE o.match_id = m.id AND o.side_id <> mp.side_id), '{}') AS opponents,
              m.created_by_user_id = $1 AS "createdByMe",
              (SELECT op.display_name FROM match_participants o JOIN players op ON op.id = o.player_id
                WHERE o.match_id = m.id AND o.side_id <> mp.side_id AND op.user_id IS NOT NULL
                ORDER BY o.sort_order LIMIT 1) AS awaiting,
              CASE WHEN fx.id IS NULL THEN NULL
                   ELSE json_build_object('name', t.name, 'eventName', te.name, 'roundName', fx.round_name) END AS tournament,
              m.summary->>'headline' AS headline, ms.side_index AS "sideIndex", m.summary AS summary,
              (SELECT h.rating_after - h.rating_before FROM player_rating_history h WHERE h.match_id = m.id AND h.player_id = p.id) AS "ratingChange"
         FROM players p
         JOIN match_participants mp ON mp.player_id = p.id
         JOIN match_sides ms ON ms.id = mp.side_id
         JOIN matches m ON m.id = mp.match_id
         JOIN sports s ON s.id = m.sport_id
         LEFT JOIN sport_formats f ON f.id = m.sport_format_id
         LEFT JOIN fixtures fx ON fx.match_id = m.id
         LEFT JOIN tournament_stages st ON st.id = fx.stage_id
         LEFT JOIN tournament_events te ON te.id = st.event_id
         LEFT JOIN tournaments t ON t.id = te.tournament_id
        WHERE p.user_id = $1 AND m.status <> 'abandoned' AND ($3::text IS NULL OR s.slug = $3)
        ORDER BY "playedAt" DESC
        LIMIT $2`,
      [userId, limit, sportSlug ?? null],
    );
    return rows.map(({ summary, sideIndex, createdByMe, awaiting, ...row }) => {
      // The score line from the user's side: "21-15, 18-21" reads "my points first".
      const segments = (summary?.segments ?? []).filter((g) => g.complete || g.scores.some((n) => n > 0));
      const own = segments.length ? segments.map((g) => `${g.scores[sideIndex]}-${g.scores[1 - sideIndex]}`).join(', ') : row.headline;
      const waiting = row.verification === 'pending' ? (createdByMe ? awaiting : 'you') : null;
      return { ...row, awaiting: waiting, headline: own, playedAt: row.playedAt.toISOString() };
    });
  },
};

export type ProfileRepository = typeof profileRepository;
