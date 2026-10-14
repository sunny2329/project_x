import type { Queryable } from '../../database/pool.js';
import { UserStatus } from '../auth/auth.types.js';
import { FollowStatus } from '../profile/profile.types.js';
import { CorrectionType, MatchStatus, MatchType, PeriodStatus, PostType } from './match.codes.js';
import type { MatchCard, MatchSide, SportRef } from './match.types.js';
import type { PeriodScore, ScoreView, ScoringConfig, Side } from './scoring/types.js';

/** A sport + format + its `mst_sport_scoring` rules. */
export interface SetupRow {
  sport: SportRef;
  formatId: string;
  formatName: string;
  minPlayers: number;
  maxPlayers: number;
  scoringId: string;
  config: ScoringConfig;
}

export interface MatchRow {
  id: string;
  sport: SportRef;
  format: { id: string; name: string };
  createdBy: string;
  statusId: number;
  startedAt: Date;
  completedAt: Date | null;
  /** The rules this match is played under (defaults + options picked at the start). */
  config: ScoringConfig;
}

export interface EventRow {
  id: string;
  sequenceNo: number;
  typeId: number;
  /** Team number of the side the event belongs to, when it has one. */
  side: Side | null;
  data: Record<string, unknown> | null;
  isUndone: boolean;
}

export interface PlayerRow {
  id: string;
  username: string;
  fullName: string;
}

export interface NewMatch {
  createdBy: string;
  sportId: string;
  formatId: string;
  scoringId: string;
  config: ScoringConfig;
  sides: Array<{ name: string; playerIds: string[] }>;
}

export interface PlayerResult {
  matchId: string;
  sportId: string;
  participantId: string;
  userId: string;
  won: boolean;
  lost: boolean;
  pointsFor: number;
  pointsAgainst: number;
  ratingAfter: number;
  statData: Record<string, unknown>;
}

const SETUP_SELECT = `
  SELECT json_build_object('id', s.id::text, 'code', s.code, 'name', s.name) AS sport,
         f.id::text AS "formatId", f.name AS "formatName",
         coalesce(f.min_players, 1)::int AS "minPlayers", coalesce(f.max_players, 1)::int AS "maxPlayers",
         sc.id::text AS "scoringId", sc.scoring_config AS config
    FROM mst_sport s
    JOIN mst_sport_format f ON f.sport_id = s.id
    JOIN mst_sport_scoring sc ON sc.sport_id = s.id AND sc.format_id = f.id`;

/** The match-level `match_score_state` row (no team, period or participant) holds the rules and the latest scoreboard. */
const MATCH_STATE_ROW = 'st.team_id IS NULL AND st.participant_id IS NULL AND st.period_id IS NULL';

const SIDES_JSON = `(SELECT json_agg(json_build_object('no', t.team_no, 'name', t.team_name) ORDER BY t.team_no)
                       FROM match_team t WHERE t.match_id = m.id) AS sides`;

function statusName(statusId: number): MatchCard['status'] {
  if (statusId === MatchStatus.COMPLETED) return 'completed';
  if (statusId === MatchStatus.ABANDONED) return 'abandoned';
  return 'live';
}

