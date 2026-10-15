import type { Logger } from 'pino';
import type { Db, DbTx } from '../../database/prisma.js';
import { Prisma } from '../../database/prisma.js';
import { ratingSystem } from '../../engine/rating/index.js';
import {
  applyNext,
  createScorer,
  manualResultEvents,
  parseEvent,
  replay,
  scoringRegistry,
  ScoringError,
  type PluginEvent,
  type ScoreSummary,
} from '../../engine/scoring/index.js';
import { AppError } from '../../utils/app-error.js';
import type { ParticipantInput, PlayerRef, PlayersService } from '../players/players.service.js';
import { LivePersister } from './live/live-persister.js';
import { MemoryLiveStore, type LiveEvent, type LiveState, type LiveStore, type PersistJob } from './live/live-store.js';
import {
  activeEvents,
  findMatchRecord,
  loadLiveState,
  newShareToken,
  scorerFor,
  summaryOf,
  syncSegments,
  toStatic,
  versionOf,
} from './matches.db.js';
import type { ConfirmationView, MatchCard, MatchStatusName, MatchView, RatingChange, ResultTypeName } from './matches.types.js';
import type { CreateMatchInput, ScoreEventInput } from './matches.validation.js';
import { rebuildPlayerStats, rebuildTeamStats } from './stats.js';

/** Called inside the transaction that decides a match (tournaments advance the winner). */
export interface MatchDecidedHook {
  onMatchDecided(tx: DbTx, matchId: string): Promise<void>;
}

export interface MatchesServiceDeps {
  db: Db;
  players: PlayersService;
  live?: LiveStore;
  /** Answer scoring requests once the (shared, durable) live store has the change; write Postgres after. */
  persistInBackground?: boolean;
  logger?: Pick<Logger, 'error'>;
}

/** Remote Postgres (Neon) round trips are slow; give multi-step transactions room. */
export const TX_OPTIONS = { maxWait: 20_000, timeout: 60_000 } as const;

const POST_TYPE_MATCH_RESULT = 801;
const POST_VISIBILITY_PUBLIC = 1201;
const LIVE_LIST_LIMIT = 30;

/** Engine errors as API errors. */
export function toAppError(error: unknown): never {
  if (error instanceof ScoringError) {
    switch (error.code) {
      case 'MATCH_COMPLETE':
        throw AppError.conflict('MATCH_OVER', error.message);
      case 'INVALID_EVENT':
        throw AppError.badRequest('INVALID_EVENT', error.message);
      case 'INVALID_RESULT':
        throw AppError.badRequest('INVALID_RESULT', error.message);
      default:
        throw AppError.badRequest('VALIDATION_ERROR', 'Some fields are invalid.', { rules: [error.message] });
    }
  }
  throw error;
}

const staleMatch = () => AppError.conflict('STALE_MATCH', 'The score changed since you last saw it. Showing the latest score.');
const notFound = () => AppError.notFound('MATCH_NOT_FOUND', 'This match does not exist.');

interface Decision {
  status: Extract<MatchStatusName, 'completed' | 'retired' | 'walkover'>;
  resultType: ResultTypeName;
  winnerSideIndex: number | null;
  summary: ScoreSummary;
}

export interface NewMatch {
  sportId: number;
  sportFormatId: string;
  rulesetId: string | null;
  scoringModel: string;
  config: unknown;
  context: 'friendly' | 'tournament';
  createdByUserId: string;
  venueId?: string | null;
  courtId?: string | null;
  sides: Array<{ name?: string | null; teamId?: string | null; entryId?: string | null; playerIds: string[] }>;
}

export class MatchesService {
  private readonly live: LiveStore;
  private readonly persister: LivePersister;
  private decidedHook: MatchDecidedHook | null = null;

  constructor(private readonly deps: MatchesServiceDeps) {
    this.live = deps.live ?? new MemoryLiveStore();
    this.persister = new LivePersister(this.live, (matchId, job) => this.persistJob(matchId, job), deps.logger);
  }

  setDecidedHook(hook: MatchDecidedHook): void {
    this.decidedHook = hook;
  }

  /** Writes to Postgres whatever was scored but not yet saved before the last shutdown. */
  resumePending(): Promise<void> {
    return this.persister.resume();
  }

  private tx<T>(work: (tx: DbTx) => Promise<T>): Promise<T> {
    return this.deps.db.$transaction(work, TX_OPTIONS);
  }

  // ------------------------------------------------------------------------------------------
  // Creating matches
  // ------------------------------------------------------------------------------------------

