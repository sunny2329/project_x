/**
 * Side-out scoring (traditional pickleball): only the serving side scores. In doubles each side
 * has server 1 and server 2; a game starts at 0-0-2, so the first serving side gets one server.
 */
import { z } from 'zod';
import { ScoringError, type ScoreSummary, type ScoringPlugin, type SideInfo } from '../types.js';
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

export const sideOutConfigSchema = z.object({
  pointsToWin: z.number().int().min(1).max(99),
  winBy: z.number().int().min(1).max(10).default(2),
  cap: z.number().int().min(1).max(199).nullable().default(null),
  bestOf: z.number().int().min(1).max(9).refine(isOdd, 'bestOf must be odd'),
  playersPerSide: playersPerSideSchema.default([1, 2]),
  /** Doubles: start each game at 0-0-2 (the first serving side has only one server). */
  startAsSecondServer: z.boolean().default(true),
  nextGameFirstServer: z.enum(['alternate', 'game_winner']).default('alternate'),
  firstServerSideIndex: z.union([z.literal(0), z.literal(1)]).default(0),
});

export type SideOutConfig = z.infer<typeof sideOutConfigSchema>;

interface Game {
  scores: Pair;
  winner: number | null;
  firstServer: number;
}

export interface SideOutState {
  players: Pair;
  games: Game[];
  gamesWon: Pair;
  winner: number | null;
  serving: number;
  /** Doubles: 1 or 2. Singles: null. */
  serverNumber: 1 | 2 | null;
  /** Index of the serving player within the serving side. */
  server: number;
  /** Which player of each side stands in the right (even) court. */
  rightPlayer: Pair;
}

const doubles = (state: SideOutState, side: number) => state.players[side] === 2;

function startGame(state: SideOutState, config: SideOutConfig, first: number): SideOutState {
  const fresh: SideOutState = { ...state, games: [...state.games, { scores: [0, 0], winner: null, firstServer: first }], rightPlayer: [0, 0] };
  const isDoubles = doubles(fresh, first);
  return { ...fresh, serving: first, server: 0, serverNumber: isDoubles ? (config.startAsSecondServer ? 2 : 1) : null };
}

function gameWon(config: SideOutConfig, scores: Pair, side: number): boolean {
  const mine = scores[side]!;
  if (config.cap !== null && mine >= config.cap) return true;
  return mine >= config.pointsToWin && mine - scores[other(side)]! >= config.winBy;
}

function applyRally(state: SideOutState, event: RallyWonEvent, config: SideOutConfig): SideOutState {
  if (state.winner !== null) matchComplete();
  const side = event.sideIndex;

  if (side !== state.serving) {
    // Fault by the serving side: second server in doubles, otherwise side out.
    if (state.serverNumber === 1) return { ...state, serverNumber: 2, server: 1 - state.server };
    return { ...state, serving: side, serverNumber: doubles(state, side) ? 1 : null, server: state.rightPlayer[side]! };
  }

  const games = [...state.games];
  const game = games.at(-1)!;
  const scores = bump(game.scores, side);
  if (gameWon(config, scores, side)) {
    games[games.length - 1] = { ...game, scores, winner: side };
    const gamesWon = bump(state.gamesWon, side);
    const done: SideOutState = { ...state, games, gamesWon };
    if (gamesWon[side]! > config.bestOf / 2) return { ...done, winner: side };
    return startGame(done, config, config.nextGameFirstServer === 'game_winner' ? side : other(game.firstServer));
  }
  games[games.length - 1] = { ...game, scores };
  // The server switches courts with their partner and keeps serving.
  const rightPlayer: Pair = [...state.rightPlayer];
  if (doubles(state, side)) rightPlayer[side] = 1 - rightPlayer[side]!;
  return { ...state, games, rightPlayer };
}

export const sideOutPlugin: ScoringPlugin<SideOutConfig, SideOutState, RallyWonEvent> = {
  scoringModel: 'side_out',
  configSchema: sideOutConfigSchema as z.ZodType<SideOutConfig>,
  eventSchema: rallyWonEventSchema,

  validateSides: (config, sides) => validateTwoSides(sides, config.playersPerSide),

  initialState(config, sides: SideInfo[]) {
    const blank: SideOutState = {
      players: playerCounts(sides),
      games: [],
      gamesWon: [0, 0],
      winner: null,
      serving: config.firstServerSideIndex,
      serverNumber: null,
      server: 0,
      rightPlayer: [0, 0],
    };
    return startGame(blank, config, config.firstServerSideIndex);
  },

  applyEvent: (state, event, config) => applyRally(state, event, config),

  isComplete: (state) => state.winner !== null,

  summary(state): ScoreSummary {
    const live = state.winner === null;
    const current = state.games.at(-1)!;
    const served = current.scores[state.serving]!;
    const received = current.scores[other(state.serving)]!;
    const played = state.games.filter((g) => g.winner !== null || g.scores[0] + g.scores[1] > 0);
    return {
      scoringModel: 'side_out',
      complete: !live,
      winnerSideIndex: state.winner,
      sides: [0, 1].map((i) => {
        const serving = live && state.serving === i;
        return {
          index: i,
          primary: String(state.gamesWon[i]),
          current: live ? String(current.scores[i]) : null,
          serving,
          serverNumber: serving ? state.serverNumber : null,
          serverPlayerIndex: serving ? state.server : null,
          serveNote: serving ? (current.scores[i]! % 2 === 0 ? 'Right court' : 'Left court') : null,
        };
      }),
      segments: state.games.map((g, i) => ({
        type: 'game',
        sequence: i + 1,
        label: `Game ${i + 1}`,
        scores: [...g.scores],
        display: g.scores.map(String),
        winnerSideIndex: g.winner,
        complete: g.winner !== null,
        children: [],
      })),
      headline: played.map((g) => `${g.scores[0]}-${g.scores[1]}`).join(', ') || '0-0',
      // The call: serving score, receiving score, server number ("4-7-2").
      callout: live ? [served, received, ...(state.serverNumber ? [state.serverNumber] : [])].join('-') : null,
      totals: {
        major: [...state.gamesWon],
        minor: state.games.reduce<number[]>((sum, g) => [sum[0]! + g.scores[0], sum[1]! + g.scores[1]], [0, 0]),
        majorLabel: 'Games',
        minorLabel: 'Points',
      },
      actions: live
        ? [0, 1].map((i) => ({
            id: `rally-${i}`,
            label: i === state.serving ? 'Point' : state.serverNumber === 1 ? 'Second server' : 'Side out',
            sideIndex: i,
            event: { type: 'rally_won', sideIndex: i },
          }))
        : [],
    };
  },

  eventsForManualResult(config, sides, scores) {
    if (scores.length === 0) throw new ScoringError('INVALID_RESULT', 'Enter at least one game.');
    // Only the server scores, so win the serve back (side-outs) before each point.
    let state = sideOutPlugin.initialState(config, sides);
    const events: RallyWonEvent[] = [];
    const push = (sideIndex: 0 | 1) => {
      const event: RallyWonEvent = { type: 'rally_won', sideIndex };
      state = applyRally(state, event, config);
      events.push(event);
    };
    for (const game of scores) {
      for (const owner of interleavedPoints(game, 'game')) {
        while (state.serving !== owner) push(owner);
        push(owner);
      }
    }
    return events;
  },
  walkoverScore: (config) => {
    const games = Math.ceil(config.bestOf / 2);
    return { major: games, minor: games * config.pointsToWin };
  },
};