export const matchRepository = {
  statusName,

  async listSetup(db: Queryable): Promise<SetupRow[]> {
    const { rows } = await db.query<SetupRow>(`${SETUP_SELECT} ORDER BY s.id, f.format_type_id`);
    return rows;
  },

  async findSetup(db: Queryable, sportId: string, formatId: string): Promise<SetupRow | null> {
    const { rows } = await db.query<SetupRow>(`${SETUP_SELECT} WHERE s.id = $1 AND f.id = $2`, [sportId, formatId]);
    return rows[0] ?? null;
  },

  async findActivePlayers(db: Queryable, userIds: string[]): Promise<PlayerRow[]> {
    const { rows } = await db.query<PlayerRow>(
      `SELECT u.id, u.username, coalesce(p.display_name, u.username) AS "fullName"
         FROM usr_user u LEFT JOIN usr_user_profile p ON p.user_id = u.id
        WHERE u.id = ANY($1::uuid[]) AND u.status = $2`,
      [userIds, UserStatus.ACTIVE],
    );
    return rows;
  },

  /** Match, sides (teams), players, the rules/scoreboard state rows and game/half/innings 1. */
  async createMatch(db: Queryable, match: NewMatch, periodTypeId: number, initialScore: ScoreView): Promise<string> {
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO match_master (sport_id, format_id, scoring_id, created_by, match_type_id, status_id, started_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP) RETURNING id`,
      [match.sportId, match.formatId, match.scoringId, match.createdBy, MatchType.FRIENDLY, MatchStatus.LIVE],
    );
    const matchId = rows[0]!.id;
    await db.query('INSERT INTO match_score_state (match_id, state_data) VALUES ($1, $2)', [
      matchId,
      { config: match.config, snapshot: initialScore },
    ]);

    let participantNo = 0;
    for (const [index, side] of match.sides.entries()) {
      const team = await db.query<{ id: string }>('INSERT INTO match_team (match_id, team_no, team_name) VALUES ($1, $2, $3) RETURNING id', [
        matchId,
        index + 1,
        side.name,
      ]);
      const teamId = team.rows[0]!.id;
      await db.query('INSERT INTO match_score_state (match_id, team_id, score_value) VALUES ($1, $2, 0)', [matchId, teamId]);
      for (const [memberIndex, userId] of side.playerIds.entries()) {
        participantNo += 1;
        const participant = await db.query<{ id: string }>(
          'INSERT INTO match_participant (match_id, user_id, participant_no) VALUES ($1, $2, $3) RETURNING id',
          [matchId, userId, participantNo],
        );
        await db.query('INSERT INTO match_team_member (team_id, participant_id, member_no) VALUES ($1, $2, $3)', [
          teamId,
          participant.rows[0]!.id,
          memberIndex + 1,
        ]);
      }
    }
    await this.syncPeriods(db, matchId, periodTypeId, initialScore.periods);
    return matchId;
  },

  /** With `lock`, holds the match row until the transaction ends so scoring requests run one at a time. */
  async findMatch(db: Queryable, matchId: string, lock = false): Promise<MatchRow | null> {
    const { rows } = await db.query<MatchRow>(
      `SELECT m.id, json_build_object('id', s.id::text, 'code', s.code, 'name', s.name) AS sport,
              json_build_object('id', f.id::text, 'name', coalesce(f.name, '')) AS format,
              m.created_by AS "createdBy", m.status_id::int AS "statusId",
              coalesce(m.started_at, m.created_at) AS "startedAt", m.completed_at AS "completedAt",
              st.state_data -> 'config' AS config
         FROM match_master m
         JOIN mst_sport s ON s.id = m.sport_id
         LEFT JOIN mst_sport_format f ON f.id = m.format_id
         JOIN match_score_state st ON st.match_id = m.id AND ${MATCH_STATE_ROW}
        WHERE m.id = $1
        ${lock ? 'FOR UPDATE OF m' : ''}`,
      [matchId],
    );
    return rows[0] ?? null;
  },

  async findSides(db: Queryable, matchId: string): Promise<MatchSide[]> {
    const { rows } = await db.query<MatchSide>(
      `SELECT t.team_no AS no, t.id AS "teamId", coalesce(t.team_name, 'Side ' || t.team_no) AS name,
              coalesce(json_agg(json_build_object('participantId', p.id, 'userId', u.id, 'username', u.username,
                                                  'fullName', coalesce(pr.display_name, u.username))
                                ORDER BY tm.member_no) FILTER (WHERE p.id IS NOT NULL), '[]') AS players
         FROM match_team t
         LEFT JOIN match_team_member tm ON tm.team_id = t.id
         LEFT JOIN match_participant p ON p.id = tm.participant_id
         LEFT JOIN usr_user u ON u.id = p.user_id
         LEFT JOIN usr_user_profile pr ON pr.user_id = u.id
        WHERE t.match_id = $1
        GROUP BY t.id
        ORDER BY t.team_no`,
      [matchId],
    );
    return rows;
  },

  async findEvents(db: Queryable, matchId: string): Promise<EventRow[]> {
    const { rows } = await db.query<EventRow>(
      `SELECT e.id, e.sequence_no AS "sequenceNo", e.event_type_id::int AS "typeId", t.team_no AS side,
              e.event_data AS data, e.is_undone AS "isUndone"
         FROM match_score_event e
         LEFT JOIN match_team t ON t.id = e.team_id
        WHERE e.match_id = $1
        ORDER BY e.sequence_no`,
      [matchId],
    );
    return rows;
  },

  async findPeriodIds(db: Queryable, matchId: string): Promise<Map<number, string>> {
    const { rows } = await db.query<{ no: number; id: string }>('SELECT period_no AS no, id FROM match_period WHERE match_id = $1', [matchId]);
    return new Map(rows.map((row) => [row.no, row.id]));
  },

  /** Period number -> when it started (ISO), for every period that is not void. */
  async findPeriodStarts(db: Queryable, matchId: string): Promise<Record<string, string>> {
    const { rows } = await db.query<{ no: number; startedAt: Date }>(
      `SELECT period_no AS no, started_at AS "startedAt" FROM match_period
        WHERE match_id = $1 AND started_at IS NOT NULL AND status_id <> $2`,
      [matchId, PeriodStatus.VOID],
    );
    return Object.fromEntries(rows.map((row) => [String(row.no), row.startedAt.toISOString()]));
  },

  async insertEvent(
    db: Queryable,
    event: {
      matchId: string;
      periodId: string | null;
      teamId: string | null;
      typeId: number;
      sequenceNo: number;
      scoreValue: number;
      data: Record<string, unknown> | null;
      createdBy: string;
    },
  ): Promise<string> {
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO match_score_event (match_id, period_id, team_id, event_type_id, sequence_no, score_value, event_data, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [event.matchId, event.periodId, event.teamId, event.typeId, event.sequenceNo, event.scoreValue, event.data, event.createdBy],
    );
    return rows[0]!.id;
  },

  /** Undo: flags the event and records who undid it. */
  async undoEvent(db: Queryable, matchId: string, eventId: string, userId: string): Promise<void> {
    await db.query('UPDATE match_score_event SET is_undone = true WHERE id = $1', [eventId]);
    await db.query(
      'INSERT INTO match_correction (match_id, score_event_id, correction_type_id, reason, corrected_by) VALUES ($1, $2, $3, $4, $5)',
      [matchId, eventId, CorrectionType.UNDO, 'Undo', userId],
    );
  },

  /**
   * Makes `match_period` match the scoreboard: one row per game/half/innings reached, completed
   * or live. Periods an undo took back (their events stay, as undone) are marked void.
   */
  async syncPeriods(db: Queryable, matchId: string, periodTypeId: number, periods: PeriodScore[]): Promise<void> {
    await db.query(
      `INSERT INTO match_period (match_id, period_no, period_type_id, status_id, started_at, completed_at)
       SELECT $1, p.no, $2, CASE WHEN p.finished THEN $3::bigint ELSE $4::bigint END, CURRENT_TIMESTAMP,
              CASE WHEN p.finished THEN CURRENT_TIMESTAMP END
         FROM jsonb_to_recordset($5::jsonb) AS p(no int, finished boolean)
       ON CONFLICT (match_id, period_no) DO UPDATE SET
         status_id = EXCLUDED.status_id,
         started_at = CASE WHEN match_period.status_id = $6 THEN EXCLUDED.started_at ELSE match_period.started_at END,
         completed_at = CASE WHEN EXCLUDED.completed_at IS NULL THEN NULL
                             ELSE coalesce(match_period.completed_at, EXCLUDED.completed_at) END,
         updated_at = CURRENT_TIMESTAMP
       WHERE match_period.status_id IS DISTINCT FROM EXCLUDED.status_id`,
      [
        matchId,
        periodTypeId,
        PeriodStatus.COMPLETED,
        PeriodStatus.LIVE,
        JSON.stringify(periods.map((p) => ({ no: p.no, finished: p.finished }))),
        PeriodStatus.VOID,
      ],
    );
    await db.query(
      `UPDATE match_period SET status_id = $3, completed_at = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE match_id = $1 AND period_no > $2 AND status_id <> $3`,
      [matchId, periods.length, PeriodStatus.VOID],
    );
  },

  /** Caches the scoreboard: headline number per side, and the full view on the match-level row. */
  async saveScore(db: Queryable, matchId: string, sides: MatchSide[], score: ScoreView, lastEventId: string | null): Promise<void> {
    for (const side of sides) {
      await db.query(
        `UPDATE match_score_state
            SET score_value = $3, state_data = $4, last_event_id = $5, updated_at = CURRENT_TIMESTAMP
          WHERE match_id = $1 AND team_id = $2`,
        [matchId, side.teamId, score.headline[side.no - 1], { periodScore: score.currentPeriod.score[side.no - 1] }, lastEventId],
      );
    }
    await db.query(
      `UPDATE match_score_state st
          SET state_data = jsonb_set(st.state_data, '{snapshot}', $2::jsonb), last_event_id = $3, updated_at = CURRENT_TIMESTAMP
        WHERE st.match_id = $1 AND ${MATCH_STATE_ROW}`,
      [matchId, JSON.stringify(score), lastEventId],
    );
    await db.query('UPDATE match_master SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [matchId]);
  },

  async setStatus(db: Queryable, matchId: string, statusId: number): Promise<void> {
    await db.query(
      `UPDATE match_master
          SET status_id = $2::bigint, updated_at = CURRENT_TIMESTAMP,
              completed_at = CASE WHEN $2::bigint = $3::bigint THEN CURRENT_TIMESTAMP ELSE completed_at END
        WHERE id = $1`,
      [matchId, statusId, MatchStatus.COMPLETED],
    );
  },

  /** Current ratings, locked so two results for the same player can't overwrite each other. */
  async lockRatings(db: Queryable, sportId: string, userIds: string[]): Promise<Map<string, number>> {
    await db.query(
      `INSERT INTO usr_sport_rating (user_id, sport_id) SELECT unnest($1::uuid[]), $2
       ON CONFLICT (user_id, sport_id) DO NOTHING`,
      [userIds, sportId],
    );
    const { rows } = await db.query<{ userId: string; rating: number }>(
      `SELECT user_id AS "userId", rating::float8 AS rating FROM usr_sport_rating
        WHERE sport_id = $1 AND user_id = ANY($2::uuid[])
        ORDER BY user_id
        FOR UPDATE`,
      [sportId, userIds],
    );
    return new Map(rows.map((row) => [row.userId, row.rating]));
  },

  async insertResult(
    db: Queryable,
    result: { matchId: string; winnerTeamId: string | null; winnerParticipantId: string | null; resultTypeId: number; data: unknown },
  ): Promise<void> {
    await db.query(
      `INSERT INTO match_result (match_id, winner_participant_id, winner_team_id, result_type_id, result_data)
       VALUES ($1, $2, $3, $4, $5)`,
      [result.matchId, result.winnerParticipantId, result.winnerTeamId, result.resultTypeId, JSON.stringify(result.data)],
    );
  },

  /** Snapshot, history, lifetime stats and rating for one player; also adds the sport to their list. */
  async recordPlayerResult(db: Queryable, r: PlayerResult): Promise<void> {
    await db.query('INSERT INTO match_stat_snapshot (match_id, participant_id, sport_id, stat_data) VALUES ($1, $2, $3, $4)', [
      r.matchId,
      r.participantId,
      r.sportId,
      r.statData,
    ]);
    await db.query('INSERT INTO usr_sport_stat_history (user_id, sport_id, match_id, stat_data) VALUES ($1, $2, $3, $4)', [
      r.userId,
      r.sportId,
      r.matchId,
      r.statData,
    ]);
    await db.query(
      `INSERT INTO usr_sport_stats (user_id, sport_id, matches_played, matches_won, matches_lost, points_scored, points_conceded)
       VALUES ($1, $2, 1, $3, $4, $5, $6)
       ON CONFLICT (user_id, sport_id) DO UPDATE SET
         matches_played = usr_sport_stats.matches_played + 1,
         matches_won = usr_sport_stats.matches_won + EXCLUDED.matches_won,
         matches_lost = usr_sport_stats.matches_lost + EXCLUDED.matches_lost,
         points_scored = usr_sport_stats.points_scored + EXCLUDED.points_scored,
         points_conceded = usr_sport_stats.points_conceded + EXCLUDED.points_conceded,
         updated_at = CURRENT_TIMESTAMP`,
      [r.userId, r.sportId, r.won ? 1 : 0, r.lost ? 1 : 0, r.pointsFor, r.pointsAgainst],
    );
    await db.query(
      `UPDATE usr_sport_rating
          SET rating = $3, matches_played = matches_played + 1, matches_won = matches_won + $4,
              matches_lost = matches_lost + $5, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND sport_id = $2`,
      [r.userId, r.sportId, r.ratingAfter, r.won ? 1 : 0, r.lost ? 1 : 0],
    );
    await db.query(
      `INSERT INTO usr_user_sport (user_id, sport_id, is_primary)
       VALUES ($1, $2, NOT EXISTS (SELECT 1 FROM usr_user_sport WHERE user_id = $1))
       ON CONFLICT (user_id, sport_id) DO NOTHING`,
      [r.userId, r.sportId],
    );
  },

  async insertResultPost(db: Queryable, post: { userId: string; matchId: string; content: string }): Promise<void> {
    await db.query(
      `INSERT INTO social_post (user_id, post_type_id, match_id, content) VALUES ($1, $2, $3, $4)
       ON CONFLICT (match_id) DO NOTHING`,
      [post.userId, PostType.MATCH_RESULT, post.matchId, post.content],
    );
  },

  async findRatingChanges(db: Queryable, matchId: string): Promise<Array<{ userId: string; before: number; after: number }>> {
    const { rows } = await db.query<{ userId: string; before: number; after: number }>(
      `SELECT user_id AS "userId", (stat_data ->> 'ratingBefore')::float8 AS before, (stat_data ->> 'ratingAfter')::float8 AS after
         FROM usr_sport_stat_history WHERE match_id = $1 AND stat_data ? 'ratingAfter'`,
      [matchId],
    );
    return rows;
  },

  /**
   * Live matches the user created or plays in, plus (recently active) live matches of players they
   * follow, excluding blocked users. Most recently updated first.
   */
  async findLiveMatches(db: Queryable, userId: string, limit: number): Promise<MatchCard[]> {
    const { rows } = await db.query<Omit<MatchCard, 'status' | 'startedAt' | 'updatedAt'> & { startedAt: Date; updatedAt: Date }>(
      `WITH following AS (
         SELECT following_id AS id FROM usr_user_follow WHERE follower_id = $1 AND status_id = $2
       )
       SELECT m.id, json_build_object('id', s.id::text, 'code', s.code, 'name', s.name) AS sport,
              ${SIDES_JSON}, st.state_data -> 'snapshot' AS score, m.created_by = $1 AS mine,
              coalesce(m.started_at, m.created_at) AS "startedAt", m.updated_at AS "updatedAt"
         FROM match_master m
         JOIN mst_sport s ON s.id = m.sport_id
         JOIN match_score_state st ON st.match_id = m.id AND ${MATCH_STATE_ROW}
        WHERE m.status_id = $3
          AND (m.created_by = $1
               OR EXISTS (SELECT 1 FROM match_participant p WHERE p.match_id = m.id AND p.user_id = $1)
               OR (m.updated_at > (now() AT TIME ZONE 'UTC') - interval '3 hours'
                   AND (m.created_by IN (SELECT id FROM following)
                        OR EXISTS (SELECT 1 FROM match_participant p WHERE p.match_id = m.id AND p.user_id IN (SELECT id FROM following)))))
          AND NOT EXISTS (SELECT 1 FROM usr_user_block b
                           WHERE (b.blocker_id = $1 AND b.blocked_id = m.created_by)
                              OR (b.blocker_id = m.created_by AND b.blocked_id = $1))
        ORDER BY m.updated_at DESC
        LIMIT $4`,
      [userId, FollowStatus.ACCEPTED, MatchStatus.LIVE, limit],
    );
    return rows.map((row) => ({
      ...row,
      status: 'live',
      startedAt: row.startedAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  },
};

export type MatchRepository = typeof matchRepository;
