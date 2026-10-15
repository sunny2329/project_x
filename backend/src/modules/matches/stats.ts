import type { DbTx } from '../../database/prisma.js';

/** Match statuses whose result counts in records and standings. */
export const COUNTED_STATUSES = ['completed', 'retired', 'walkover'] as const;

/*
 * Records are projections of decided matches, rebuilt (not incremented) so that a disputed,
 * corrected or merged result can never leave them wrong. Major/minor come from the stored
 * ScoreSummary totals (games/points for badminton, sets/games for tennis).
 */

const SIDE_TOTALS = `
  coalesce((m.summary->'totals'->'major'->>ms.side_index)::int, 0) AS major_for,
  coalesce((SELECT sum(x::int) FROM jsonb_array_elements_text(m.summary->'totals'->'major') x), 0)
    - coalesce((m.summary->'totals'->'major'->>ms.side_index)::int, 0) AS major_against,
  coalesce((m.summary->'totals'->'minor'->>ms.side_index)::int, 0) AS minor_for,
  coalesce((SELECT sum(x::int) FROM jsonb_array_elements_text(m.summary->'totals'->'minor') x), 0)
    - coalesce((m.summary->'totals'->'minor'->>ms.side_index)::int, 0) AS minor_against`;

export async function rebuildPlayerStats(db: DbTx, playerIds: string[], sportId: number): Promise<void> {
  if (!playerIds.length) return;
  await db.playerSportStats.deleteMany({ where: { playerId: { in: playerIds }, sportId } });
  await db.$executeRawUnsafe(
    `INSERT INTO player_sport_stats (player_id, sport_id, matches_played, won, lost, drawn, major_won, major_lost, minor_won, minor_lost, updated_at)
     SELECT player_id, $2, count(*), count(*) FILTER (WHERE outcome = 'won'), count(*) FILTER (WHERE outcome = 'lost'),
            count(*) FILTER (WHERE outcome = 'drawn'), sum(major_for), sum(major_against), sum(minor_for), sum(minor_against), now()
       FROM (SELECT mp.player_id, ms.outcome, ${SIDE_TOTALS}
               FROM match_participants mp
               JOIN match_sides ms ON ms.id = mp.side_id
               JOIN matches m ON m.id = mp.match_id
              WHERE mp.player_id = ANY($1::uuid[]) AND m.sport_id = $2
                AND m.status::text = ANY($3::text[]) AND ms.outcome IS NOT NULL) t
      GROUP BY player_id`,
    playerIds,
    sportId,
    [...COUNTED_STATUSES],
  );
}

export async function rebuildTeamStats(db: DbTx, teamIds: string[]): Promise<void> {
  if (!teamIds.length) return;
  await db.teamStats.deleteMany({ where: { teamId: { in: teamIds } } });
  await db.$executeRawUnsafe(
    `INSERT INTO team_stats (team_id, matches_played, won, lost, drawn, major_won, major_lost, minor_won, minor_lost, updated_at)
     SELECT team_id, count(*), count(*) FILTER (WHERE outcome = 'won'), count(*) FILTER (WHERE outcome = 'lost'),
            count(*) FILTER (WHERE outcome = 'drawn'), sum(major_for), sum(major_against), sum(minor_for), sum(minor_against), now()
       FROM (SELECT ms.team_id, ms.outcome, ${SIDE_TOTALS}
               FROM match_sides ms JOIN matches m ON m.id = ms.match_id
              WHERE ms.team_id = ANY($1::uuid[]) AND m.status::text = ANY($2::text[]) AND ms.outcome IS NOT NULL) t
      GROUP BY team_id`,
    teamIds,
    [...COUNTED_STATUSES],
  );
}
