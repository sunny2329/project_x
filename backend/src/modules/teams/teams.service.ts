import type { Db, DbTx } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import type { ParticipantInput, PlayersService } from '../players/players.service.js';

/*
 * Saved teams: a named group of players in one sport (a doubles pair, a 5-a-side squad). A person
 * can be in any number of teams, in any sports, including several in the same sport.
 *
 * Membership is `team_members` (one row per team and player). Leaving sets `left_at` so the row
 * stays as history; adding the player again reopens it. Captains manage the team; only registered
 * players can be captains. When no registered member is left the team is deleted (its matches
 * keep their side names: match_sides.team_id is ON DELETE SET NULL).
 */

export const MAX_TEAM_MEMBERS = 30;
export type TeamRole = 'captain' | 'player';

export interface TeamSport {
  id: string;
  slug: string;
  name: string;
  iconKey: string;
  accentColor: string;
}

export interface TeamRecord {
  played: number;
  won: number;
  lost: number;
  drawn: number;
}

export interface TeamMemberView {
  playerId: string;
  userId: string | null;
  username: string | null;
  displayName: string;
  photoUrl: string | null;
  isGuest: boolean;
  role: TeamRole;
  joinedAt: string;
}

export interface TeamSummary {
  id: string;
  name: string;
  sport: TeamSport;
  memberCount: number;
  /** The viewer's role, or null when the viewer isn't in the team. */
  myRole: TeamRole | null;
  record: TeamRecord;
  /** Up to four members, captains first, for the avatar stack. */
  preview: Array<{ displayName: string; userId: string | null; photoUrl: string | null }>;
}

export interface TeamMatch {
  matchId: string;
  playedAt: string;
  outcome: 'won' | 'lost' | 'drawn' | null;
  opponent: string;
  headline: string | null;
}

export interface TeamDetail extends TeamSummary {
  createdAt: string;
  members: TeamMemberView[];
  canManage: boolean;
  recentMatches: TeamMatch[];
}

const DECIDED = ['completed', 'retired', 'walkover'];

const notFound = () => AppError.notFound('TEAM_NOT_FOUND', 'This team does not exist.');
const captainsOnly = () => AppError.forbidden('NOT_TEAM_CAPTAIN', 'Only a captain can change this team.');
const invalid = (field: string, message: string) => AppError.badRequest('VALIDATION_ERROR', 'Some fields are invalid.', { [field]: [message] });

/** For a match side or tournament entry: each team must exist and play `sportId`. */
export async function assertTeamsUsable(db: DbTx, teamIds: Array<string | null | undefined>, sportId: number): Promise<void> {
  for (const teamId of teamIds) {
    if (!teamId) continue;
    const team = await db.team.findUnique({ where: { id: teamId }, select: { sportId: true } });
    if (!team) throw invalid('teamId', 'That team no longer exists');
    if (team.sportId !== sportId) throw invalid('teamId', 'That team plays a different sport');
  }
}

const roleOf = (role: string | null): TeamRole => (role === 'captain' ? 'captain' : 'player');

interface SummaryRow {
  id: string;
  name: string;
  sport: TeamSport;
  memberCount: number;
  myRole: string | null;
  played: number;
  won: number;
  lost: number;
  drawn: number;
  preview: TeamSummary['preview'] | null;
  createdAt: Date;
}

const toSummary = (r: SummaryRow): TeamSummary => ({
  id: r.id,
  name: r.name,
  sport: r.sport,
  memberCount: r.memberCount,
  myRole: r.myRole === null ? null : roleOf(r.myRole),
  record: { played: r.played, won: r.won, lost: r.lost, drawn: r.drawn },
  preview: r.preview ?? [],
});

export class TeamsService {
  constructor(
    private readonly db: Db,
    private readonly players: PlayersService,
  ) {}