  /** Quick start (live scoring) or a result entered afterwards (manualScores). */
  async createFriendly(userId: string, input: CreateMatchInput): Promise<MatchView> {
    const { db, players } = this.deps;
    const sport = await db.sport.findUnique({ where: { slug: input.sport }, include: { formats: true, rulesets: true } });
    if (!sport?.isActive) throw AppError.badRequest('VALIDATION_ERROR', 'Some fields are invalid.', { sport: ['Unknown sport'] });
    const format = sport.formats.find((f) => f.code === input.format && f.isActive);
    if (!format) throw AppError.badRequest('VALIDATION_ERROR', 'Some fields are invalid.', { format: [`${sport.name} has no ${input.format} format`] });
    const ruleset = input.rulesetId ? sport.rulesets.find((r) => r.id === input.rulesetId) : sport.rulesets.find((r) => r.isDefault);
    if (!ruleset?.isActive || !scoringRegistry.has(ruleset.scoringModel)) {
      throw AppError.badRequest('VALIDATION_ERROR', 'Some fields are invalid.', { rulesetId: ['Unknown rules for this sport'] });
    }
    for (const side of input.sides) {
      if (side.players.length < format.minPerSide || side.players.length > format.maxPerSide) {
        throw AppError.badRequest('VALIDATION_ERROR', 'Some fields are invalid.', {
          sides: [`${sport.name} ${format.name.toLowerCase()} needs ${format.playersPerSide} player${format.playersPerSide > 1 ? 's' : ''} per side`],
        });
      }
    }

    const matchId = await this.tx(async (tx) => {
      const resolved: PlayerRef[][] = [];
      for (const side of input.sides) resolved.push(await players.resolve(userId, side.players as ParticipantInput[], tx));
      const ids = resolved.flat().map((p) => p.playerId);
      if (new Set(ids).size !== ids.length) throw AppError.badRequest('VALIDATION_ERROR', 'Some fields are invalid.', { sides: ['A player can only be on one side, once'] });

      const id = await this.createMatchRecord(tx, {
        sportId: sport.id,
        sportFormatId: format.id,
        rulesetId: ruleset.id,
        scoringModel: ruleset.scoringModel,
        config: { ...(ruleset.config as object), ...(input.rulesOverride ?? {}) },
        context: 'friendly',
        createdByUserId: userId,
        venueId: input.venueId ?? null,
        sides: input.sides.map((side, i) => ({ name: side.name ?? null, teamId: side.teamId ?? null, playerIds: resolved[i]!.map((p) => p.playerId) })),
      });
      if (input.manualScores) await this.recordManualResult(tx, id, userId, input.manualScores);
      return id;
    });
    return this.get(userId, matchId);
  }

  /**
   * Inserts a live match with its sides and participants. The ruleset config is validated by the
   * plugin and snapshotted (defaults filled) so later ruleset edits never change this match.
   */
  async createMatchRecord(tx: DbTx, m: NewMatch): Promise<string> {
    const sides = m.sides.map((s, index) => ({ index, playerCount: s.playerIds.length }));
    let config: unknown;
    let initial: ScoreSummary;
    try {
      const scorer = createScorer(scoringRegistry, m.scoringModel, m.config, sides);
      config = scorer.config;
      initial = replay(scorer, []).summary;
    } catch (error) {
      toAppError(error);
    }
    const match = await tx.match.create({
      data: {
        sportId: m.sportId,
        sportFormatId: m.sportFormatId,
        rulesetId: m.rulesetId,
        scoringModel: m.scoringModel,
        rulesetConfig: config as Prisma.InputJsonValue,
        context: m.context,
        status: 'live',
        startedAt: new Date(),
        venueId: m.venueId ?? null,
        courtId: m.courtId ?? null,
        shareToken: newShareToken(),
        createdByUserId: m.createdByUserId,
        summary: initial as unknown as Prisma.InputJsonValue,
      },
    });
    const sideIds: string[] = [];
    for (const [index, side] of m.sides.entries()) {
      const created = await tx.matchSide.create({
        data: { matchId: match.id, sideIndex: index, name: side.name ?? null, teamId: side.teamId ?? null, entryId: side.entryId ?? null },
      });
      sideIds.push(created.id);
      await tx.matchParticipant.createMany({
        data: side.playerIds.map((playerId, sortOrder) => ({ matchId: match.id, sideId: created.id, playerId, sortOrder })),
      });
    }
    await syncSegments(tx, match.id, sideIds, initial.segments);
    return match.id;
  }

