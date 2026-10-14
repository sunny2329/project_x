import type pg from 'pg';
import type { Logger } from 'pino';
import type { Queryable } from '../../database/pool.js';
import { withTransaction } from '../../database/pool.js';
import { AppError } from '../../utils/app-error.js';
import { DEFAULT_RATING } from '../profile/profile.types.js';
import { MatchStatus, ResultType, ScoreEventType } from './match.codes.js';
import { LivePersister } from './live/live-persister.js';
import { MemoryLiveStore, type LiveEvent, type LiveState, type LiveStore, type PersistJob } from './live/live-store.js';
import type { EventRow, MatchRepository, MatchRow } from './match.repository.js';
import type { MatchCard, MatchDetail, MatchSide, SportSetup } from './match.types.js';
import type { CreateMatchInput, ScoreEventInput } from './match.validation.js';
import { average, eloChange } from './rating.js';
import { replay, ScoringError, type ScoreEvent, type ScoreView, type Side } from './scoring/index.js';
import { applyOptions, SPORT_RULES } from './scoring/sport-rules.js';

export interface MatchServiceDeps {
  pool: pg.Pool;
  repository: MatchRepository;
  /** Where live matches are kept and scored (Redis in production). Defaults to process memory. */
  live?: LiveStore;
  /**
   * Answer scoring requests as soon as the live store has the change and write Postgres afterwards.
   * Only safe when the live store is durable and shared (Redis); otherwise each request waits for Postgres.
   */
  persistInBackground?: boolean;
  logger?: Pick<Logger, 'error'>;
}

type StoredEvent = Pick<EventRow, 'typeId' | 'side' | 'data' | 'isUndone'>;

const LIVE_LIST_LIMIT = 20;

const EVENT_TYPE_ID: Record<ScoreEvent['type'], number> = {
  point: ScoreEventType.POINT,
  goal: ScoreEventType.GOAL,
  period_end: ScoreEventType.PERIOD_END,
  ball: ScoreEventType.BALL,
  innings_end: ScoreEventType.INNINGS_END,
};

/** Rebuilds engine events from stored rows (undone ones skipped). */
function toScoreEvents(rows: StoredEvent[]): ScoreEvent[] {
  return rows.flatMap((row): ScoreEvent[] => {
    if (row.isUndone) return [];
    switch (row.typeId) {
      case ScoreEventType.POINT:
        return [{ type: 'point', side: row.side! }];
      case ScoreEventType.GOAL:
        return [{ type: 'goal', side: row.side! }];
      case ScoreEventType.PERIOD_END:
        return [{ type: 'period_end' }];
      case ScoreEventType.BALL: {
        const data = row.data as { runs: number; extra: 'none' | 'wide' | 'no_ball'; wicket: boolean };
        return [{ type: 'ball', runs: data.runs, extra: data.extra, wicket: data.wicket }];
      }
      case ScoreEventType.INNINGS_END:
        return [{ type: 'innings_end' }];
      default:
        return [];
    }
  });
}

/** Every event and every undo bumps the version; see MatchDetail.version. */
function versionOf(rows: Array<Pick<EventRow, 'isUndone'>>): number {
  return rows.length + rows.filter((row) => row.isUndone).length;
}

function toEngineEvent(input: ScoreEventInput): ScoreEvent {
  switch (input.type) {
    case 'point':
    case 'goal':
      return { type: input.type, side: input.side };
    case 'ball':
      return { type: 'ball', runs: input.runs, extra: input.extra, wicket: input.wicket };
    default:
      return { type: input.type };
  }
}

/** When each period reached so far started: kept from before, "now" for a period that just began. */
function periodStartsFor(score: ScoreView, previous: Record<string, string>): Record<string, string> {
  const now = new Date().toISOString();
  return Object.fromEntries(score.periods.map((period) => [String(period.no), previous[String(period.no)] ?? now]));
}

function staleMatch(): AppError {
  return AppError.conflict('STALE_MATCH', 'The score changed since you last saw it. Showing the latest score.');
}

function defaultSideName(players: Array<{ fullName: string }>, teamFormat: boolean): string {
  const firstNames = players.map((player) => player.fullName.split(' ')[0]!);
  return teamFormat ? `Team ${firstNames[0]}` : firstNames.join(' & ');
}