  /**
   * Teams `userId` is in now (all sports unless `sportSlug`), by name. `viewerId` only decides
   * `myRole`. Nobody blocked either way sees the other's teams.
   */
  async listFor(viewerId: string, userId: string, sportSlug?: string): Promise<TeamSummary[]> {
    if (viewerId !== userId && (await this.blocked(this.db, viewerId, userId))) return [];
    const rows = await this.summaries(
      this.db,
      viewerId,
      `EXISTS (SELECT 1 FROM team_members m JOIN players p ON p.id = m.player_id
                WHERE m.team_id = t.id AND m.left_at IS NULL AND p.user_id = $2::uuid)
       AND ($3::text IS NULL OR s.slug = $3::text)`,
      [userId, sportSlug ?? null],
    );
    return rows.map(toSummary);
  }

  async get(viewerId: string, teamId: string, db: DbTx = this.db): Promise<TeamDetail> {
    const [row] = await this.summaries(db, viewerId, 't.id = $2::uuid', [teamId]);
    if (!row) throw notFound();
    const members = await db.$queryRawUnsafe<Array<Omit<TeamMemberView, 'joinedAt' | 'role' | 'isGuest'> & { role: string | null; joinedAt: Date }>>(
      `SELECT p.id AS "playerId", p.user_id AS "userId", u.username, coalesce(pr.display_name, p.display_name) AS "displayName",
              pr.profile_photo AS "photoUrl", m.role, m.joined_at AS "joinedAt"
         FROM team_members m
         JOIN players p ON p.id = m.player_id
         LEFT JOIN usr_user u ON u.id = p.user_id
         LEFT JOIN usr_user_profile pr ON pr.user_id = p.user_id
        WHERE m.team_id = $1::uuid AND m.left_at IS NULL
        ORDER BY m.role = 'captain' DESC NULLS LAST, m.joined_at, p.display_name`,
      teamId,
    );
    const recentMatches = await db.$queryRawUnsafe<Array<Omit<TeamMatch, 'playedAt'> & { playedAt: Date }>>(
      `SELECT m.id AS "matchId", coalesce(m.completed_at, m.created_at) AS "playedAt", ms.outcome::text AS outcome,
              coalesce(os.name, (SELECT string_agg(op.display_name, ' & ' ORDER BY o.sort_order)
                                   FROM match_participants o JOIN players op ON op.id = o.player_id WHERE o.side_id = os.id), 'Opponent') AS opponent,
              m.summary->>'headline' AS headline
         FROM match_sides ms
         JOIN matches m ON m.id = ms.match_id
         LEFT JOIN match_sides os ON os.match_id = ms.match_id AND os.id <> ms.id
        WHERE ms.team_id = $1::uuid AND m.status::text = ANY($2::text[])
        ORDER BY "playedAt" DESC
        LIMIT 10`,
      teamId,
      DECIDED,
    );
    return {
      ...toSummary(row),
      createdAt: row.createdAt.toISOString(),
      canManage: row.myRole === 'captain',
      members: members.map((m) => ({ ...m, role: roleOf(m.role), isGuest: m.userId === null, joinedAt: m.joinedAt.toISOString() })),
      recentMatches: recentMatches.map((m) => ({ ...m, playedAt: m.playedAt.toISOString() })),
    };
  }

  /** Creates a team with the creator as captain, plus any `members` (other players or guests). */
  async create(userId: string, input: { sport: string; name: string; members?: ParticipantInput[] }): Promise<TeamDetail> {
    return this.tx(async (tx) => {
      const sport = await tx.sport.findUnique({ where: { slug: input.sport }, select: { id: true, isActive: true } });
      if (!sport?.isActive) throw invalid('sport', 'Pick a sport');
      const me = await this.players.ensureForUser(userId, tx);
      const team = await tx.team.create({ data: { sportId: sport.id, name: input.name, createdByUserId: userId } });
      await tx.teamMember.create({ data: { teamId: team.id, playerId: me.playerId, role: 'captain' } });
      if (input.members?.length) await this.addResolved(tx, userId, team.id, input.members);
      return this.get(userId, team.id, tx);
    });
  }

  async rename(userId: string, teamId: string, name: string): Promise<TeamDetail> {
    return this.tx(async (tx) => {
      await this.requireCaptain(tx, userId, teamId);
      await tx.team.update({ where: { id: teamId }, data: { name } });
      return this.get(userId, teamId, tx);
    });
  }

  async remove(userId: string, teamId: string): Promise<void> {
    await this.tx(async (tx) => {
      await this.requireCaptain(tx, userId, teamId);
      await tx.team.delete({ where: { id: teamId } });
    });
  }