  /** Replays typed-in game/set scores as events, then decides the match. */
  async recordManualResult(tx: DbTx, matchId: string, userId: string, scores: number[][]): Promise<void> {
    const state = await loadLiveState(tx, matchId);
    if (!state) throw notFound();
    let events: PluginEvent[];
    let summary: ScoreSummary;
    try {
      const scorer = scorerFor(state.match.scoringModel, state.match.rulesetConfig, state.match.view);
      events = manualResultEvents(scorer, scores);
      summary = replay(scorer, events).summary;
    } catch (error) {
      toAppError(error);
    }
    const sides = await tx.matchSide.findMany({ where: { matchId }, orderBy: { sideIndex: 'asc' } });
    const now = new Date();
    await tx.matchEvent.createMany({
      data: events.map((event, i) => {
        const sideIndex = (event as { sideIndex?: unknown }).sideIndex;
        return {
          matchId,
          sequence: i + 1,
          type: event.type,
          sideId: typeof sideIndex === 'number' ? sides[sideIndex]!.id : null,
          payload: event as unknown as Prisma.InputJsonValue,
          actorUserId: userId,
          occurredAt: now,
        };
      }),
    });
    await tx.match.update({ where: { id: matchId }, data: { scoringMode: 'manual' } });
    const next: LiveState = { ...state, version: events.length, match: { ...state.match, view: { ...state.match.view, scoringMode: 'manual' } } };
    await this.decide(tx, next, { status: 'completed', resultType: 'played', winnerSideIndex: summary.winnerSideIndex, summary });
  }

  // ------------------------------------------------------------------------------------------
  // Reading
  // ------------------------------------------------------------------------------------------

  async get(userId: string | null, matchId: string): Promise<MatchView> {
    const state = await this.loadLive(matchId);
    if (!state) throw notFound();
    return this.view(userId, state);
  }

  async getByShareToken(token: string): Promise<MatchView> {
    const match = await this.deps.db.match.findUnique({ where: { shareToken: token }, select: { id: true } });
    if (!match) throw notFound();
    return this.get(null, match.id);
  }

  /** Live matches I play in, created, may score, or that players I follow are playing. */
  async listLive(userId: string): Promise<MatchCard[]> {
    const { db } = this.deps;
    const follows = await db.$queryRaw<Array<{ id: string }>>`
      SELECT following_id AS id FROM usr_user_follow WHERE follower_id = ${userId}::uuid AND status_id = 1`;
    const userIds = [userId, ...follows.map((f) => f.id)];
    const matches = await db.match.findMany({
      where: {
        status: 'live',
        OR: [{ createdByUserId: userId }, { scorers: { some: { userId } } }, { participants: { some: { player: { userId: { in: userIds } } } } }],
      },
      include: { sport: true, sides: { orderBy: { sideIndex: 'asc' }, include: { participants: { include: { player: true }, orderBy: { sortOrder: 'asc' } } } } },
      orderBy: { updatedAt: 'desc' },
      take: LIVE_LIST_LIMIT,
    });
    const cached = await this.live.getMany(matches.map((m) => m.id));
    return matches.map((m) => {
      const state = cached.get(m.id);
      return toCard(m, state ? summaryOf(state) : (m.summary as unknown as ScoreSummary), userId);
    });
  }

  /** Manually entered results waiting for me (as the opponent) to confirm. */
  async pendingConfirmations(userId: string): Promise<MatchCard[]> {
    const { db } = this.deps;
    const matches = await db.match.findMany({
      where: { verification: 'pending', participants: { some: { player: { userId } } }, NOT: { createdByUserId: userId } },
      include: { sport: true, sides: { orderBy: { sideIndex: 'asc' }, include: { participants: { include: { player: true }, orderBy: { sortOrder: 'asc' } } } } },
      orderBy: { completedAt: 'desc' },
      take: 50,
    });
    return matches.map((m) => toCard(m, m.summary as unknown as ScoreSummary, userId));
  }

  // ------------------------------------------------------------------------------------------
  // Scoring
  // ------------------------------------------------------------------------------------------