/** The score written from `side`'s point of view: "11-7, 9-11, 11-5", "2-1", "54/3 (6.0) – 50/5 (6.0)". */
function scoreFor(view: ScoreView, side: Side): string {
  const mine = side - 1;
  const theirs = 2 - side;
  if (view.kind === 'rally') {
    return view.periods
      .filter((p) => p.finished || p.score[0] + p.score[1] > 0)
      .map((p) => `${p.score[mine]}-${p.score[theirs]}`)
      .join(', ');
  }
  if (view.kind === 'timed_goals') return `${view.totals[mine]}-${view.totals[theirs]}`;
  return [...view.cricket!.innings]
    .sort((a, b) => (a.battingSide === side ? -1 : b.battingSide === side ? 1 : 0))
    .map((inn) => `${inn.runs}/${inn.wickets} (${inn.overs})`)
    .join(' – ');
}

function resultPost(sportName: string, sides: MatchSide[], view: ScoreView): string {
  const [one, two] = sides as [MatchSide, MatchSide];
  if (view.winner === null) {
    const word = view.kind === 'overs' ? 'tied' : 'drew';
    return `${one.name} and ${two.name} ${word} ${scoreFor(view, 1)} · ${sportName}`;
  }
  const winner = view.winner === 1 ? one : two;
  const loser = view.winner === 1 ? two : one;
  return `${winner.name} beat ${loser.name} ${scoreFor(view, view.winner)} · ${sportName}`;
}

export class MatchService {
  private readonly live: LiveStore;
  private readonly persister: LivePersister;

  constructor(private readonly deps: MatchServiceDeps) {
    this.live = deps.live ?? new MemoryLiveStore();
    this.persister = new LivePersister(this.live, (matchId, job) => this.persistJob(matchId, job), deps.logger);
  }

  /** Writes to Postgres whatever was scored but not yet saved before the last shutdown. */
  resumePending(): Promise<void> {
    return this.persister.resume();
  }

  async listSetup(): Promise<SportSetup[]> {
    const rows = await this.deps.repository.listSetup(this.deps.pool);
    const bySport = new Map<string, SportSetup>();
    for (const row of rows) {
      const entry = bySport.get(row.sport.id) ?? { sport: row.sport, kind: row.config.kind, formats: [], defaults: row.config };
      entry.formats.push({ id: row.formatId, name: row.formatName, minPlayers: row.minPlayers, maxPlayers: row.maxPlayers });
      bySport.set(row.sport.id, entry);
    }
    return [...bySport.values()];
  }

  async createMatch(userId: string, input: CreateMatchInput): Promise<MatchDetail> {
    const { pool, repository } = this.deps;
    const setup = await repository.findSetup(pool, input.sportId, input.formatId);
    const rules = setup && SPORT_RULES[setup.sport.code];
    if (!setup || !rules) {
      throw AppError.badRequest('VALIDATION_ERROR', 'Some fields are invalid.', { formatId: ['Unknown sport or format'] });
    }
    for (const side of input.sides) {
      if (side.playerIds.length < setup.minPlayers || side.playerIds.length > setup.maxPlayers) {
        const count = setup.minPlayers === setup.maxPlayers ? `${setup.minPlayers}` : `${setup.minPlayers} to ${setup.maxPlayers}`;
        throw AppError.badRequest('VALIDATION_ERROR', 'Some fields are invalid.', {
          sides: [`${setup.sport.name} ${setup.formatName.toLowerCase()} needs ${count} player${setup.maxPlayers > 1 ? 's' : ''} per side`],
        });
      }
    }
    const playerIds = input.sides.flatMap((side) => side.playerIds);
    const players = new Map((await repository.findActivePlayers(pool, playerIds)).map((player) => [player.id, player]));
    if (players.size !== playerIds.length) {
      throw AppError.badRequest('VALIDATION_ERROR', 'Some fields are invalid.', { sides: ['Some players could not be found'] });
    }

    const config = applyOptions(setup.config, input.options);
    const teamFormat = setup.maxPlayers > 2;
    const matchId = await withTransaction(pool, (db) =>
      repository.createMatch(
        db,
        {
          createdBy: userId,
          sportId: setup.sport.id,
          formatId: setup.formatId,
          scoringId: setup.scoringId,
          config,
          sides: input.sides.map((side) => ({
            name: side.name ?? defaultSideName(side.playerIds.map((id) => players.get(id)!), teamFormat),
            playerIds: side.playerIds,
          })),
        },
        rules.periodType,
        replay(config, []),
      ),
    );
    return this.getMatch(userId, matchId);
  }

