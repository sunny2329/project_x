import type { Db, DbTx } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { UserStatus } from '../auth/auth.types.js';
import { rebuildPlayerStats } from '../matches/stats.js';

/** A person who can be put in a match: a registered user (maybe without a player row yet) or a guest. */
export interface PlayerOption {
  playerId: string | null;
  userId: string | null;
  username: string | null;
  displayName: string;
  isGuest: boolean;
}

export interface PlayerRef {
  playerId: string;
  userId: string | null;
  displayName: string;
  isGuest: boolean;
}

/** How a match or entry names a participant: an existing player, a registered user, or a new guest. */
export type ParticipantInput = { playerId: string } | { userId: string } | { guest: { displayName: string; phone?: string | null | undefined } };

interface UserRow {
  id: string;
  username: string;
  displayName: string | null;
  phone: string;
  phoneVerified: boolean;
}

async function loadUser(db: DbTx, userId: string): Promise<UserRow | null> {
  const rows = await db.$queryRaw<UserRow[]>`
    SELECT u.id, u.username, p.display_name AS "displayName",
           u.phone_country_code || u.phone_number AS phone, u.is_phone_verified AS "phoneVerified"
      FROM usr_user u LEFT JOIN usr_user_profile p ON p.user_id = u.id
     WHERE u.id = ${userId}::uuid AND u.status = ${UserStatus.ACTIVE}`;
  return rows[0] ?? null;
}

export const toPlayerRef = (p: { id: string; userId: string | null; displayName: string }): PlayerRef => ({
  playerId: p.id,
  userId: p.userId,
  displayName: p.displayName,
  isGuest: p.userId === null,
});

/**
 * Re-points everything a guest played into `targetId`, keeps the guest row (merged_into_id) for
 * audit, and rebuilds the target's stats. Rows that would clash (both in the same match or
 * entry, which shouldn't happen) are left on the guest.
 */
export async function mergeGuest(db: DbTx, guestId: string, targetId: string): Promise<void> {
  await db.$executeRaw`
    UPDATE match_participants mp SET player_id = ${targetId}::uuid
     WHERE mp.player_id = ${guestId}::uuid
       AND NOT EXISTS (SELECT 1 FROM match_participants o WHERE o.match_id = mp.match_id AND o.player_id = ${targetId}::uuid)`;
  await db.$executeRaw`
    UPDATE team_members tm SET player_id = ${targetId}::uuid
     WHERE tm.player_id = ${guestId}::uuid
       AND NOT EXISTS (SELECT 1 FROM team_members o WHERE o.team_id = tm.team_id AND o.player_id = ${targetId}::uuid)`;
  await db.$executeRaw`
    UPDATE tournament_entry_members em SET player_id = ${targetId}::uuid
     WHERE em.player_id = ${guestId}::uuid
       AND NOT EXISTS (SELECT 1 FROM tournament_entry_members o WHERE o.event_id = em.event_id AND o.player_id = ${targetId}::uuid)`;
  await db.$executeRaw`
    INSERT INTO player_sports (player_id, sport_id, is_primary)
    SELECT ${targetId}::uuid, sport_id, false FROM player_sports WHERE player_id = ${guestId}::uuid
    ON CONFLICT DO NOTHING`;
  await db.playerSport.deleteMany({ where: { playerId: guestId } });
  const sports = await db.playerSportStats.findMany({ where: { playerId: guestId }, select: { sportId: true } });
  await db.playerSportStats.deleteMany({ where: { playerId: guestId } });
  await db.playerRating.deleteMany({ where: { playerId: guestId } });
  await db.player.update({ where: { id: guestId }, data: { mergedIntoId: targetId, claimedAt: new Date() } });
  for (const { sportId } of sports) await rebuildPlayerStats(db, [targetId], sportId);
}

export class PlayersService {
  constructor(private readonly db: Db) {}

  /**
   * The user's player row, created on first use. A new user whose verified phone matches guest
   * players (added by others before they signed up) takes over the newest of them; any others
   * are merged in, so their history, stats and teams become the user's.
   */
  async ensureForUser(userId: string, db: DbTx = this.db): Promise<PlayerRef> {
    const existing = await db.player.findUnique({ where: { userId } });
    if (existing) return toPlayerRef(existing);
    const user = await loadUser(db, userId);
    if (!user) throw AppError.badRequest('VALIDATION_ERROR', 'Some fields are invalid.', { players: ['Some players could not be found'] });

    const guests = user.phoneVerified ? await this.claimableGuests(db, user.phone) : [];
    const [first, ...rest] = guests;
    let player;
    if (first) {
      player = await db.player.update({ where: { id: first.id }, data: { userId, claimedAt: new Date(), displayName: user.displayName ?? first.displayName } });
      for (const guest of rest) await mergeGuest(db, guest.id, player.id);
    } else {
      player = await db.player.create({ data: { userId, displayName: user.displayName ?? user.username, phone: user.phone } });
    }
    return toPlayerRef(player);
  }