  score(userId: string, matchId: string, input: ScoreEventInput): Promise<MatchView> {
    return this.commitLive(userId, matchId, input.version, (state) => {
      if (input.clientEventId && state.events.some((e) => e.clientEventId === input.clientEventId)) return null;
      const scorer = scorerFor(state.match.scoringModel, state.match.rulesetConfig, state.match.view);
      let event: PluginEvent;
      try {
        event = parseEvent(scorer.plugin, input.event);
        applyNext(scorer, activeEvents(state.events), event);
      } catch (error) {
        toAppError(error);
      }
      const sideIndex = (event as { sideIndex?: unknown }).sideIndex;
      const stored: LiveEvent = {
        sequence: state.events.length + 1,
        type: event.type,
        sideIndex: typeof sideIndex === 'number' ? sideIndex : null,
        payload: event as unknown as Record<string, unknown>,
        clientEventId: input.clientEventId ?? null,
        occurredAt: new Date().toISOString(),
        voided: false,
      };
      return { events: [...state.events, stored], job: { kind: 'event', event: stored, actorUserId: userId } };
    });
  }

  undo(userId: string, matchId: string, version: number): Promise<MatchView> {
    return this.commitLive(userId, matchId, version, (state) => {
      const index = state.events.findLastIndex((e) => !e.voided);
      if (index < 0) throw AppError.badRequest('NOTHING_TO_UNDO', 'There is nothing to undo.');
      const events = state.events.map((e, i) => (i === index ? { ...e, voided: true } : e));
      return { events, job: { kind: 'undo', sequence: state.events[index]!.sequence, actorUserId: userId } };
    });
  }

  /** Saves a decided match: result, sides, stats, ratings, feed post, tournament advancement. */
  async complete(userId: string, matchId: string, version: number): Promise<MatchView> {
    await this.persister.flush(matchId);
    await this.tx(async (tx) => {
      const state = await this.lockForScoring(tx, userId, matchId, version);
      const summary = summaryOf(state);
      if (!summary.complete) throw AppError.conflict('MATCH_NOT_FINISHED', 'The match is not over yet.');
      await this.decide(tx, state, { status: 'completed', resultType: 'played', winnerSideIndex: summary.winnerSideIndex, summary });
    });
    await this.live.drop(matchId);
    return this.get(userId, matchId);
  }

  /** A side retires (injury ...): the score so far stands and the other side wins. */
  async retire(userId: string, matchId: string, input: { version: number; retiredSideIndex: number }): Promise<MatchView> {
    await this.persister.flush(matchId);
    await this.tx(async (tx) => {
      const state = await this.lockForScoring(tx, userId, matchId, input.version);
      if (input.retiredSideIndex >= state.match.view.sides.length) throw AppError.badRequest('VALIDATION_ERROR', 'Some fields are invalid.', { retiredSideIndex: ['No such side'] });
      const winner = input.retiredSideIndex === 0 ? 1 : 0;
      const summary: ScoreSummary = { ...summaryOf(state), complete: true, winnerSideIndex: winner, callout: 'Retired', actions: [] };
      await this.decide(tx, state, { status: 'retired', resultType: 'retired', winnerSideIndex: winner, summary });
    });
    await this.live.drop(matchId);
    return this.get(userId, matchId);
  }

  /** Walkover / no-show before any point was played; null winner = double walkover. */
  async walkover(userId: string, matchId: string, input: { winnerSideIndex: number | null; reason: 'walkover' | 'no_show' }): Promise<MatchView> {
    await this.persister.flush(matchId);
    await this.tx(async (tx) => {
      const state = await this.lockForScoring(tx, userId, matchId, null);
      if (activeEvents(state.events).length) throw AppError.conflict('MATCH_STARTED', 'Points were already played; record a retirement instead.');
      const scorer = scorerFor(state.match.scoringModel, state.match.rulesetConfig, state.match.view);
      const base = replay(scorer, []).summary;
      const credit = scorer.plugin.walkoverScore?.(scorer.config) ?? { major: 1, minor: 0 };
      const per = (amount: number) => base.sides.map((s) => (s.index === input.winnerSideIndex ? amount : 0));
      const summary: ScoreSummary = {
        ...base,
        complete: true,
        winnerSideIndex: input.winnerSideIndex,
        callout: input.winnerSideIndex === null ? 'Double walkover' : input.reason === 'no_show' ? 'No-show' : 'Walkover',
        headline: 'W/O',
        segments: [],
        sides: base.sides.map((s) => ({ ...s, serving: false, current: null })),
        totals: { ...base.totals, major: per(credit.major), minor: per(credit.minor) },
        actions: [],
      };
      const resultType: ResultTypeName = input.winnerSideIndex === null ? 'double_walkover' : input.reason;
      await this.decide(tx, state, { status: 'walkover', resultType, winnerSideIndex: input.winnerSideIndex, summary });
    });
    await this.live.drop(matchId);
    return this.get(userId, matchId);
  }