  async getMatch(userId: string, matchId: string): Promise<MatchDetail> {
    const state = await this.loadLive(matchId);
    if (!state) throw AppError.notFound('MATCH_NOT_FOUND', 'This match does not exist.');
    const completed = state.match.statusId === MatchStatus.COMPLETED;
    const ratingChanges = completed ? await this.deps.repository.findRatingChanges(this.deps.pool, matchId) : [];
    return this.detail(userId, state, ratingChanges);
  }

  /** Live matches from Postgres, with each score taken from the live store (Postgres may be a moment behind). */
  async listLive(userId: string): Promise<MatchCard[]> {
    const cards = await this.deps.repository.findLiveMatches(this.deps.pool, userId, LIVE_LIST_LIMIT);
    const states = await this.live.getMany(cards.map((card) => card.id));
    return cards.map((card) => {
      const state = states.get(card.id);
      return state ? { ...card, score: replay(state.match.config, toScoreEvents(state.events)) } : card;
    });
  }

  async scoreEvent(userId: string, matchId: string, input: ScoreEventInput): Promise<MatchDetail> {
    return this.commitLive(userId, matchId, input.version, (state) => {
      const config = state.match.config;
      const events = toScoreEvents(state.events);
      const score = replay(config, events);
      const event = toEngineEvent(input);
      let next: ScoreView;
      try {
        next = replay(config, events, event);
      } catch (error) {
        if (!(error instanceof ScoringError)) throw error;
        if (error.code === 'MATCH_OVER') throw AppError.conflict('MATCH_OVER', error.message);
        throw AppError.badRequest('INVALID_EVENT', error.message);
      }

      const side = event.type === 'point' || event.type === 'goal' ? event.side : event.type === 'ball' ? score.cricket!.battingSide : null;
      const stored: LiveEvent = {
        sequenceNo: state.events.length + 1,
        typeId: EVENT_TYPE_ID[event.type],
        side,
        data: event.type === 'ball' ? { runs: event.runs, extra: event.extra, wicket: event.wicket } : null,
        isUndone: false,
      };
      const job: PersistJob = {
        kind: 'event',
        sequenceNo: stored.sequenceNo,
        typeId: stored.typeId,
        side: stored.side,
        data: stored.data,
        scoreValue: next.totals[0] + next.totals[1] - (score.totals[0] + score.totals[1]),
        userId,
      };
      return { events: [...state.events, stored], score: next, job };
    });
  }

  async undo(userId: string, matchId: string, version: number): Promise<MatchDetail> {
    return this.commitLive(userId, matchId, version, (state) => {
      const index = state.events.findLastIndex((event) => !event.isUndone);
      if (index < 0) throw AppError.badRequest('NOTHING_TO_UNDO', 'There is nothing to undo.');
      const events = state.events.map((event, i) => (i === index ? { ...event, isUndone: true } : event));
      const job: PersistJob = { kind: 'undo', sequenceNo: state.events[index]!.sequenceNo, userId };
      return { events, score: replay(state.match.config, toScoreEvents(events)), job };
    });
  }