  /** Adds players (existing, registered users or new guests). Players already in the team are skipped. */
  async addMembers(userId: string, teamId: string, members: ParticipantInput[]): Promise<TeamDetail> {
    return this.tx(async (tx) => {
      await this.requireCaptain(tx, userId, teamId);
      await this.addResolved(tx, userId, teamId, members);
      return this.get(userId, teamId, tx);
    });
  }

  /**
   * A captain removing someone, or anyone leaving (`playerId` is their own). A leaving last
   * captain hands over to the longest-standing registered member; with none left the team is
   * deleted. Returns null when the team no longer exists.
   */
  async removeMember(userId: string, teamId: string, playerId: string): Promise<TeamDetail | null> {
    return this.tx(async (tx) => {
      const me = await this.players.ensureForUser(userId, tx);
      const mine = await this.membership(tx, teamId, me.playerId);
      if (!mine) {
        if (!(await tx.team.findUnique({ where: { id: teamId }, select: { id: true } }))) throw notFound();
        throw captainsOnly();
      }
      if (playerId !== me.playerId && mine.role !== 'captain') throw captainsOnly();
      const target = await this.membership(tx, teamId, playerId);
      if (!target) throw AppError.notFound('MEMBER_NOT_FOUND', 'This player is not in the team.');

      await tx.teamMember.update({ where: { teamId_playerId: { teamId, playerId } }, data: { leftAt: new Date(), role: 'player' } });
      if (roleOf(target.role) === 'captain') await this.ensureCaptain(tx, teamId);
      if (!(await this.hasRegisteredMember(tx, teamId))) {
        await tx.team.delete({ where: { id: teamId } });
        return null;
      }
      return playerId === me.playerId ? null : this.get(userId, teamId, tx);
    });
  }

  /** Makes a registered member a captain, or a captain a player again (never the last captain). */
  async setRole(userId: string, teamId: string, playerId: string, role: TeamRole): Promise<TeamDetail> {
    return this.tx(async (tx) => {
      await this.requireCaptain(tx, userId, teamId);
      const target = await this.membership(tx, teamId, playerId);
      if (!target) throw AppError.notFound('MEMBER_NOT_FOUND', 'This player is not in the team.');
      if (role === 'captain') {
        const player = await tx.player.findUniqueOrThrow({ where: { id: playerId }, select: { userId: true } });
        if (!player.userId) throw invalid('role', 'Guests can’t be captains. They can once they sign up.');
      } else if (roleOf(target.role) === 'captain') {
        const captains = await tx.teamMember.count({ where: { teamId, leftAt: null, role: 'captain' } });
        if (captains <= 1) throw AppError.conflict('LAST_CAPTAIN', 'A team needs a captain. Make someone else captain first.');
      }
      await tx.teamMember.update({ where: { teamId_playerId: { teamId, playerId } }, data: { role } });
      return this.get(userId, teamId, tx);
    });
  }

  private async addResolved(tx: DbTx, userId: string, teamId: string, members: ParticipantInput[]): Promise<void> {
    const resolved = await this.players.resolve(userId, members, tx);
    for (const p of resolved) {
      if (p.userId && p.userId !== userId && (await this.blocked(tx, userId, p.userId))) throw invalid('members', 'Some players could not be found');
    }
    const now = new Date();
    for (const p of resolved) {
      const existing = await this.row(tx, teamId, p.playerId);
      if (existing && existing.leftAt === null) continue;
      if (existing) await tx.teamMember.update({ where: { teamId_playerId: { teamId, playerId: p.playerId } }, data: { leftAt: null, joinedAt: now, role: 'player' } });
      else await tx.teamMember.create({ data: { teamId, playerId: p.playerId, role: 'player' } });
    }
    const count = await tx.teamMember.count({ where: { teamId, leftAt: null } });
    if (count > MAX_TEAM_MEMBERS) throw invalid('members', `A team can have up to ${MAX_TEAM_MEMBERS} players`);
    await tx.team.update({ where: { id: teamId }, data: { updatedAt: now } });
  }