  /** Ends a friendly without a result; nothing counts. */
  async abandon(userId: string, matchId: string): Promise<MatchView> {
    await this.persister.flush(matchId);
    await this.tx(async (tx) => {
      const state = await this.lockForScoring(tx, userId, matchId, null);
      if (state.match.view.context === 'tournament') throw AppError.conflict('TOURNAMENT_MATCH', 'Tournament matches end with a result, a walkover or a retirement.');
      await tx.match.update({ where: { id: matchId }, data: { status: 'abandoned', completedAt: new Date(), summary: summaryOf(state) as unknown as Prisma.InputJsonValue } });
    });
    await this.live.drop(matchId);
    return this.get(userId, matchId);
  }

  /** Lets another user score this match (creator or tournament organizer only). */
  async addScorer(userId: string, matchId: string, scorerUserId: string): Promise<MatchView> {
    const state = await this.loadLive(matchId);
    if (!state) throw notFound();
    const isOrganizer = state.match.view.tournament !== null && state.match.scorerUserIds.includes(userId) && (await this.isOrganizer(userId, state.match.view.tournament.tournamentId));
    if (state.match.view.createdByUserId !== userId && !isOrganizer) throw AppError.forbidden('NOT_ALLOWED', 'Only the match creator or the organizer can add scorers.');
    await this.deps.db.matchScorer.upsert({
      where: { matchId_userId: { matchId, userId: scorerUserId } },
      create: { matchId, userId: scorerUserId, assignedByUserId: userId },
      update: {},
    });
    await this.invalidate(matchId);
    return this.get(userId, matchId);
  }

  /** Drops the cached live state so the next read reloads (e.g. scorers changed). */
  async invalidate(matchId: string): Promise<void> {
    await this.persister.flush(matchId);
    await this.live.drop(matchId);
  }

  private async isOrganizer(userId: string, tournamentId: string): Promise<boolean> {
    const t = await this.deps.db.tournament.findUnique({ where: { id: tournamentId }, include: { staff: { where: { userId } } } });
    return !!t && (t.organizerUserId === userId || t.staff.some((s) => s.role === 'organizer' || s.role === 'co_organizer'));
  }

  // ------------------------------------------------------------------------------------------
  // Opponent confirmation of manual results
  // ------------------------------------------------------------------------------------------

  async confirm(userId: string, matchId: string, input: { decision: 'confirmed' | 'disputed'; comment?: string | undefined }): Promise<MatchView> {
    await this.tx(async (tx) => {
      await tx.$queryRaw`SELECT id FROM matches WHERE id = ${matchId}::uuid FOR UPDATE`;
      const m = await findMatchRecord(tx, matchId);
      if (!m) throw notFound();
      if (m.verification !== 'pending') throw AppError.conflict('NOT_PENDING', 'This result is not waiting for confirmation.');
      const side = confirmerSide(m, userId);
      if (!side) throw AppError.forbidden('NOT_OPPONENT', 'Only an opponent in this match can confirm the result.');
      const player = side.participants.find((p) => p.player.userId === userId)!.player;
      await tx.matchConfirmation.create({ data: { matchId, sideId: side.id, playerId: player.id, userId, decision: input.decision, comment: input.comment ?? null } });
      if (input.decision === 'confirmed') {
        await tx.match.update({ where: { id: matchId }, data: { verification: 'confirmed' } });
        await this.applyRatings(tx, matchId);
      } else {
        await tx.match.update({ where: { id: matchId }, data: { verification: 'disputed', status: 'disputed' } });
        await rebuildPlayerStats(tx, m.sides.flatMap((s) => s.participants.map((p) => p.playerId)), m.sportId);
        await rebuildTeamStats(tx, m.sides.flatMap((s) => (s.teamId ? [s.teamId] : [])));
      }
    });
    return this.get(userId, matchId);
  }

  // ------------------------------------------------------------------------------------------
  // Internals
  // ------------------------------------------------------------------------------------------