  /**
   * Saves a decided match (one transaction): result, each player's snapshot, history, stats and
   * Elo rating, and a result post for the feed.
   */
  async finish(userId: string, matchId: string, version: number): Promise<MatchDetail> {
    const { repository } = this.deps;
    // Postgres must have every event before the result is computed from it.
    await this.persister.flush(matchId);
    await withTransaction(this.deps.pool, async (db) => {
      const { match, sides, score } = await this.lockForScoring(db, userId, matchId, version);
      if (!score.finished) throw AppError.conflict('MATCH_NOT_FINISHED', 'The match is not over yet.');

      const players = sides.flatMap((side) => side.players.map((player) => ({ ...player, side: side.no })));
      const ratings = await repository.lockRatings(db, match.sport.id, [...new Set(players.map((p) => p.userId))]);
      const ratingOf = (id: string) => ratings.get(id) ?? DEFAULT_RATING;
      const sideRating = (no: Side) => average(players.filter((p) => p.side === no).map((p) => ratingOf(p.userId)));
      const change = eloChange(sideRating(1), sideRating(2), score.winner);

      await repository.setStatus(db, matchId, MatchStatus.COMPLETED);
      const winnerSide = sides.find((side) => side.no === score.winner);
      await repository.insertResult(db, {
        matchId,
        winnerTeamId: winnerSide?.teamId ?? null,
        winnerParticipantId: winnerSide?.players.length === 1 ? winnerSide.players[0]!.participantId : null,
        resultTypeId: score.winner ? ResultType.WIN : ResultType.DRAW,
        data: {
          summary: score.summary,
          winnerSide: score.winner,
          sides: sides.map((side) => ({ no: side.no, name: side.name, headline: score.headline[side.no - 1] })),
          periods: score.periods.map((p) => ({ label: p.label, score: p.score })),
        },
      });

      for (const player of players) {
        const mine = player.side - 1;
        const won = score.winner === player.side;
        const lost = score.winner !== null && !won;
        const before = ratingOf(player.userId);
        const after = Math.round((before + change[mine]!) * 10) / 10;
        await repository.recordPlayerResult(db, {
          matchId,
          sportId: match.sport.id,
          participantId: player.participantId,
          userId: player.userId,
          won,
          lost,
          pointsFor: score.totals[mine]!,
          pointsAgainst: score.totals[1 - mine]!,
          ratingAfter: after,
          statData: {
            side: player.side,
            result: won ? 'won' : lost ? 'lost' : 'draw',
            pointsFor: score.totals[mine],
            pointsAgainst: score.totals[1 - mine],
            ...(score.kind === 'rally' ? { periodsWon: score.headline[mine], periodsLost: score.headline[1 - mine] } : {}),
            summary: scoreFor(score, player.side),
            ratingBefore: before,
            ratingAfter: after,
          },
        });
      }
      await repository.insertResultPost(db, { userId: match.createdBy, matchId, content: resultPost(match.sport.name, sides, score) });
    });
    await this.live.drop(matchId);
    return this.getMatch(userId, matchId);
  }

  /** Ends a live match without a result; nothing is added to anyone's stats. */
  async abandon(userId: string, matchId: string): Promise<MatchDetail> {
    await this.persister.flush(matchId);
    await withTransaction(this.deps.pool, async (db) => {
      const match = await this.lockMatch(db, userId, matchId);
      await this.deps.repository.setStatus(db, match.id, MatchStatus.ABANDONED);
    });
    await this.live.drop(matchId);
    return this.getMatch(userId, matchId);
  }

  private async lockMatch(db: Queryable, userId: string, matchId: string): Promise<MatchRow> {
    const match = await this.deps.repository.findMatch(db, matchId, true);
    if (!match) throw AppError.notFound('MATCH_NOT_FOUND', 'This match does not exist.');
    if (match.createdBy !== userId) throw AppError.forbidden('NOT_MATCH_SCORER', 'Only the player who started this match can score it.');
    if (match.statusId !== MatchStatus.LIVE) throw AppError.conflict('MATCH_NOT_LIVE', 'This match has already ended.');
    return match;
  }

  /** Locks the match, checks the caller may score it and that their view is current, and replays it. */
  private async lockForScoring(db: Queryable, userId: string, matchId: string, version: number) {
    const match = await this.lockMatch(db, userId, matchId);
    // Sequential: one transaction client runs one query at a time.
    const sides = await this.deps.repository.findSides(db, matchId);
    const events = await this.deps.repository.findEvents(db, matchId);
    if (versionOf(events) !== version) {
      throw AppError.conflict('STALE_MATCH', 'The score changed since you last saw it. Showing the latest score.');
    }
    return { match, sides, events, score: replay(match.config, toScoreEvents(events)) };
  }

  /**
   * The match as the live store has it, loaded from Postgres on a miss. Only live matches are
   * cached; ended ones are read from Postgres every time. Null if the match does not exist.
   */
  private async loadLive(matchId: string): Promise<LiveState | null> {
    const cached = await this.live.get(matchId);
    if (cached) return cached;
    // Anything still queued for this match must be in Postgres before it is read back.
    await this.persister.flush(matchId);
    const { pool, repository } = this.deps;
    const match = await repository.findMatch(pool, matchId);
    if (!match) return null;
    const [sides, events, periodStarts] = await Promise.all([
      repository.findSides(pool, matchId),
      repository.findEvents(pool, matchId),
      repository.findPeriodStarts(pool, matchId),
    ]);
    const state: LiveState = {
      version: versionOf(events),
      match: { ...match, startedAt: match.startedAt.toISOString(), completedAt: match.completedAt?.toISOString() ?? null },
      sides,
      events: events.map(({ sequenceNo, typeId, side, data, isUndone }) => ({ sequenceNo, typeId, side, data, isUndone })),
      periodStarts,
    };
    return match.statusId === MatchStatus.LIVE ? this.live.prime(state) : state;
  }