  /** Merges guests that carry the user's verified phone into the user's player. Returns how many. */
  async claimGuests(userId: string): Promise<number> {
    return this.db.$transaction(async (tx) => {
      const player = await this.ensureForUser(userId, tx);
      const user = await loadUser(tx, userId);
      if (!user?.phoneVerified) throw AppError.forbidden('PHONE_NOT_VERIFIED', 'Verify your phone number to claim matches played as a guest.');
      const guests = await this.claimableGuests(tx, user.phone);
      for (const guest of guests) await mergeGuest(tx, guest.id, player.playerId);
      return guests.length;
    });
  }

  private claimableGuests(db: DbTx, phone: string) {
    return db.player.findMany({ where: { phone, userId: null, mergedIntoId: null }, orderBy: { createdAt: 'desc' } });
  }

  async createGuest(createdByUserId: string, input: { displayName: string; phone?: string | null | undefined }, db: DbTx = this.db): Promise<PlayerRef> {
    const guest = await db.player.create({ data: { displayName: input.displayName, phone: input.phone ?? null, createdByUserId } });
    return toPlayerRef(guest);
  }

  /** Resolves match/entry participants to player ids (creating user players and guests as needed). */
  async resolve(createdByUserId: string, inputs: ParticipantInput[], db: DbTx = this.db): Promise<PlayerRef[]> {
    const out: PlayerRef[] = [];
    for (const input of inputs) {
      if ('guest' in input) out.push(await this.createGuest(createdByUserId, input.guest, db));
      else if ('userId' in input) out.push(await this.ensureForUser(input.userId, db));
      else {
        const player = await db.player.findUnique({ where: { id: input.playerId } });
        if (!player) throw AppError.badRequest('VALIDATION_ERROR', 'Some fields are invalid.', { players: ['Some players could not be found'] });
        // A merged guest is played as the player it was merged into.
        const current = player.mergedIntoId ? await db.player.findUniqueOrThrow({ where: { id: player.mergedIntoId } }) : player;
        out.push(toPlayerRef(current));
      }
    }
    return out;
  }

  /**
   * Registered players matching `query` by username or name (never blocked ones), then the
   * caller's own guests. Exact username matches first.
   */
  async search(userId: string, query: string, limit: number): Promise<PlayerOption[]> {
    const pattern = query.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`);
    const users = await this.db.$queryRaw<Array<{ userId: string; username: string; displayName: string; playerId: string | null }>>`
      SELECT u.id AS "userId", u.username, coalesce(pr.display_name, u.username) AS "displayName", pl.id AS "playerId"
        FROM usr_user u
        LEFT JOIN usr_user_profile pr ON pr.user_id = u.id
        LEFT JOIN players pl ON pl.user_id = u.id
       WHERE u.status = ${UserStatus.ACTIVE}
         AND (lower(u.username) LIKE ${pattern} || '%' OR lower(pr.display_name) LIKE '%' || ${pattern} || '%')
         AND NOT EXISTS (SELECT 1 FROM usr_user_block b
                          WHERE (b.blocker_id = ${userId}::uuid AND b.blocked_id = u.id)
                             OR (b.blocker_id = u.id AND b.blocked_id = ${userId}::uuid))
       ORDER BY lower(u.username) = ${pattern} DESC, lower(u.username)
       LIMIT ${limit}`;
    const guests = await this.db.player.findMany({
      where: { createdByUserId: userId, userId: null, mergedIntoId: null, displayName: { contains: query, mode: 'insensitive' } },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
    return [
      ...users.map((u) => ({ playerId: u.playerId, userId: u.userId, username: u.username, displayName: u.displayName, isGuest: false })),
      ...guests.map((g) => ({ playerId: g.id, userId: null, username: null, displayName: g.displayName, isGuest: true })),
    ].slice(0, limit);
  }

  /** Guests the user added recently, for quick re-use on the start-a-match screen. */
  async recentGuests(userId: string, limit = 20): Promise<PlayerRef[]> {
    const guests = await this.db.player.findMany({
      where: { createdByUserId: userId, userId: null, mergedIntoId: null },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
    return guests.map(toPlayerRef);
  }
}