  /**
   * Writes the decision: status, result, side outcomes, segments, records, ratings (when the
   * result is trusted), the feed post and tournament advancement, all in the caller's transaction.
   */
  private async decide(tx: DbTx, state: LiveState, d: Decision): Promise<void> {
    const matchId = state.match.id;
    const view = state.match.view;
    const m = await findMatchRecord(tx, matchId);
    if (!m) throw notFound();
    const manualFriendly = view.scoringMode === 'manual' && view.context === 'friendly';
    const verification = manualFriendly && hasConfirmer(m) ? 'pending' : 'not_required';

    await tx.match.update({
      where: { id: matchId },
      data: {
        status: d.status,
        resultType: d.resultType,
        completedAt: new Date(),
        summary: d.summary as unknown as Prisma.InputJsonValue,
        version: state.version,
        verification,
      },
    });
    for (const side of m.sides) {
      const outcome = d.winnerSideIndex === null ? (d.resultType === 'double_walkover' ? 'lost' : 'drawn') : side.sideIndex === d.winnerSideIndex ? 'won' : 'lost';
      await tx.matchSide.update({ where: { id: side.id }, data: { outcome } });
    }
    await syncSegments(tx, matchId, m.sides.map((s) => s.id), d.summary.segments);
    await rebuildPlayerStats(tx, m.sides.flatMap((s) => s.participants.map((p) => p.playerId)), m.sportId);
    await rebuildTeamStats(tx, m.sides.flatMap((s) => (s.teamId ? [s.teamId] : [])));
    if (verification === 'not_required' && !manualFriendly) await this.applyRatings(tx, matchId);

    if (d.resultType === 'played' || d.resultType === 'retired') {
      await tx.$executeRaw`
        INSERT INTO social_post (user_id, post_type_id, match_id, content, visibility_id)
        VALUES (${m.createdByUserId}::uuid, ${POST_TYPE_MATCH_RESULT}, ${matchId}::uuid, ${resultLine(view, d)}, ${POST_VISIBILITY_PUBLIC})
        ON CONFLICT (match_id) DO NOTHING`;
    }
    await this.decidedHook?.onMatchDecided(tx, matchId);
  }

  /**
   * Updates ratings once per match, only when everyone is a registered player and the match was
   * really played (not a walkover). Guests and walkovers never move ratings.
   */
  private async applyRatings(tx: DbTx, matchId: string): Promise<void> {
    if (await tx.playerRatingHistory.count({ where: { matchId } })) return;
    const m = await tx.match.findUniqueOrThrow({
      where: { id: matchId },
      include: { sides: { orderBy: { sideIndex: 'asc' }, include: { participants: { include: { player: true } } } } },
    });
    if (m.resultType !== 'played' && m.resultType !== 'retired') return;
    if (m.sides.length !== 2) return;
    const all = m.sides.flatMap((s) => s.participants.map((p) => p.player));
    if (!all.length || all.some((p) => p.userId === null)) return;
    const winner = m.sides.findIndex((s) => s.outcome === 'won');
    const ids = all.map((p) => p.id);
    await tx.$queryRaw`SELECT player_id FROM player_ratings WHERE sport_id = ${m.sportId} AND player_id = ANY(${ids}::uuid[]) FOR UPDATE`;
    const current = new Map((await tx.playerRating.findMany({ where: { sportId: m.sportId, playerId: { in: ids } } })).map((r) => [r.playerId, r]));
    const sideState = (i: number) => ({
      players: m.sides[i]!.participants.map((p) => {
        const r = current.get(p.playerId);
        return { playerId: p.playerId, rating: r?.rating ?? ratingSystem.initialRating, deviation: r?.deviation ?? null, volatility: r?.volatility ?? null, ratedMatches: r?.ratedMatches ?? 0 };
      }),
    });
    const updates = ratingSystem.rate([sideState(0), sideState(1)], winner === -1 ? null : (winner as 0 | 1));
    const now = new Date();
    for (const u of updates) {
      await tx.playerRating.upsert({
        where: { playerId_sportId: { playerId: u.playerId, sportId: m.sportId } },
        create: { playerId: u.playerId, sportId: m.sportId, system: ratingSystem.key, rating: u.after, deviation: u.deviationAfter, volatility: u.volatility, ratedMatches: 1, lastRatedAt: now },
        update: { rating: u.after, deviation: u.deviationAfter, volatility: u.volatility, ratedMatches: { increment: 1 }, lastRatedAt: now },
      });
      await tx.playerRatingHistory.create({
        data: { playerId: u.playerId, sportId: m.sportId, matchId, system: ratingSystem.key, ratingBefore: u.before, ratingAfter: u.after, deviationBefore: u.deviationBefore, deviationAfter: u.deviationAfter },
      });
    }
  }

  private canScore(userId: string | null, state: LiveState): boolean {
    if (!userId || state.match.status !== 'live') return false;
    return state.match.view.createdByUserId === userId || state.match.scorerUserIds.includes(userId);
  }