  /**
   * Applies one scoring change to the live store: checks the caller may score and saw the latest
   * version, lets `change` build the new events, commits atomically, then queues the Postgres write.
   */
  private async commitLive(
    userId: string,
    matchId: string,
    version: number,
    change: (state: LiveState) => { events: LiveEvent[]; score: ScoreView; job: PersistJob },
  ): Promise<MatchDetail> {
    // A second pass only happens if the cached state expired between the read and the commit.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const state = await this.loadLive(matchId);
      if (!state) throw AppError.notFound('MATCH_NOT_FOUND', 'This match does not exist.');
      if (state.match.createdBy !== userId) throw AppError.forbidden('NOT_MATCH_SCORER', 'Only the player who started this match can score it.');
      if (state.match.statusId !== MatchStatus.LIVE) throw AppError.conflict('MATCH_NOT_LIVE', 'This match has already ended.');
      if (state.version !== version) throw staleMatch();

      const { events, score, job } = change(state);
      const next: LiveState = { ...state, version: state.version + 1, events, periodStarts: periodStartsFor(score, state.periodStarts) };
      const result = await this.live.commit(state.version, next, job);
      if (result === 'stale') throw staleMatch();
      if (result === 'ok') {
        if (this.deps.persistInBackground) this.persister.kick(matchId);
        else await this.persister.flush(matchId);
        return this.detail(userId, next);
      }
    }
    throw staleMatch();
  }

  /** Writes one queued live change to Postgres. Safe to run twice; skipped if the match has ended. */
  private async persistJob(matchId: string, job: PersistJob): Promise<void> {
    const { repository } = this.deps;
    await withTransaction(this.deps.pool, async (db) => {
      const match = await repository.findMatch(db, matchId, true);
      if (!match || match.statusId !== MatchStatus.LIVE) return;
      // Sequential: one transaction client runs one query at a time.
      const sides = await repository.findSides(db, matchId);
      const events = await repository.findEvents(db, matchId);

      if (job.kind === 'undo') {
        const target = events.find((event) => event.sequenceNo === job.sequenceNo);
        if (!target || target.isUndone) return;
        await repository.undoEvent(db, matchId, target.id, job.userId);
        const remaining = events.filter((event) => !event.isUndone && event.id !== target.id);
        await this.saveScore(db, match, sides, replay(match.config, toScoreEvents(remaining)), remaining.at(-1)?.id ?? null);
        return;
      }

      if (events.some((event) => event.sequenceNo === job.sequenceNo)) return;
      if (job.sequenceNo !== events.length + 1) {
        throw new Error(`Live event ${job.sequenceNo} for match ${matchId} does not follow event ${events.length}`);
      }
      const score = replay(match.config, toScoreEvents(events));
      const next = replay(match.config, toScoreEvents([...events, { ...job, isUndone: false }]));
      const periodIds = await repository.findPeriodIds(db, matchId);
      const eventId = await repository.insertEvent(db, {
        matchId,
        periodId: periodIds.get(score.currentPeriod.no) ?? null,
        teamId: job.side ? sides.find((s) => s.no === job.side)!.teamId : null,
        typeId: job.typeId,
        sequenceNo: job.sequenceNo,
        scoreValue: job.scoreValue,
        data: job.data,
        createdBy: job.userId,
      });
      await this.saveScore(db, match, sides, next, eventId);
    });
  }

  private detail(userId: string, state: LiveState, ratingChanges: MatchDetail['ratingChanges'] = []): MatchDetail {
    const { match } = state;
    const score = replay(match.config, toScoreEvents(state.events));
    const status = this.deps.repository.statusName(match.statusId);
    return {
      id: match.id,
      sport: match.sport,
      format: match.format,
      status,
      createdBy: match.createdBy,
      canScore: status === 'live' && match.createdBy === userId,
      config: match.config,
      sides: state.sides,
      score,
      version: state.version,
      startedAt: match.startedAt,
      completedAt: match.completedAt,
      currentPeriodStartedAt: state.periodStarts[String(score.currentPeriod.no)] ?? null,
      ratingChanges,
    };
  }

  private async saveScore(db: Queryable, match: MatchRow, sides: MatchSide[], score: ScoreView, lastEventId: string | null): Promise<void> {
    const rules = SPORT_RULES[match.sport.code]!;
    await this.deps.repository.syncPeriods(db, match.id, rules.periodType, score.periods);
    await this.deps.repository.saveScore(db, match.id, sides, score, lastEventId);
  }
}
