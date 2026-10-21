import { randomBytes, randomUUID } from 'node:crypto';
import type { Db, DbTx } from '../../database/prisma.js';
import { Prisma } from '../../database/prisma.js';
import { parseConfig, scoringRegistry, type ScoreSummary } from '../../engine/scoring/index.js';
import {
  DEFAULT_TIEBREAKERS,
  fillGroupQualifiers,
  getFormat,
  initialNodes,
  parseFormatConfig,
  rankGroup,
  recordOutcome,
  seededRandom,
  TournamentError,
  type DrawPlan,
  type FixtureNode,
  type FixtureResultType,
  type GroupResult,
  type SlotSource,
  type StandingRow,
  type Tiebreaker,
} from '../../engine/tournament/index.js';
import { AppError } from '../../utils/app-error.js';
import { TX_OPTIONS, type MatchDecidedHook, type MatchesService } from '../matches/matches.service.js';
import type { MatchView } from '../matches/matches.types.js';
import type { ParticipantInput, PlayersService } from '../players/players.service.js';
import type { z } from 'zod';
import type {
  addEntrySchema,
  createEventSchema,
  createTournamentSchema,
  scheduleFixtureSchema,
  updateEntrySchema,
  updateEventSchema,
  updateTournamentSchema,
} from './tournaments.validation.js';

type StoredSource = SlotSource & { byeArrived?: boolean };

const invalid = (field: string, message: string) => AppError.badRequest('VALIDATION_ERROR', 'Some fields are invalid.', { [field]: [message] });
const notFound = (what: string) => AppError.notFound(`${what.toUpperCase()}_NOT_FOUND`, `This ${what} does not exist.`);

function slugify(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'tournament';
  return `${base}-${randomBytes(3).toString('hex')}`;
}

function engineError(error: unknown): never {
  if (error instanceof TournamentError) {
    if (error.code === 'NOT_READY') throw AppError.conflict('FIXTURE_NOT_READY', error.message);
    throw AppError.badRequest('VALIDATION_ERROR', error.message);
  }
  throw error;
}

export interface FixtureEntryView {
  id: string;
  name: string;
  seed: number | null;
  /** Average rating of the entry's players in the event's sport (1000 for unrated players). */
  rating: number;
  players: Array<{ playerId: string; userId: string | null; displayName: string }>;
}

export interface FixtureView {
  id: string;
  eventId: string;
  event: { id: string; name: string; sport: { slug: string; name: string; accentColor: string } };
  stageId: string;
  stageName: string;
  stageType: string;
  groupId: string | null;
  groupName: string | null;
  round: number;
  position: number;
  roundName: string | null;
  status: string;
  entries: Array<FixtureEntryView | null>;
  /** What fills an empty slot: "Winner of Semi-final 1", "1st Group A", "Bye". */
  placeholders: Array<string | null>;
  winnerEntryId: string | null;
  court: { id: string; name: string; scorers: Array<{ userId: string; name: string | null }> } | null;
  scheduledAt: string | null;
  match: {
    id: string;
    /** For the public live link (/s/:token). */
    shareToken: string;
    status: string;
    headline: string;
    winnerSideIndex: number | null;
    callout: string | null;
    /** Per side: games/sets won and the running score ("21 · 14" on cards). */
    sides: Array<{ primary: string; current: string | null }>;
    segments: number[][];
  } | null;
  nextFixtureId: string | null;
  /** Where the winner goes and who they may meet ("Winner plays Neel G or Aarav K in QF 2"). */
  next: { fixtureId: string; roundName: string | null; position: number; opponent: string | null } | null;
}

export interface StandingView extends StandingRow {
  name: string;
}

export class TournamentsService implements MatchDecidedHook {
  constructor(
    private readonly db: Db,
    private readonly players: PlayersService,
    private readonly matches: MatchesService,
  ) {}

  private tx<T>(work: (tx: DbTx) => Promise<T>): Promise<T> {
    return this.db.$transaction(work, TX_OPTIONS);
  }

  // ------------------------------------------------------------------------------------------
  // Access
  // ------------------------------------------------------------------------------------------

  private async assertOrganizer(userId: string, tournamentId: string, db: DbTx = this.db) {
    const t = await db.tournament.findUnique({ where: { id: tournamentId }, include: { staff: { where: { userId } } } });
    if (!t) throw notFound('tournament');
    const ok = t.organizerUserId === userId || t.staff.some((s) => s.role === 'organizer' || s.role === 'co_organizer');
    if (!ok) throw AppError.forbidden('NOT_ORGANIZER', 'Only the organizers can change this tournament.');
    return t;
  }

  private async eventWithTournament(eventId: string, db: DbTx = this.db) {
    const event = await db.tournamentEvent.findUnique({ where: { id: eventId }, include: { tournament: true, sport: true, sportFormat: true, ruleset: true } });
    if (!event) throw notFound('event');
    return event;
  }

  // ------------------------------------------------------------------------------------------
  // Tournaments, staff, courts
  // ------------------------------------------------------------------------------------------

  async create(userId: string, input: z.infer<typeof createTournamentSchema>) {
    const t = await this.tx(async (tx) => {
      let venueId = input.venueId ?? null;
      if (!venueId && input.venueName) venueId = (await tx.venue.create({ data: { name: input.venueName, createdByUserId: userId } })).id;
      const created = await tx.tournament.create({
        data: {
          slug: slugify(input.name),
          name: input.name,
          description: input.description ?? null,
          visibility: input.visibility,
          startsOn: input.startsOn ? new Date(input.startsOn) : null,
          endsOn: input.endsOn ? new Date(input.endsOn) : null,
          venueId,
          organizerUserId: userId,
          entryFee: input.entryFee || null,
        },
      });
      await tx.tournamentStaff.create({ data: { tournamentId: created.id, userId, role: 'organizer' } });
      return created;
    });
    return this.get(userId, t.id);
  }

