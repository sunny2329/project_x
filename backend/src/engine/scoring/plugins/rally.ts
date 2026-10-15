/**
 * Rally scoring: every rally wins a point, whoever served. Badminton, table tennis, pickleball
 * (rally format), and later volleyball (sets, deciding set to 15).
 */
import { z } from 'zod';
import { ScoringError, type ScoreSummary, type ScoringPlugin, type SegmentSummary, type SideInfo } from '../types.js';
import {
  bump,
  interleavedPoints,
  isOdd,
  matchComplete,
  other,
  playerCounts,
  playersPerSideSchema,
  rallyWonEventSchema,
  validateTwoSides,
  type Pair,
  type RallyWonEvent,
} from './common.js';

export const rallyConfigSchema = z
  .object({
    pointsToWin: z.number().int().min(1).max(99),
    winBy: z.number().int().min(1).max(10).default(2),
    /** A game ends when a side reaches this, lead or not (badminton: 30). */
    cap: z.number().int().min(1).max(199).nullable().default(null),
    bestOf: z.number().int().min(1).max(9).refine(isOdd, 'bestOf must be odd'),
    /** Points to win the deciding game when different (volleyball: 15). */
    decidingGamePoints: z.number().int().min(1).max(99).nullable().default(null),
    segmentType: z.enum(['game', 'set']).default('game'),
    playersPerSide: playersPerSideSchema.default([1, 2]),
    serve: z
      .object({
        /** rally_winner: whoever wins the rally serves next (badminton, pickleball). alternate: fixed rotation (table tennis). */
        rotation: z.enum(['rally_winner', 'alternate']),
        /** alternate only: serves per turn (table tennis: 2). */
        pointsPerServe: z.number().int().min(1).max(10).default(1),
        /** alternate only: once both sides reach this, serve changes every point (table tennis: 10). */
        everyPointFrom: z.number().int().min(1).max(99).nullable().default(null),
        /** Serve from the right court on an even score, left on odd (badminton, pickleball). */
        courtByScore: z.boolean().default(false),
        nextGameFirstServer: z.enum(['game_winner', 'alternate']).default('game_winner'),
      })
      .default({ rotation: 'rally_winner', pointsPerServe: 1, everyPointFrom: null, courtByScore: false, nextGameFirstServer: 'game_winner' }),
    firstServerSideIndex: z.union([z.literal(0), z.literal(1)]).default(0),
  })
  .refine((c) => c.cap === null || c.cap >= c.pointsToWin, { message: 'cap must be at least pointsToWin', path: ['cap'] });

export type RallyConfig = z.infer<typeof rallyConfigSchema>;

interface Game {
  scores: Pair;
  winner: number | null;
  firstServer: number;
}

export interface RallyState {
  players: Pair;
  games: Game[];
  gamesWon: Pair;
  winner: number | null;
  serving: number;
  /** Index of the serving player within the serving side. */
  server: number;
  /** Doubles with courtByScore: which player of each side stands in the right court. */
  rightPlayer: Pair;
  /** alternate rotation: which player of each side serves next time the serve comes to it. */
  nextServer: Pair;
}

function targetFor(config: RallyConfig, gameNo: number): number {
  return gameNo === config.bestOf && config.decidingGamePoints !== null ? config.decidingGamePoints : config.pointsToWin;
}

export function gameWon(config: RallyConfig, gameNo: number, scores: Pair, side: number): boolean {
  const mine = scores[side]!;
  const theirs = scores[other(side)]!;
  if (config.cap !== null && mine >= config.cap) return true;
  return mine >= targetFor(config, gameNo) && mine - theirs >= config.winBy;
}

/** The player of `side` who serves from the court matching `score` (right on even). */
function courtServer(state: Pick<RallyState, 'players' | 'rightPlayer'>, side: number, score: number): number {
  if (state.players[side] === 1) return 0;
  return score % 2 === 0 ? state.rightPlayer[side]! : 1 - state.rightPlayer[side]!;
}

/** Hands the serve to `side` under the alternate rotation. */
function takeTurn(state: RallyState, side: number): RallyState {
  const nextServer: Pair = [...state.nextServer];
  const server = nextServer[side]!;
  nextServer[side] = (server + 1) % state.players[side]!;
  return { ...state, serving: side, server, nextServer };
}

function startGame(state: RallyState, config: RallyConfig, firstServer: number): RallyState {
  const fresh: RallyState = { ...state, games: [...state.games, { scores: [0, 0], winner: null, firstServer }], rightPlayer: [0, 0] };
  if (config.serve.rotation === 'alternate') return takeTurn(fresh, firstServer);
  return { ...fresh, serving: firstServer, server: courtServer(fresh, firstServer, 0) };
}