  private async requireCaptain(tx: DbTx, userId: string, teamId: string): Promise<void> {
    const team = await tx.team.findUnique({ where: { id: teamId }, select: { id: true } });
    if (!team) throw notFound();
    const player = await tx.player.findUnique({ where: { userId }, select: { id: true } });
    const mine = player ? await this.membership(tx, teamId, player.id) : null;
    if (roleOf(mine?.role ?? null) !== 'captain' || !mine) throw captainsOnly();
  }

  /** With no captain left, the registered member who joined first becomes one. */
  private async ensureCaptain(tx: DbTx, teamId: string): Promise<void> {
    if (await tx.teamMember.count({ where: { teamId, leftAt: null, role: 'captain' } })) return;
    const next = await tx.teamMember.findFirst({
      where: { teamId, leftAt: null, player: { userId: { not: null } } },
      orderBy: [{ joinedAt: 'asc' }, { playerId: 'asc' }],
    });
    if (next) await tx.teamMember.update({ where: { teamId_playerId: { teamId, playerId: next.playerId } }, data: { role: 'captain' } });
  }

  private async hasRegisteredMember(tx: DbTx, teamId: string): Promise<boolean> {
    return (await tx.teamMember.count({ where: { teamId, leftAt: null, player: { userId: { not: null } } } })) > 0;
  }

  private row(tx: DbTx, teamId: string, playerId: string) {
    return tx.teamMember.findUnique({ where: { teamId_playerId: { teamId, playerId } } });
  }

  private async membership(tx: DbTx, teamId: string, playerId: string) {
    const row = await this.row(tx, teamId, playerId);
    return row && row.leftAt === null ? row : null;
  }

  private async blocked(db: DbTx, a: string, b: string): Promise<boolean> {
    const rows = await db.$queryRaw<Array<{ one: number }>>`
      SELECT 1 AS one FROM usr_user_block
       WHERE (blocker_id = ${a}::uuid AND blocked_id = ${b}::uuid) OR (blocker_id = ${b}::uuid AND blocked_id = ${a}::uuid)
       LIMIT 1`;
    return rows.length > 0;
  }

  /** `where` is SQL over `t` (teams) and `s` (sports); $1 is the viewer, extra params start at $2. */
  private summaries(db: DbTx, viewerId: string, where: string, params: unknown[]): Promise<SummaryRow[]> {
    return db.$queryRawUnsafe<SummaryRow[]>(
      `SELECT t.id, t.name, t.created_at AS "createdAt",
              json_build_object('id', s.id::text, 'slug', s.slug, 'name', s.name, 'iconKey', s.icon_key, 'accentColor', s.accent_color) AS sport,
              (SELECT count(*)::int FROM team_members m WHERE m.team_id = t.id AND m.left_at IS NULL) AS "memberCount",
              (SELECT coalesce(m.role, 'player') FROM team_members m JOIN players p ON p.id = m.player_id
                WHERE m.team_id = t.id AND m.left_at IS NULL AND p.user_id = $1::uuid) AS "myRole",
              coalesce(ts.matches_played, 0) AS played, coalesce(ts.won, 0) AS won,
              coalesce(ts.lost, 0) AS lost, coalesce(ts.drawn, 0) AS drawn,
              (SELECT json_agg(x) FROM (
                 SELECT coalesce(pr.display_name, p.display_name) AS "displayName", p.user_id AS "userId", pr.profile_photo AS "photoUrl"
                   FROM team_members m JOIN players p ON p.id = m.player_id
                   LEFT JOIN usr_user_profile pr ON pr.user_id = p.user_id
                  WHERE m.team_id = t.id AND m.left_at IS NULL
                  ORDER BY m.role = 'captain' DESC NULLS LAST, m.joined_at
                  LIMIT 4) x) AS preview
         FROM teams t
         JOIN sports s ON s.id = t.sport_id
         LEFT JOIN team_stats ts ON ts.team_id = t.id
        WHERE ${where}
        ORDER BY lower(t.name), t.id`,
      viewerId,
      ...params,
    );
  }

  private tx<T>(work: (tx: DbTx) => Promise<T>): Promise<T> {
    return this.db.$transaction(work, { maxWait: 20_000, timeout: 60_000 });
  }
}