  /** Locks the match row, checks the caller may score and saw the latest version (null = any). */
  private async lockForScoring(tx: DbTx, userId: string, matchId: string, version: number | null): Promise<LiveState> {
    await tx.$queryRaw`SELECT id FROM matches WHERE id = ${matchId}::uuid FOR UPDATE`;
    const state = await loadLiveState(tx, matchId);
    if (!state) throw notFound();
    if (state.match.status !== 'live') throw AppError.conflict('MATCH_NOT_LIVE', 'This match has already ended.');
    if (!this.canScore(userId, state)) throw AppError.forbidden('NOT_MATCH_SCORER', 'You are not a scorer for this match.');
    if (version !== null && state.version !== version) throw staleMatch();
    return state;
  }

  /** The live store's copy, loaded from Postgres on a miss. Only live matches are cached. */
  private async loadLive(matchId: string): Promise<LiveState | null> {
    const cached = await this.live.get(matchId);
    if (cached) return cached;
    await this.persister.flush(matchId);
    const state = await loadLiveState(this.deps.db, matchId);
    if (!state) return null;
    return state.match.status === 'live' ? this.live.prime(state) : state;
  }

  private async commitLive(
    userId: string,
    matchId: string,
    version: number,
    change: (state: LiveState) => { events: LiveEvent[]; job: PersistJob } | null,
  ): Promise<MatchView> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const state = await this.loadLive(matchId);
      if (!state) throw notFound();
      if (state.match.status !== 'live') throw AppError.conflict('MATCH_NOT_LIVE', 'This match has already ended.');
      if (!this.canScore(userId, state)) throw AppError.forbidden('NOT_MATCH_SCORER', 'You are not a scorer for this match.');
      const result = change(state);
      if (result === null) return this.view(userId, state); // a retried request already counted
      if (state.version !== version) throw staleMatch();
      const next: LiveState = { ...state, version: state.version + 1, events: result.events };
      const outcome = await this.live.commit(state.version, next, result.job);
      if (outcome === 'stale') throw staleMatch();
      if (outcome === 'ok') {
        if (this.deps.persistInBackground) this.persister.kick(matchId);
        else await this.persister.flush(matchId);
        return this.view(userId, next);
      }
    }
    throw staleMatch();
  }

  /** Writes one queued live change to Postgres. Idempotent; skipped once the match has ended. */
  private async persistJob(matchId: string, job: PersistJob): Promise<void> {
    await this.tx(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ status: string }>>`SELECT status::text AS status FROM matches WHERE id = ${matchId}::uuid FOR UPDATE`;
      if (locked[0]?.status !== 'live') return;
      const sides = await tx.matchSide.findMany({ where: { matchId }, orderBy: { sideIndex: 'asc' } });
      const rows = await tx.matchEvent.findMany({ where: { matchId }, orderBy: { sequence: 'asc' }, select: { id: true, sequence: true, voidedAt: true } });
      if (job.kind === 'undo') {
        const target = rows.find((r) => r.sequence === job.sequence);
        if (!target || target.voidedAt) return;
        await tx.matchEvent.update({ where: { id: target.id }, data: { voidedAt: new Date(), voidedByUserId: job.actorUserId } });
      } else {
        if (rows.some((r) => r.sequence === job.event.sequence)) return;
        if (job.event.sequence !== rows.length + 1) throw new Error(`Live event ${job.event.sequence} for match ${matchId} does not follow event ${rows.length}`);
        await tx.matchEvent.create({
          data: {
            matchId,
            sequence: job.event.sequence,
            type: job.event.type,
            sideId: job.event.sideIndex === null ? null : sides[job.event.sideIndex]!.id,
            payload: job.event.payload as Prisma.InputJsonValue,
            actorUserId: job.actorUserId,
            clientEventId: job.event.clientEventId,
            occurredAt: new Date(job.event.occurredAt),
          },
        });
      }
      const state = await loadLiveState(tx, matchId);
      const summary = summaryOf(state!);
      await syncSegments(tx, matchId, sides.map((s) => s.id), summary.segments);
      await tx.match.update({ where: { id: matchId }, data: { version: versionOf(state!.events), summary: summary as unknown as Prisma.InputJsonValue } });
    });
  }

  private async view(userId: string | null, state: LiveState): Promise<MatchView> {
    const { view } = state.match;
    const live = state.match.status === 'live';
    if (live) {
      return {
        ...view,
        status: 'live',
        resultType: null,
        score: summaryOf(state),
        version: state.version,
        canScore: this.canScore(userId, state),
        startedAt: state.match.startedAt,
        completedAt: null,
        ratingChanges: [],
        confirmation: { status: 'not_required', canConfirm: false, decisions: [] },
      };
    }
    const { db } = this.deps;
    const m = await findMatchRecord(db, state.match.id);
    if (!m) throw notFound();
    const history = await db.playerRatingHistory.findMany({ where: { matchId: m.id } });
    const confirmations = await db.matchConfirmation.findMany({ where: { matchId: m.id }, include: { side: true, player: true } });
    const ratingChanges: RatingChange[] = history.map((h) => ({ playerId: h.playerId, before: h.ratingBefore, after: h.ratingAfter }));
    const confirmation: ConfirmationView = {
      status: m.verification,
      canConfirm: m.verification === 'pending' && userId !== null && confirmerSide(m, userId) !== null,
      decisions: confirmations.map((c) => ({ sideIndex: c.side.sideIndex, displayName: c.player.displayName, decision: c.decision, comment: c.comment, decidedAt: c.decidedAt.toISOString() })),
    };
    return {
      ...toStatic(m),
      status: m.status as MatchStatusName,
      resultType: m.resultType,
      score: (m.summary as unknown as ScoreSummary | null) ?? summaryOf(state),
      version: state.version,
      canScore: false,
      startedAt: m.startedAt?.toISOString() ?? null,
      completedAt: m.completedAt?.toISOString() ?? null,
      ratingChanges,
      confirmation,
    };
  }
}