function applyRally(state: RallyState, event: RallyWonEvent, config: RallyConfig): RallyState {
  if (state.winner !== null) matchComplete();
  const side = event.sideIndex;
  const games = [...state.games];
  const game = games.at(-1)!;
  const scores = bump(game.scores, side);
  const gameNo = games.length;

  if (gameWon(config, gameNo, scores, side)) {
    games[gameNo - 1] = { ...game, scores, winner: side };
    const gamesWon = bump(state.gamesWon, side);
    const done: RallyState = { ...state, games, gamesWon };
    if (gamesWon[side]! > config.bestOf / 2) return { ...done, winner: side };
    const first = config.serve.nextGameFirstServer === 'game_winner' ? side : other(game.firstServer);
    return startGame(done, config, first);
  }

  games[gameNo - 1] = { ...game, scores };
  let next: RallyState = { ...state, games };
  if (config.serve.rotation === 'rally_winner') {
    if (side === state.serving) {
      // The serving side scores: in doubles its players swap courts, the same player serves on.
      const rightPlayer: Pair = [...state.rightPlayer];
      if (state.players[side] === 2) rightPlayer[side] = 1 - rightPlayer[side]!;
      next = { ...next, rightPlayer };
    } else {
      next = { ...next, serving: side, server: config.serve.courtByScore ? courtServer(next, side, scores[side]!) : 0 };
    }
    return next;
  }

  const total = scores[0] + scores[1];
  const { everyPointFrom, pointsPerServe } = config.serve;
  const everyPoint = everyPointFrom !== null && scores[0] >= everyPointFrom && scores[1] >= everyPointFrom;
  return everyPoint || total % pointsPerServe === 0 ? takeTurn(next, other(state.serving)) : next;
}

function segments(state: RallyState, config: RallyConfig): SegmentSummary[] {
  const label = config.segmentType === 'set' ? 'Set' : 'Game';
  return state.games.map((game, i) => ({
    type: config.segmentType,
    sequence: i + 1,
    label: `${label} ${i + 1}`,
    scores: [...game.scores],
    display: game.scores.map(String),
    winnerSideIndex: game.winner,
    complete: game.winner !== null,
    children: [],
  }));
}

function callout(state: RallyState, config: RallyConfig): string | null {
  if (state.winner !== null) return null;
  let game = false;
  for (const side of [0, 1] as const) {
    const after = applyRally(state, { type: 'rally_won', sideIndex: side }, config);
    if (after.winner !== null) return 'Match point';
    if (after.games.length > state.games.length) game = true;
  }
  return game ? `${config.segmentType === 'set' ? 'Set' : 'Game'} point` : null;
}

export const rallyPlugin: ScoringPlugin<RallyConfig, RallyState, RallyWonEvent> = {
  scoringModel: 'rally',
  configSchema: rallyConfigSchema as z.ZodType<RallyConfig>,
  eventSchema: rallyWonEventSchema,

  validateSides: (config, sides) => validateTwoSides(sides, config.playersPerSide),

  initialState(config, sides: SideInfo[]) {
    const blank: RallyState = {
      players: playerCounts(sides),
      games: [],
      gamesWon: [0, 0],
      winner: null,
      serving: config.firstServerSideIndex,
      server: 0,
      rightPlayer: [0, 0],
      nextServer: [0, 0],
    };
    return startGame(blank, config, config.firstServerSideIndex);
  },

  applyEvent: (state, event, config) => applyRally(state, event, config),

  isComplete: (state) => state.winner !== null,

  summary(state, config): ScoreSummary {
    const live = state.winner === null;
    const current = state.games.at(-1)!;
    const played = state.games.filter((g) => g.winner !== null || g.scores[0] + g.scores[1] > 0);
    return {
      scoringModel: 'rally',
      complete: !live,
      winnerSideIndex: state.winner,
      sides: [0, 1].map((i) => {
        const serving = live && state.serving === i;
        return {
          index: i,
          primary: String(state.gamesWon[i]),
          current: live ? String(current.scores[i]) : null,
          serving,
          serverNumber: null,
          serverPlayerIndex: serving ? state.server : null,
          serveNote: serving && config.serve.courtByScore ? (current.scores[i]! % 2 === 0 ? 'Right court' : 'Left court') : null,
        };
      }),
      segments: segments(state, config),
      headline: played.map((g) => `${g.scores[0]}-${g.scores[1]}`).join(', ') || '0-0',
      callout: callout(state, config),
      totals: {
        major: [...state.gamesWon],
        minor: state.games.reduce<number[]>((sum, g) => [sum[0]! + g.scores[0], sum[1]! + g.scores[1]], [0, 0]),
        majorLabel: config.segmentType === 'set' ? 'Sets' : 'Games',
        minorLabel: 'Points',
      },
      actions: live ? [0, 1].map((i) => ({ id: `point-${i}`, label: 'Point', sideIndex: i, event: { type: 'rally_won', sideIndex: i } })) : [],
    };
  },

  eventsForManualResult(_config, _sides, scores) {
    if (scores.length === 0) throw new ScoringError('INVALID_RESULT', 'Enter at least one game.');
    return scores.flatMap((game) => interleavedPoints(game, 'game').map((sideIndex) => ({ type: 'rally_won' as const, sideIndex })));
  },
  walkoverScore: (config) => {
    const games = Math.ceil(config.bestOf / 2);
    return { major: games, minor: games * config.pointsToWin };
  },
};