  async update(userId: string, tournamentId: string, input: z.infer<typeof updateTournamentSchema>) {
    await this.assertOrganizer(userId, tournamentId);
    await this.db.tournament.update({
      where: { id: tournamentId },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.visibility ? { visibility: input.visibility } : {}),
        ...(input.startsOn ? { startsOn: new Date(input.startsOn) } : {}),
        ...(input.endsOn ? { endsOn: new Date(input.endsOn) } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.entryFee !== undefined ? { entryFee: input.entryFee || null } : {}),
      },
    });
    return this.get(userId, tournamentId);
  }

  /**
   * Tournaments for the Tournaments tab and search. `all`: ones I organize, help run or entered,
   * plus public ones that are open or under way.
   */
  async list(userId: string, options: { filter: 'all' | 'open' | 'live' | 'mine'; q?: string | undefined } = { filter: 'all' }) {
    const mine: Prisma.TournamentWhereInput[] = [
      { organizerUserId: userId },
      { staff: { some: { userId } } },
      { events: { some: { entries: { some: { members: { some: { player: { userId } } } } } } } },
    ];
    const listed: Prisma.TournamentWhereInput = { visibility: 'public', status: { in: ['registration_open', 'registration_closed', 'in_progress'] } };
    const byFilter: Record<typeof options.filter, Prisma.TournamentWhereInput> = {
      all: { OR: [...mine, listed] },
      open: { visibility: 'public', status: 'registration_open' },
      live: { OR: [{ visibility: 'public', status: 'in_progress' }, { AND: [{ status: 'in_progress' }, { OR: mine }] }] },
      mine: { OR: mine },
    };
    const where: Prisma.TournamentWhereInput = options.q
      ? { AND: [byFilter[options.filter], { name: { contains: options.q, mode: 'insensitive' } }, { OR: [...mine, { visibility: 'public', status: { not: 'draft' } }] }] }
      : byFilter[options.filter];
    const rows = await this.db.tournament.findMany({
      where,
      include: {
        events: {
          orderBy: { sortOrder: 'asc' },
          include: { sport: true, _count: { select: { entries: { where: { status: { in: ['pending', 'approved'] } } } } } },
        },
        venue: true,
        staff: { where: { userId } },
        _count: { select: { courts: true } },
      },
      orderBy: [{ startsOn: 'asc' }, { createdAt: 'desc' }],
      take: 50,
    });
    // What is being played right now, for live tournaments ("Semi-finals · 3 courts").
    const live = await this.db.fixture.findMany({
      where: { status: 'live', stage: { event: { tournamentId: { in: rows.filter((t) => t.status === 'in_progress').map((t) => t.id) } } } },
      select: { roundName: true, courtId: true, stage: { select: { name: true, type: true, event: { select: { tournamentId: true } } } } },
    });
    return rows.map((t) => {
      const now = live.filter((f) => f.stage.event.tournamentId === t.id);
      const rounds = [...new Set(now.map((f) => (f.stage.type === 'round_robin' ? f.stage.name : f.roundName ?? f.stage.name)))];
      return {
        id: t.id,
        slug: t.slug,
        name: t.name,
        status: t.status,
        visibility: t.visibility,
        startsOn: t.startsOn?.toISOString().slice(0, 10) ?? null,
        endsOn: t.endsOn?.toISOString().slice(0, 10) ?? null,
        registrationClosesAt: t.registrationClosesAt?.toISOString() ?? null,
        venue: t.venue ? { id: t.venue.id, name: t.venue.name } : null,
        sports: [...new Map(t.events.map((e) => [e.sport.slug, { slug: e.sport.slug, name: e.sport.name, iconKey: e.sport.iconKey, accentColor: e.sport.accentColor }])).values()],
        events: t.events.map((e) => ({ id: e.id, name: e.name, sport: { slug: e.sport.slug, accentColor: e.sport.accentColor } })),
        entries: t.events.reduce((n, e) => n + e._count.entries, 0),
        capacity: t.events.every((e) => e.maxEntries) ? t.events.reduce((n, e) => n + (e.maxEntries ?? 0), 0) : null,
        courts: t._count.courts,
        live: now.length ? { rounds, courtsInUse: new Set(now.map((f) => f.courtId).filter(Boolean)).size } : null,
        isOrganizer: t.organizerUserId === userId || t.staff.some((s) => s.role === 'organizer' || s.role === 'co_organizer'),
        isStaff: t.staff.length > 0,
      };
    });
  }

  /** Full detail; `userId` null = public read (public/unlisted tournaments only). */
  async get(userId: string | null, tournamentId: string) {
    const t = await this.db.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        venue: true,
        staff: true,
        courts: { orderBy: { sortOrder: 'asc' }, include: { scorers: true } },
        events: {
          orderBy: { sortOrder: 'asc' },
          include: {
            sport: true,
            sportFormat: true,
            ruleset: true,
            entries: { where: { status: { in: ['pending', 'approved'] } }, select: { id: true, status: true, members: { select: { player: { select: { userId: true } } } } } },
          },
        },
      },
    });
    if (!t) throw notFound('tournament');
    const staffIds = new Set([t.organizerUserId, ...t.staff.map((s) => s.userId)]);
    if (t.visibility === 'private' && (!userId || !staffIds.has(userId))) throw notFound('tournament');
    const isOrganizer = userId !== null && (t.organizerUserId === userId || t.staff.some((s) => s.userId === userId && (s.role === 'organizer' || s.role === 'co_organizer')));
    const courtScorerIds = t.courts.flatMap((c) => c.scorers.map((s) => s.userId));
    const names = await this.userNames([t.organizerUserId, ...t.staff.map((s) => s.userId), ...courtScorerIds]);
    const pendingEntries = t.events.reduce((n, e) => n + e.entries.filter((x) => x.status === 'pending').length, 0);
    return {
      id: t.id,
      slug: t.slug,
      name: t.name,
      description: t.description,
      status: t.status,
      visibility: t.visibility,
      startsOn: t.startsOn?.toISOString().slice(0, 10) ?? null,
      endsOn: t.endsOn?.toISOString().slice(0, 10) ?? null,
      registrationClosesAt: t.registrationClosesAt?.toISOString() ?? null,
      entryFee: t.entryFee,
      venue: t.venue ? { id: t.venue.id, name: t.venue.name } : null,
      organizer: { userId: t.organizerUserId, name: names.get(t.organizerUserId) ?? null },
      isOrganizer,
      isStaff: userId !== null && staffIds.has(userId),
      pendingEntries: isOrganizer ? pendingEntries : 0,
      staff: isOrganizer ? t.staff.map((s) => ({ userId: s.userId, role: s.role, name: names.get(s.userId) ?? null })) : [],
      courts: t.courts.map((c) => ({
        id: c.id,
        name: c.name,
        scorerUserIds: isOrganizer ? c.scorers.map((s) => s.userId) : [],
        scorers: isOrganizer ? c.scorers.map((s) => ({ userId: s.userId, name: names.get(s.userId) ?? null })) : [],
      })),
      events: t.events.map((e) => ({
        id: e.id,
        name: e.name,
        status: e.status,
        sport: { id: String(e.sport.id), slug: e.sport.slug, name: e.sport.name, iconKey: e.sport.iconKey, accentColor: e.sport.accentColor },
        format: { code: e.sportFormat.code, name: e.sportFormat.name, playersPerSide: e.sportFormat.playersPerSide },
        ruleset: { id: e.ruleset.id, name: e.ruleset.name },
        drawFormat: e.format,
        drawConfig: e.formatConfig,
        tiebreakers: e.tiebreakers,
        maxEntries: e.maxEntries,
        approvedEntries: e.entries.filter((x) => x.status === 'approved').length,
        pendingEntries: e.entries.filter((x) => x.status === 'pending').length,
        /** My entry in this event, if I am one of its players. */
        myEntry: (() => {
          const mine = userId ? e.entries.find((x) => x.members.some((m) => m.player.userId === userId)) : undefined;
          return mine ? { id: mine.id, status: mine.status } : null;
        })(),
      })),
    };
  }

  async getBySlug(slug: string) {
    const t = await this.db.tournament.findUnique({ where: { slug }, select: { id: true, visibility: true } });
    if (!t || t.visibility === 'private') throw notFound('tournament');
    return this.get(null, t.id);
  }

  private async userNames(userIds: string[]): Promise<Map<string, string>> {
    if (!userIds.length) return new Map();
    const rows = await this.db.$queryRaw<Array<{ id: string; name: string }>>`
      SELECT u.id, coalesce(p.display_name, u.username) AS name
        FROM usr_user u LEFT JOIN usr_user_profile p ON p.user_id = u.id WHERE u.id = ANY(${userIds}::uuid[])`;
    return new Map(rows.map((r) => [r.id, r.name]));
  }

  async addStaff(userId: string, tournamentId: string, input: { userId: string; role: 'co_organizer' | 'scorer' | 'referee' }) {
    await this.assertOrganizer(userId, tournamentId);
    await this.db.tournamentStaff.upsert({
      where: { tournamentId_userId_role: { tournamentId, userId: input.userId, role: input.role } },
      create: { tournamentId, userId: input.userId, role: input.role },
      update: {},
    });
    await this.invalidateLiveMatches(tournamentId);
    return this.get(userId, tournamentId);
  }

  async removeStaff(userId: string, tournamentId: string, staffUserId: string, role: string) {
    const t = await this.assertOrganizer(userId, tournamentId);
    if (staffUserId === t.organizerUserId) throw AppError.conflict('ORGANIZER_REQUIRED', 'The tournament creator stays an organizer.');
    await this.db.tournamentStaff.deleteMany({ where: { tournamentId, userId: staffUserId, role: role as 'co_organizer' } });
    await this.invalidateLiveMatches(tournamentId);
    return this.get(userId, tournamentId);
  }

  async addCourt(userId: string, tournamentId: string, input: { name: string; sport?: string | undefined }) {
    const t = await this.assertOrganizer(userId, tournamentId);
    const sport = input.sport ? await this.db.sport.findUnique({ where: { slug: input.sport } }) : null;
    const count = await this.db.court.count({ where: { tournamentId } });
    try {
      await this.db.court.create({ data: { tournamentId, venueId: t.venueId, name: input.name, sportId: sport?.id ?? null, sortOrder: count } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw invalid('name', 'A court with this name exists');
      throw error;
    }
    return this.get(userId, tournamentId);
  }

  /** Assigns a scorer to every match played on a court (`replace`: the only scorer). */
  async assignCourtScorer(userId: string, courtId: string, scorerUserId: string, replace = false) {
    const court = await this.db.court.findUnique({ where: { id: courtId } });
    if (!court?.tournamentId) throw notFound('court');
    await this.assertOrganizer(userId, court.tournamentId);
    if (replace) await this.db.courtScorer.deleteMany({ where: { courtId, userId: { not: scorerUserId } } });
    await this.db.courtScorer.upsert({ where: { courtId_userId: { courtId, userId: scorerUserId } }, create: { courtId, userId: scorerUserId }, update: {} });
    await this.invalidateLiveMatches(court.tournamentId);
    return this.get(userId, court.tournamentId);
  }

  /** Back to "any staff" for a court. */
  async removeCourtScorer(userId: string, courtId: string, scorerUserId: string) {
    const court = await this.db.court.findUnique({ where: { id: courtId } });
    if (!court?.tournamentId) throw notFound('court');
    await this.assertOrganizer(userId, court.tournamentId);
    await this.db.courtScorer.deleteMany({ where: { courtId, userId: scorerUserId } });
    await this.invalidateLiveMatches(court.tournamentId);
    return this.get(userId, court.tournamentId);
  }

  /** Scorer lists are cached with live matches; reload them after staff/court changes. */
  private async invalidateLiveMatches(tournamentId: string): Promise<void> {
    const live = await this.db.fixture.findMany({ where: { status: 'live', stage: { event: { tournamentId } }, matchId: { not: null } }, select: { matchId: true } });
    for (const f of live) await this.matches.invalidate(f.matchId!);
  }

  // ------------------------------------------------------------------------------------------
  // Events (categories) and entries
  // ------------------------------------------------------------------------------------------

  async addEvent(userId: string, tournamentId: string, input: z.infer<typeof createEventSchema>) {
    await this.assertOrganizer(userId, tournamentId);
    const sport = await this.db.sport.findUnique({ where: { slug: input.sport }, include: { formats: true, rulesets: true } });
    if (!sport?.isActive) throw invalid('sport', 'Unknown sport');
    const format = sport.formats.find((f) => f.code === input.format && f.isActive);
    if (!format) throw invalid('format', `${sport.name} has no ${input.format} format`);
    const ruleset = input.rulesetId ? sport.rulesets.find((r) => r.id === input.rulesetId) : sport.rulesets.find((r) => r.isDefault);
    if (!ruleset?.isActive || !scoringRegistry.has(ruleset.scoringModel)) throw invalid('rulesetId', 'Unknown rules for this sport');
    if (input.rulesOverride) {
      try {
        parseConfig(scoringRegistry.get(ruleset.scoringModel), { ...(ruleset.config as object), ...input.rulesOverride });
      } catch (error) {
        throw invalid('rulesOverride', error instanceof Error ? error.message : 'Invalid rules');
      }
    }
    let drawConfig: unknown;
    try {
      drawConfig = parseFormatConfig(input.drawFormat, input.drawConfig);
    } catch (error) {
      throw invalid('drawConfig', error instanceof Error ? error.message : 'Invalid draw settings');
    }
    const count = await this.db.tournamentEvent.count({ where: { tournamentId } });
    try {
      const event = await this.db.tournamentEvent.create({
        data: {
          tournamentId,
          sportId: sport.id,
          sportFormatId: format.id,
          rulesetId: ruleset.id,
          name: input.name,
          format: input.drawFormat,
          formatConfig: drawConfig as Prisma.InputJsonValue,
          tiebreakers: (input.tiebreakers ?? DEFAULT_TIEBREAKERS) as Prisma.InputJsonValue,
          ...(input.rulesOverride ? { rulesOverride: input.rulesOverride as Prisma.InputJsonValue } : {}),
          maxEntries: input.maxEntries ?? null,
          sortOrder: count,
        },
      });
      return this.eventDetail(userId, event.id);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw invalid('name', 'An event with this name exists');
      throw error;
    }
  }

  async updateEvent(userId: string, eventId: string, input: z.infer<typeof updateEventSchema>) {
    const event = await this.eventWithTournament(eventId);
    await this.assertOrganizer(userId, event.tournamentId);
    const drawn = await this.db.tournamentStage.count({ where: { eventId } });
    if (drawn && (input.drawConfig || input.status === 'registration_open')) throw AppError.conflict('ALREADY_DRAWN', 'The draw has been made; reset it first.');
    let drawConfig: unknown;
    if (input.drawConfig) {
      try {
        drawConfig = parseFormatConfig(event.format, input.drawConfig);
      } catch (error) {
        throw invalid('drawConfig', error instanceof Error ? error.message : 'Invalid draw settings');
      }
    }
    await this.db.tournamentEvent.update({
      where: { id: eventId },
      data: {
        ...(input.status ? { status: input.status } : {}),
        ...(input.maxEntries !== undefined ? { maxEntries: input.maxEntries } : {}),
        ...(drawConfig ? { formatConfig: drawConfig as Prisma.InputJsonValue } : {}),
        ...(input.tiebreakers ? { tiebreakers: input.tiebreakers as Prisma.InputJsonValue } : {}),
      },
    });
    if (input.status === 'registration_open') {
      await this.db.tournament.updateMany({ where: { id: event.tournamentId, status: 'draft' }, data: { status: 'registration_open' } });
    }
    return this.eventDetail(userId, eventId);
  }

  /**
   * Organizers add entries directly (approved, guests allowed). Anyone else may register
   * themselves (and a partner) while registration is open; that entry waits for approval.
   */
  async addEntry(userId: string, eventId: string, input: z.infer<typeof addEntrySchema>) {
    const event = await this.eventWithTournament(eventId);
    const isOrganizer = await this.assertOrganizer(userId, event.tournamentId).then(
      () => true,
      () => false,
    );
    if (!isOrganizer && event.status !== 'registration_open') throw AppError.conflict('REGISTRATION_CLOSED', 'Registration for this event is closed.');
    if (await this.db.tournamentStage.count({ where: { eventId } })) throw AppError.conflict('ALREADY_DRAWN', 'The draw has been made.');
    const f = event.sportFormat;
    if (input.players.length < f.minPerSide || input.players.length > f.maxPerSide) {
      throw invalid('players', `${event.name} entries need ${f.playersPerSide} player${f.playersPerSide > 1 ? 's' : ''}`);
    }
    if (event.maxEntries) {
      const n = await this.db.tournamentEntry.count({ where: { eventId, status: { in: ['pending', 'approved'] } } });
      if (n >= event.maxEntries) throw AppError.conflict('EVENT_FULL', 'This event is full.');
    }
    await this.tx(async (tx) => {
      const people = await this.players.resolve(userId, input.players as ParticipantInput[], tx);
      if (!isOrganizer) {
        const me = await this.players.ensureForUser(userId, tx);
        if (!people.some((p) => p.playerId === me.playerId)) throw invalid('players', 'Register yourself as one of the players');
      }
      if (new Set(people.map((p) => p.playerId)).size !== people.length) throw invalid('players', 'A player can only be listed once');
      const clash = await tx.tournamentEntryMember.findFirst({ where: { eventId, playerId: { in: people.map((p) => p.playerId) } }, include: { player: true } });
      if (clash) throw invalid('players', `${clash.player.displayName} is already entered in this event`);
      const entryId = randomUUID();
      await tx.tournamentEntry.create({
        data: {
          id: entryId,
          eventId,
          name: input.name ?? null,
          teamId: input.teamId ?? null,
          seed: isOrganizer ? (input.seed ?? null) : null,
          status: isOrganizer ? 'approved' : 'pending',
          registeredByUserId: userId,
        },
      });
      await tx.tournamentEntryMember.createMany({ data: people.map((p, sortOrder) => ({ entryId, eventId, playerId: p.playerId, sortOrder })) });
    }).catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw invalid('seed', 'Another entry has this seed');
      throw error;
    });
    return this.eventDetail(userId, eventId);
  }

  /** Organizers approve, decline (disqualified), seed or withdraw entries; a player may withdraw their own before the draw. */
  async updateEntry(userId: string, entryId: string, input: z.infer<typeof updateEntrySchema>) {
    const entry = await this.db.tournamentEntry.findUnique({ where: { id: entryId }, include: { event: true, members: { include: { player: true } } } });
    if (!entry) throw notFound('entry');
    const drawn = await this.db.tournamentStage.count({ where: { eventId: entry.eventId } });
    const isOrganizer = await this.assertOrganizer(userId, entry.event.tournamentId).then(
      () => true,
      () => false,
    );
    if (!isOrganizer) {
      const own = entry.registeredByUserId === userId || entry.members.some((m) => m.player.userId === userId);
      if (!own || input.seed !== undefined || input.status !== 'withdrawn') {
        throw AppError.forbidden('NOT_ORGANIZER', 'Only the organizers can change this tournament.');
      }
      if (drawn) throw AppError.conflict('ALREADY_DRAWN', 'The draw has been made; ask the organizer to withdraw you.');
    }
    if (drawn && input.seed !== undefined) throw AppError.conflict('ALREADY_DRAWN', 'Seeds are fixed once the draw is made.');
    try {
      await this.db.tournamentEntry.update({
        where: { id: entryId },
        data: { ...(input.status ? { status: input.status } : {}), ...(input.seed !== undefined ? { seed: input.seed } : {}) },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw invalid('seed', 'Another entry has this seed');
      throw error;
    }
    return this.eventDetail(userId, entry.eventId);
  }

  private async entryNames(eventId: string, db: DbTx = this.db): Promise<Map<string, string>> {
    const entries = await db.tournamentEntry.findMany({ where: { eventId }, include: { members: { orderBy: { sortOrder: 'asc' }, include: { player: true } } } });
    return new Map(entries.map((e) => [e.id, e.name ?? e.members.map((m) => m.player.displayName).join(' / ')]));
  }

  // ------------------------------------------------------------------------------------------
  // Draw
  // ------------------------------------------------------------------------------------------

  /** Generates the draw from the approved entries. `preview` returns it without saving. */
  async draw(userId: string, eventId: string, input: { randomSeed?: number | undefined; preview: boolean }) {
    const event = await this.eventWithTournament(eventId);
    await this.assertOrganizer(userId, event.tournamentId);
    if (await this.db.tournamentStage.count({ where: { eventId } })) throw AppError.conflict('ALREADY_DRAWN', 'The draw has been made; reset it first.');
    const entries = await this.db.tournamentEntry.findMany({ where: { eventId, status: 'approved' }, orderBy: { createdAt: 'asc' } });
    const seed = input.randomSeed ?? Math.floor(Math.random() * 2 ** 31);
    let plan: DrawPlan;
    try {
      const format = getFormat(event.format);
      plan = format.generate(entries.map((e) => ({ id: e.id, seed: e.seed })), parseFormatConfig(event.format, event.formatConfig), { random: seededRandom(seed) });
    } catch (error) {
      engineError(error);
    }
    if (input.preview) {
      const names = await this.entryNames(eventId);
      return { randomSeed: seed, preview: describePlan(plan, names, new Map(entries.map((e) => [e.id, e.seed]))) };
    }
    await this.tx(async (tx) => {
      await this.savePlan(tx, eventId, plan);
      await tx.tournamentEvent.update({ where: { id: eventId }, data: { status: 'drawn' } });
    });
    return { randomSeed: seed, event: await this.eventDetail(userId, eventId) };
  }

  /** Removes a draw that has not started (no fixture has a match yet). */
  async resetDraw(userId: string, eventId: string) {
    const event = await this.eventWithTournament(eventId);
    await this.assertOrganizer(userId, event.tournamentId);
    const started = await this.db.fixture.count({ where: { stage: { eventId }, matchId: { not: null } } });
    if (started) throw AppError.conflict('DRAW_STARTED', 'Matches have been played; the draw can no longer be reset.');
    await this.tx(async (tx) => {
      await tx.tournamentStage.deleteMany({ where: { eventId } });
      await tx.tournamentEvent.update({ where: { id: eventId }, data: { status: 'registration_closed' } });
    });
    return this.eventDetail(userId, eventId);
  }

  private async savePlan(tx: DbTx, eventId: string, plan: DrawPlan): Promise<void> {
    const fixtureIds = new Map(plan.stages.flatMap((s) => s.fixtures.map((f) => [f.key, randomUUID()] as const)));
    const groupIds = new Map(plan.stages.flatMap((s) => s.groups.map((g) => [g.key, randomUUID()] as const)));
    const mapSource = (source: SlotSource): StoredSource => {
      if (source.kind === 'winner' || source.kind === 'loser') return { ...source, fixtureKey: fixtureIds.get(source.fixtureKey)! };
      if (source.kind === 'group_rank') return { ...source, groupKey: groupIds.get(source.groupKey)! };
      return source;
    };
    for (const stage of plan.stages) {
      const stageId = randomUUID();
      await tx.tournamentStage.create({ data: { id: stageId, eventId, sequence: stage.sequence, type: stage.type, name: stage.name } });
      for (const group of stage.groups) {
        await tx.stageGroup.create({ data: { id: groupIds.get(group.key)!, stageId, type: group.type, name: group.name, sequence: group.sequence } });
        if (group.entryIds.length) {
          await tx.stageGroupEntry.createMany({ data: group.entryIds.map((entryId, i) => ({ groupId: groupIds.get(group.key)!, entryId, position: i + 1 })) });
        }
      }
      // Insert without links first (they point at fixtures of later rounds), then link.
      await tx.fixture.createMany({
        data: stage.fixtures.map((f) => ({
          id: fixtureIds.get(f.key)!,
          stageId,
          groupId: f.groupKey ? groupIds.get(f.groupKey)! : null,
          round: f.round,
          position: f.position,
          roundName: f.roundName,
          entry1Source: mapSource(f.slots[0]) as Prisma.InputJsonValue,
          entry2Source: mapSource(f.slots[1]) as Prisma.InputJsonValue,
        })),
      });
    }
    for (const f of plan.stages.flatMap((s) => s.fixtures)) {
      if (!f.next && !f.loserNext) continue;
      await tx.fixture.update({
        where: { id: fixtureIds.get(f.key)! },
        data: {
          nextFixtureId: f.next ? fixtureIds.get(f.next.fixtureKey)! : null,
          nextFixtureSlot: f.next?.slot ?? null,
          loserNextFixtureId: f.loserNext ? fixtureIds.get(f.loserNext.fixtureKey)! : null,
          loserNextFixtureSlot: f.loserNext?.slot ?? null,
        },
      });
    }
    const keyed: DrawPlan = {
      ...plan,
      stages: plan.stages.map((s) => ({
        ...s,
        fixtures: s.fixtures.map((f) => ({
          ...f,
          key: fixtureIds.get(f.key)!,
          slots: [mapSource(f.slots[0]), mapSource(f.slots[1])],
          next: f.next ? { ...f.next, fixtureKey: fixtureIds.get(f.next.fixtureKey)! } : null,
          loserNext: f.loserNext ? { ...f.loserNext, fixtureKey: fixtureIds.get(f.loserNext.fixtureKey)! } : null,
        })),
      })),
    };
    await this.saveNodes(tx, eventId, initialNodes(keyed), new Map());
  }

  // ------------------------------------------------------------------------------------------
  // Fixture state <-> engine nodes
  // ------------------------------------------------------------------------------------------

  private async loadNodes(tx: DbTx, eventId: string): Promise<FixtureNode[]> {
    const rows = await tx.fixture.findMany({ where: { stage: { eventId } } });
    return rows.map((f) => {
      const s1 = f.entry1Source as StoredSource;
      const s2 = f.entry2Source as StoredSource;
      return {
        key: f.id,
        slots: [s1, s2],
        entries: [f.entry1Id, f.entry2Id],
        byes: [s1.kind === 'bye' || !!s1.byeArrived, s2.kind === 'bye' || !!s2.byeArrived],
        status: f.status,
        winnerEntryId: f.winnerEntryId,
        next: f.nextFixtureId ? { fixtureKey: f.nextFixtureId, slot: f.nextFixtureSlot as 1 | 2 } : null,
        loserNext: f.loserNextFixtureId ? { fixtureKey: f.loserNextFixtureId, slot: f.loserNextFixtureSlot as 1 | 2 } : null,
      };
    });
  }

  /** Writes back only the fixtures whose state changed. */
  private async saveNodes(tx: DbTx, _eventId: string, nodes: FixtureNode[], before: Map<string, FixtureNode>): Promise<void> {
    for (const node of nodes) {
      const old = before.get(node.key);
      const same =
        old &&
        old.status === node.status &&
        old.winnerEntryId === node.winnerEntryId &&
        old.entries[0] === node.entries[0] &&
        old.entries[1] === node.entries[1] &&
        old.byes[0] === node.byes[0] &&
        old.byes[1] === node.byes[1];
      if (same) continue;
      const source = (i: 0 | 1): StoredSource => {
        const s = node.slots[i] as StoredSource;
        return node.byes[i] && s.kind !== 'bye' ? { ...s, byeArrived: true } : s;
      };
      await tx.fixture.update({
        where: { id: node.key },
        data: {
          status: node.status,
          winnerEntryId: node.winnerEntryId,
          entry1Id: node.entries[0],
          entry2Id: node.entries[1],
          entry1Source: source(0) as Prisma.InputJsonValue,
          entry2Source: source(1) as Prisma.InputJsonValue,
        },
      });
    }
  }

  // ------------------------------------------------------------------------------------------
  // Fixtures and match day
  // ------------------------------------------------------------------------------------------

  async scheduleFixture(userId: string, fixtureId: string, input: z.infer<typeof scheduleFixtureSchema>) {
    const fixture = await this.db.fixture.findUnique({ where: { id: fixtureId }, include: { stage: { include: { event: true } } } });
    if (!fixture) throw notFound('fixture');
    await this.assertOrganizer(userId, fixture.stage.event.tournamentId);
    if (input.courtId) {
      const court = await this.db.court.findUnique({ where: { id: input.courtId } });
      if (court?.tournamentId !== fixture.stage.event.tournamentId) throw invalid('courtId', 'Unknown court');
    }
    await this.db.fixture.update({
      where: { id: fixtureId },
      data: {
        ...(input.courtId !== undefined ? { courtId: input.courtId } : {}),
        ...(input.scheduledAt !== undefined ? { scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null } : {}),
      },
    });
    if (fixture.matchId) await this.db.match.update({ where: { id: fixture.matchId }, data: { courtId: input.courtId ?? fixture.courtId } });
    return this.fixtureView(fixtureId);
  }

  /** Creates the fixture's match (a normal live Match) so it can be scored. Staff and assigned scorers only. */
  async startFixture(userId: string, fixtureId: string): Promise<MatchView> {
    const matchId = await this.tx(async (tx) => {
      await tx.$queryRaw`SELECT id FROM fixtures WHERE id = ${fixtureId}::uuid FOR UPDATE`;
      const f = await tx.fixture.findUnique({ where: { id: fixtureId }, include: { stage: { include: { event: { include: { ruleset: true } } } } } });
      if (!f) throw notFound('fixture');
      const event = f.stage.event;
      await this.assertCanRun(tx, userId, event.tournamentId, f.courtId);
      if (f.matchId) return f.matchId;
      if (f.status !== 'ready') throw AppError.conflict('FIXTURE_NOT_READY', 'Both entries must be known before this match can start.');
      const members = await tx.tournamentEntryMember.findMany({ where: { entryId: { in: [f.entry1Id!, f.entry2Id!] } }, orderBy: { sortOrder: 'asc' } });
      const names = await this.entryNames(event.id, tx);
      const id = await this.matches.createMatchRecord(tx, {
        sportId: event.sportId,
        sportFormatId: event.sportFormatId,
        rulesetId: event.rulesetId,
        scoringModel: event.ruleset.scoringModel,
        config: { ...(event.ruleset.config as object), ...((event.rulesOverride as object | null) ?? {}) },
        context: 'tournament',
        createdByUserId: userId,
        courtId: f.courtId,
        sides: [f.entry1Id!, f.entry2Id!].map((entryId) => ({
          entryId,
          name: names.get(entryId) ?? null,
          playerIds: members.filter((m) => m.entryId === entryId).map((m) => m.playerId),
        })),
      });
      await tx.fixture.update({ where: { id: fixtureId }, data: { matchId: id, status: 'live' } });
      await tx.tournamentEvent.updateMany({ where: { id: event.id, status: { in: ['drawn', 'registration_closed', 'registration_open', 'draft'] } }, data: { status: 'in_progress' } });
      await tx.tournament.updateMany({ where: { id: event.tournamentId, status: { not: 'in_progress' } }, data: { status: 'in_progress' } });
      await tx.tournamentStage.updateMany({ where: { id: f.stageId, status: 'pending' }, data: { status: 'in_progress' } });
      return id;
    });
    return this.matches.get(userId, matchId);
  }

  /** Walkover / no-show (or a double walkover) for a fixture that hasn't been played. */
  async fixtureWalkover(userId: string, fixtureId: string, input: { winnerEntryId: string | null; reason: 'walkover' | 'no_show' }): Promise<MatchView> {
    const before = await this.db.fixture.findUnique({ where: { id: fixtureId } });
    if (!before) throw notFound('fixture');
    if (input.winnerEntryId !== null && input.winnerEntryId !== before.entry1Id && input.winnerEntryId !== before.entry2Id) {
      throw invalid('winnerEntryId', 'The winner must be one of the two entries');
    }
    const match = await this.startFixture(userId, fixtureId);
    const winnerSideIndex = input.winnerEntryId === null ? null : match.sides.find((s) => s.entryId === input.winnerEntryId)!.index;
    return this.matches.walkover(userId, match.id, { winnerSideIndex, reason: input.reason });
  }

  /** A result typed in by staff (trusted; no confirmation needed). */
  async fixtureManualResult(userId: string, fixtureId: string, scores: number[][]): Promise<MatchView> {
    const match = await this.startFixture(userId, fixtureId);
    if (match.status !== 'live' || match.score.segments.some((s) => s.scores.some((n) => n > 0))) {
      throw AppError.conflict('MATCH_STARTED', 'This match is being scored live.');
    }
    await this.matches.invalidate(match.id);
    await this.tx((tx) => this.matches.recordManualResult(tx, match.id, userId, scores));
    await this.matches.invalidate(match.id);
    return this.matches.get(userId, match.id);
  }

  private async assertCanRun(tx: DbTx, userId: string, tournamentId: string, courtId: string | null): Promise<void> {
    const t = await tx.tournament.findUniqueOrThrow({ where: { id: tournamentId }, include: { staff: { where: { userId } } } });
    if (t.organizerUserId === userId || t.staff.length) return;
    if (courtId && (await tx.courtScorer.count({ where: { courtId, userId } }))) return;
    throw AppError.forbidden('NOT_TOURNAMENT_STAFF', 'Only tournament staff can start this match.');
  }

  /**
   * MatchDecidedHook: inside the match's decision transaction, records the fixture outcome,
   * advances the winner (and loser to a 3rd-place match), and once a group is finished fills
   * the knockout slots it feeds.
   */
  async onMatchDecided(tx: DbTx, matchId: string): Promise<void> {
    const fixture = await tx.fixture.findUnique({ where: { matchId }, include: { stage: true, match: { include: { sides: true } } } });
    if (!fixture) return;
    const eventId = fixture.stage.eventId;
    const m = fixture.match!;
    const winner = m.sides.find((s) => s.outcome === 'won');
    const type = (m.resultType ?? 'played') as FixtureResultType;

    const nodes = await this.loadNodes(tx, eventId);
    const before = new Map(nodes.map((n) => [n.key, n]));
    let next: FixtureNode[];
    try {
      next = recordOutcome(nodes, fixture.id, { type, winnerEntryId: winner?.entryId ?? null });
    } catch (error) {
      engineError(error);
    }

    if (fixture.groupId && fixture.stage.type === 'round_robin') {
      const groupDone = (await tx.fixture.findMany({ where: { groupId: fixture.groupId }, select: { id: true } })).every((f) => {
        const n = next.find((x) => x.key === f.id)!;
        return n.status === 'completed' || n.status === 'bye' || n.status === 'cancelled';
      });
      if (groupDone) {
        const ranking = await this.groupStandings(tx, fixture.groupId);
        next = fillGroupQualifiers(next, fixture.groupId, ranking.map((r) => r.entryId));
      }
    }
    await this.saveNodes(tx, eventId, next, before);

    // Stage / event / tournament completion.
    const stages = await tx.tournamentStage.findMany({ where: { eventId }, include: { fixtures: { select: { id: true } } }, orderBy: { sequence: 'asc' } });
    for (const stage of stages) {
      const done = stage.fixtures.every((f) => ['completed', 'bye', 'cancelled'].includes(next.find((n) => n.key === f.id)!.status));
      if (done) await tx.tournamentStage.update({ where: { id: stage.id }, data: { status: 'completed' } });
    }
    if (stages.length && stages.every((s) => s.fixtures.every((f) => ['completed', 'bye', 'cancelled'].includes(next.find((n) => n.key === f.id)!.status)))) {
      await tx.tournamentEvent.update({ where: { id: eventId }, data: { status: 'completed' } });
      const event = await tx.tournamentEvent.findUniqueOrThrow({ where: { id: eventId } });
      const open = await tx.tournamentEvent.count({ where: { tournamentId: event.tournamentId, status: { notIn: ['completed', 'cancelled'] } } });
      if (!open) await tx.tournament.update({ where: { id: event.tournamentId }, data: { status: 'completed' } });
    }
  }

  // ------------------------------------------------------------------------------------------
  // Standings, bracket and fixture lists
  // ------------------------------------------------------------------------------------------

  /** Ranks a round-robin group from its decided matches, with the event's tiebreakers. */
  async groupStandings(db: DbTx, groupId: string): Promise<StandingView[]> {
    const group = await db.stageGroup.findUniqueOrThrow({ where: { id: groupId }, include: { stage: { include: { event: true } }, entries: { include: { entry: true } } } });
    const fixtures = await db.fixture.findMany({
      where: { groupId, match: { status: { in: ['completed', 'retired', 'walkover'] } } },
      include: { match: { include: { sides: { orderBy: { sideIndex: 'asc' } } } } },
    });
    const results: GroupResult[] = fixtures.map((f) => {
      const m = f.match!;
      const totals = (m.summary as unknown as ScoreSummary | null)?.totals ?? { major: [0, 0], minor: [0, 0] };
      return {
        entry1Id: m.sides[0]!.entryId!,
        entry2Id: m.sides[1]!.entryId!,
        winnerEntryId: m.sides.find((s) => s.outcome === 'won')?.entryId ?? null,
        type: (m.resultType ?? 'played') as FixtureResultType,
        major: [totals.major[0] ?? 0, totals.major[1] ?? 0],
        minor: [totals.minor[0] ?? 0, totals.minor[1] ?? 0],
      };
    });
    const ids = group.entries.sort((a, b) => a.position - b.position).map((e) => e.entryId);
    const seeds = new Map(group.entries.map((e) => [e.entryId, e.entry.seed]));
    const names = await this.entryNames(group.stage.eventId, db);
    const table = rankGroup(ids, results, group.stage.event.tiebreakers as Tiebreaker[], seeds);
    return table.map((row) => ({ ...row, name: names.get(row.entryId) ?? '' }));
  }

  /** Everything for an event screen or the public page: entries, stages, groups, standings, fixtures. */
  async eventDetail(userId: string | null, eventId: string) {
    const event = await this.eventWithTournament(eventId);
    const t = event.tournament;
    if (t.visibility === 'private') {
      const staff = userId ? await this.db.tournamentStaff.count({ where: { tournamentId: t.id, userId } }) : 0;
      if (!staff && t.organizerUserId !== userId) throw notFound('event');
    }
    const entries = await this.db.tournamentEntry.findMany({
      where: { eventId },
      orderBy: [{ seed: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
      include: { members: { orderBy: { sortOrder: 'asc' }, include: { player: true } } },
    });
    const stages = await this.db.tournamentStage.findMany({ where: { eventId }, orderBy: { sequence: 'asc' }, include: { groups: { orderBy: { sequence: 'asc' } } } });
    const fixtures = await this.fixtureViews({ stage: { eventId } });
    const ratings = new Map(
      (await this.db.playerRating.findMany({ where: { sportId: event.sportId, playerId: { in: entries.flatMap((e) => e.members.map((m) => m.playerId)) } } })).map(
        (r) => [r.playerId, r.rating],
      ),
    );
    const standings: Record<string, StandingView[]> = {};
    for (const stage of stages) {
      if (stage.type !== 'round_robin') continue;
      for (const g of stage.groups) standings[g.id] = await this.groupStandings(this.db, g.id);
    }
    return {
      id: event.id,
      tournament: { id: t.id, slug: t.slug, name: t.name },
      name: event.name,
      status: event.status,
      sport: { id: String(event.sport.id), slug: event.sport.slug, name: event.sport.name, iconKey: event.sport.iconKey, accentColor: event.sport.accentColor },
      format: { code: event.sportFormat.code, name: event.sportFormat.name, playersPerSide: event.sportFormat.playersPerSide },
      ruleset: { id: event.ruleset.id, name: event.ruleset.name },
      drawFormat: event.format,
      drawConfig: event.formatConfig,
      tiebreakers: event.tiebreakers,
      maxEntries: event.maxEntries,
      entries: entries.map((e) => {
        const values = e.members.map((m) => ratings.get(m.playerId) ?? 1000);
        return {
          id: e.id,
          name: e.name ?? e.members.map((m) => m.player.displayName).join(' / '),
          seed: e.seed,
          status: e.status,
          rating: Math.round(values.reduce((a, b) => a + b, 0) / Math.max(values.length, 1)),
          createdAt: e.createdAt.toISOString(),
          players: e.members.map((m) => ({ playerId: m.player.id, userId: m.player.userId, displayName: m.player.displayName, isGuest: m.player.userId === null })),
        };
      }),
      myEntryId: userId ? entries.find((e) => e.members.some((m) => m.player.userId === userId))?.id ?? null : null,
      podium: podiumOf(fixtures),
      stages: stages.map((s) => ({
        id: s.id,
        sequence: s.sequence,
        type: s.type,
        name: s.name,
        status: s.status,
        groups: s.groups.map((g) => ({ id: g.id, type: g.type, name: g.name, standings: standings[g.id] ?? null })),
      })),
      fixtures,
    };
  }

  async fixtureView(fixtureId: string): Promise<FixtureView> {
    const [view] = await this.fixtureViews({ id: fixtureId });
    if (!view) throw notFound('fixture');
    return view;
  }

  private async fixtureViews(where: Prisma.FixtureWhereInput, take?: number): Promise<FixtureView[]> {
    const entryInclude = { include: { members: { orderBy: { sortOrder: 'asc' }, include: { player: true } } } } as const;
    const rows = await this.db.fixture.findMany({
      where,
      orderBy: [{ stage: { sequence: 'asc' } }, { round: 'asc' }, { position: 'asc' }],
      ...(take ? { take } : {}),
      include: {
        stage: {
          select: {
            eventId: true,
            name: true,
            type: true,
            event: { select: { id: true, name: true, sportId: true, sport: { select: { slug: true, name: true, accentColor: true } } } },
          },
        },
        court: { include: { scorers: true } },
        match: { select: { id: true, status: true, summary: true, shareToken: true } },
        entry1: entryInclude,
        entry2: entryInclude,
      },
    });
    const byId = new Map<string, { roundName: string | null; position: number }>(rows.map((r) => [r.id, r]));
    const groupIds = rows.flatMap((r) => (r.groupId ? [r.groupId] : []));
    const groups = new Map((await this.db.stageGroup.findMany({ where: { id: { in: groupIds } } })).map((g) => [g.id, g.name]));

    // Ratings in each event's sport.
    const playerIds = rows.flatMap((r) => [r.entry1, r.entry2].flatMap((e) => e?.members.map((m) => m.playerId) ?? []));
    const ratings = new Map(
      (await this.db.playerRating.findMany({ where: { playerId: { in: playerIds } } })).map((r) => [`${r.playerId}:${r.sportId}`, r.rating]),
    );
    const scorerNames = await this.userNames(rows.flatMap((r) => r.court?.scorers.map((s) => s.userId) ?? []));

    type EntryRow = NonNullable<(typeof rows)[number]['entry1']>;
    const entryView = (e: EntryRow | null, sportId: number): FixtureEntryView | null => {
      if (!e) return null;
      const values = e.members.map((m) => ratings.get(`${m.playerId}:${sportId}`) ?? 1000);
      return {
        id: e.id,
        name: e.name ?? e.members.map((m) => m.player.displayName).join(' / '),
        seed: e.seed,
        rating: Math.round(values.reduce((a, b) => a + b, 0) / Math.max(values.length, 1)),
        players: e.members.map((m) => ({ playerId: m.player.id, userId: m.player.userId, displayName: m.player.displayName })),
      };
    };

    // Next fixtures, and what feeds their other slot.
    const nextIds = [...new Set(rows.flatMap((r) => (r.nextFixtureId ? [r.nextFixtureId] : [])))];
    const nextRows = new Map((await this.db.fixture.findMany({ where: { id: { in: nextIds } }, include: { entry1: entryInclude, entry2: entryInclude } })).map((n) => [n.id, n]));
    const feederIds = [...nextRows.values()].flatMap((n) =>
      ([n.entry1Source, n.entry2Source] as StoredSource[]).flatMap((s) => (s.kind === 'winner' || s.kind === 'loser' ? [s.fixtureKey] : [])),
    );
    const feeders = new Map(
      (await this.db.fixture.findMany({ where: { id: { in: feederIds } }, include: { entry1: entryInclude, entry2: entryInclude } })).map((f) => [f.id, f]),
    );
    for (const f of feeders.values()) byId.set(f.id, f);
    const groupRankIds = [...nextRows.values(), ...rows].flatMap((n) =>
      ([n.entry1Source, n.entry2Source] as StoredSource[]).flatMap((s) => (s.kind === 'group_rank' && !groups.has(s.groupKey) ? [s.groupKey] : [])),
    );
    if (groupRankIds.length) for (const g of await this.db.stageGroup.findMany({ where: { id: { in: groupRankIds } } })) groups.set(g.id, g.name);

    const nameOf = (e: EntryRow | null) => (e ? e.name ?? e.members.map((m) => m.player.displayName).join(' / ') : null);
    const placeholder = (s: StoredSource, entry: unknown): string | null => {
      if (entry) return null;
      if (s.kind === 'bye' || s.byeArrived) return 'Bye';
      if (s.kind === 'winner' || s.kind === 'loser') {
        const src = byId.get(s.fixtureKey);
        return `${s.kind === 'winner' ? 'Winner' : 'Loser'} of ${src?.roundName ?? 'match'} ${src?.position ?? ''}`.trim();
      }
      if (s.kind === 'group_rank') return `${ordinal(s.rank)} ${groups.get(s.groupKey) ?? 'group'}`;
      return null;
    };
    const opponentFor = (nextId: string, mySlot: number | null): string | null => {
      const n = nextRows.get(nextId);
      if (!n) return null;
      const other = mySlot === 1 ? 2 : 1;
      const entry = other === 1 ? n.entry1 : n.entry2;
      if (entry) return nameOf(entry);
      const source = (other === 1 ? n.entry1Source : n.entry2Source) as StoredSource;
      if (source.kind === 'winner' || source.kind === 'loser') {
        const feeder = feeders.get(source.fixtureKey);
        const names = feeder ? [nameOf(feeder.entry1), nameOf(feeder.entry2)].filter((x): x is string => !!x) : [];
        if (names.length === 2) return names.join(' or ');
      }
      return placeholder(source, null);
    };

    return rows.map((r) => {
      const summary = r.match?.summary as unknown as ScoreSummary | null;
      const sportId = r.stage.event.sportId;
      const next = r.nextFixtureId ? nextRows.get(r.nextFixtureId) : undefined;
      return {
        id: r.id,
        eventId: r.stage.eventId,
        event: { id: r.stage.event.id, name: r.stage.event.name, sport: r.stage.event.sport },
        stageId: r.stageId,
        stageName: r.stage.name,
        stageType: r.stage.type,
        groupId: r.groupId,
        groupName: r.groupId ? groups.get(r.groupId) ?? null : null,
        round: r.round,
        position: r.position,
        roundName: r.roundName,
        status: r.status,
        entries: [entryView(r.entry1, sportId), entryView(r.entry2, sportId)],
        placeholders: [placeholder(r.entry1Source as StoredSource, r.entry1), placeholder(r.entry2Source as StoredSource, r.entry2)],
        winnerEntryId: r.winnerEntryId,
        court: r.court ? { id: r.court.id, name: r.court.name, scorers: r.court.scorers.map((x) => ({ userId: x.userId, name: scorerNames.get(x.userId) ?? null })) } : null,
        scheduledAt: r.scheduledAt?.toISOString() ?? null,
        match: r.match
          ? {
              id: r.match.id,
              shareToken: r.match.shareToken,
              status: r.match.status,
              headline: summary?.headline ?? '',
              winnerSideIndex: summary?.winnerSideIndex ?? null,
              callout: summary?.callout ?? null,
              sides: (summary?.sides ?? []).map((x) => ({ primary: x.primary, current: x.current })),
              segments: (summary?.segments ?? []).map((g) => g.scores),
            }
          : null,
        nextFixtureId: r.nextFixtureId,
        next: next ? { fixtureId: next.id, roundName: next.roundName, position: next.position, opponent: opponentFor(next.id, r.nextFixtureSlot) } : null,
      };
    });
  }

  /** Every fixture of a tournament (Schedule, Court board). Staff only. */
  async tournamentFixtures(userId: string, tournamentId: string): Promise<FixtureView[]> {
    const t = await this.db.tournament.findUnique({ where: { id: tournamentId }, include: { staff: { where: { userId } } } });
    if (!t) throw notFound('tournament');
    if (t.organizerUserId !== userId && !t.staff.length) throw AppError.forbidden('NOT_TOURNAMENT_STAFF', 'Only tournament staff can see the schedule.');
    return this.fixtureViews({ stage: { event: { tournamentId } } });
  }

  /** "My matches": fixtures I play in, my pending entries, and my scoring duties. */
  async myMatches(userId: string) {
    const mine = { members: { some: { player: { userId } } } };
    const [playing, entries, scoring, courts] = await Promise.all([
      this.fixtureViews({ status: { in: ['ready', 'live'] }, OR: [{ entry1: mine }, { entry2: mine }] }),
      this.db.tournamentEntry.findMany({
        where: { status: 'pending', ...mine },
        include: { event: { include: { tournament: { select: { id: true, name: true } }, sport: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.myScorerFixtures(userId),
      this.db.court.findMany({ where: { scorers: { some: { userId } }, tournament: { status: { in: ['registration_closed', 'in_progress'] } } }, select: { id: true, name: true } }),
    ]);
    const upcoming = courts.length
      ? await this.fixtureViews({ status: 'pending', courtId: { in: courts.map((c) => c.id) } }, 5)
      : [];
    return {
      playing,
      pendingEntries: entries.map((e) => ({
        id: e.id,
        event: { id: e.event.id, name: e.event.name, sport: { slug: e.event.sport.slug, accentColor: e.event.sport.accentColor } },
        tournament: e.event.tournament,
      })),
      scoring,
      courts,
      upcoming,
    };
  }

  /** Fixtures a user can score now: staff of the tournament, or scorer of the court. */
  async myScorerFixtures(userId: string): Promise<FixtureView[]> {
    return this.fixtureViews({
      status: { in: ['ready', 'live'] },
      OR: [
        { stage: { event: { tournament: { organizerUserId: userId } } } },
        { stage: { event: { tournament: { staff: { some: { userId } } } } } },
        { court: { scorers: { some: { userId } } } },
      ],
    });
  }
}

function ordinal(n: number): string {
  const suffix = n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th';
  return `${n}${suffix}`;
}

/**
 * Champion, runner-up and third from a finished knockout final (and 3rd-place match). Without a
 * 3rd-place match both losing semi-finalists are third.
 */
function podiumOf(fixtures: FixtureView[]) {
  const knockout = fixtures.filter((f) => f.stageType === 'knockout');
  const final = knockout.find((f) => f.roundName === 'Final');
  if (!final || final.status !== 'completed' || !final.winnerEntryId) return null;
  const entry = (id: string | null | undefined) => knockout.flatMap((f) => f.entries).find((e) => e?.id === id) ?? null;
  const champion = entry(final.winnerEntryId);
  const runnerUp = final.entries.find((e) => e && e.id !== final.winnerEntryId) ?? null;
  const thirdMatch = knockout.find((f) => f.roundName === 'Third place');
  const semis = knockout.filter((f) => f.roundName === 'Semi-final');
  const third = thirdMatch?.winnerEntryId
    ? [entry(thirdMatch.winnerEntryId)]
    : semis.map((f) => f.entries.find((e) => e && e.id !== f.winnerEntryId) ?? null);
  return {
    champion,
    runnerUp,
    third: third.filter((e): e is FixtureEntryView => e !== null),
    final: { matchId: final.match?.id ?? null, headline: final.match?.headline ?? null },
  };
}

/** A readable draw preview: stage -> groups -> fixtures with entry names and seeds. */
function describePlan(plan: DrawPlan, names: Map<string, string>, seeds: Map<string, number | null>) {
  const label = (s: SlotSource) =>
    s.kind === 'entry' ? names.get(s.entryId) ?? s.entryId : s.kind === 'bye' ? 'Bye' : s.kind === 'group_rank' ? `${ordinal(s.rank)} of ${s.groupKey}` : `${s.kind} of ${s.fixtureKey}`;
  const seedOf = (s: SlotSource) => (s.kind === 'entry' ? seeds.get(s.entryId) ?? null : null);
  return plan.stages.map((stage) => ({
    name: stage.name,
    type: stage.type,
    groups: stage.groups.map((g) => ({
      key: g.key,
      name: g.name,
      entries: g.entryIds.map((id) => names.get(id) ?? id),
      seeds: g.entryIds.map((id) => seeds.get(id) ?? null),
    })),
    fixtures: stage.fixtures.map((f) => ({ round: f.round, position: f.position, roundName: f.roundName, slots: f.slots.map(label), seeds: f.slots.map(seedOf) })),
  }));
}