type SideWithPlayers = { id: string; sideIndex: number; participants: Array<{ player: { id: string; userId: string | null } }> };

function creatorSideIndex(m: { createdByUserId: string; sides: SideWithPlayers[] }): number | null {
  const side = m.sides.find((s) => s.participants.some((p) => p.player.userId === m.createdByUserId));
  return side ? side.sideIndex : null;
}

/** The side of `userId` if they are a registered opponent of whoever entered the result. */
function confirmerSide<S extends SideWithPlayers>(m: { createdByUserId: string; sides: S[] }, userId: string): S | null {
  if (userId === m.createdByUserId) return null;
  const creatorSide = creatorSideIndex(m);
  const side = m.sides.find((s) => s.participants.some((p) => p.player.userId === userId));
  return side && side.sideIndex !== creatorSide ? side : null;
}

function hasConfirmer(m: { createdByUserId: string; sides: SideWithPlayers[] }): boolean {
  const creatorSide = creatorSideIndex(m);
  return m.sides.some((s) => s.sideIndex !== creatorSide && s.participants.some((p) => p.player.userId !== null && p.player.userId !== m.createdByUserId));
}

function resultLine(view: LiveState['match']['view'], d: Decision): string {
  if (d.winnerSideIndex === null) return `${view.sides.map((s) => s.name).join(' v ')} · ${view.sport.name}`;
  const winner = view.sides[d.winnerSideIndex]!;
  const loser = view.sides.find((s) => s.index !== d.winnerSideIndex)!;
  const suffix = d.resultType === 'retired' ? ' (ret.)' : '';
  return `${winner.name} beat ${loser.name} ${d.summary.headline}${suffix} · ${view.sport.name}`;
}

type CardRecord = {
  id: string;
  context: 'friendly' | 'tournament';
  status: string;
  createdByUserId: string;
  startedAt: Date | null;
  updatedAt: Date;
  sport: { id: number; slug: string; name: string; iconKey: string; accentColor: string };
  sides: Array<{ sideIndex: number; name: string | null; outcome: 'won' | 'lost' | 'drawn' | null; participants: Array<{ player: { displayName: string; userId: string | null } }> }>;
};

export function toCard(m: CardRecord, score: ScoreSummary, userId: string | null): MatchCard {
  return {
    id: m.id,
    context: m.context,
    status: m.status as MatchStatusName,
    sport: { id: String(m.sport.id), slug: m.sport.slug, name: m.sport.name, iconKey: m.sport.iconKey, accentColor: m.sport.accentColor },
    sides: m.sides.map((s) => ({
      index: s.sideIndex,
      name: s.name ?? s.participants.map((p) => p.player.displayName.split(' ')[0]).join(' & '),
      outcome: s.outcome,
    })),
    score: {
      headline: score.headline,
      complete: score.complete,
      winnerSideIndex: score.winnerSideIndex,
      callout: score.callout,
      sides: score.sides.map((s) => ({ index: s.index, primary: s.primary, current: s.current, serving: s.serving })),
    },
    mine: userId !== null && (m.createdByUserId === userId || m.sides.some((s) => s.participants.some((p) => p.player.userId === userId))),
    startedAt: m.startedAt?.toISOString() ?? null,
    updatedAt: m.updatedAt.toISOString(),
  };
}
