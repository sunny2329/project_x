/**
 * Tennis-style scoring: tennis and padel. Points 0/15/30/40/game with advantage or golden point,
 * sets to 6 by 2 with a tiebreak at 6-6, and an optional match tiebreak instead of the final set.
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

export const tennisConfigSchema = z.object({
  /** advantage: deuce needs a 2-point lead. golden_point: at 40-40 the next point wins (no-ad). */
  deuce: z.enum(['advantage', 'golden_point']).default('advantage'),
  setGames: z.number().int().min(1).max(12).default(6),
  /** Games-all score that starts a tiebreak; null = sets are played out by 2 games. */
  tiebreakAt: z.number().int().min(1).max(12).nullable().default(6),
  tiebreakPoints: z.number().int().min(1).max(20).default(7),
  bestOf: z.number().int().min(1).max(5).refine(isOdd, 'bestOf must be odd'),
  /** standard: like other sets. advantage: no tiebreak in the final set. match_tiebreak: a tiebreak to matchTiebreakPoints replaces it. */
  finalSet: z.enum(['standard', 'advantage', 'match_tiebreak']).default('standard'),
  matchTiebreakPoints: z.number().int().min(1).max(20).default(10),
  playersPerSide: playersPerSideSchema.default([1, 2]),
  firstServerSideIndex: z.union([z.literal(0), z.literal(1)]).default(0),
});

export type TennisConfig = z.infer<typeof tennisConfigSchema>;

type GameType = 'game' | 'tiebreak' | 'match_tiebreak';

interface GameRec {
  type: GameType;
  points: Pair;
  winner: number | null;
  /** The side serving the first point of this game (or tiebreak). */
  firstServer: number;
}

interface SetRec {
  type: 'set' | 'match_tiebreak';
  games: Pair;
  winner: number | null;
  /** Whether a tiebreak is played at tiebreakAt-all in this set. */
  tiebreak: boolean;
  log: GameRec[];
}

export interface TennisState {
  players: Pair;
  sets: SetRec[];
  setsWon: Pair;
  winner: number | null;
  /** Side serving the next point and the serving player's index within it. */
  serving: number;
  server: number;
  /** Which player of each side serves the next time that side takes the serve. */
  nextPlayer: Pair;
}

const POINT_NAMES = ['0', '15', '30', '40'];

function takeServe(state: TennisState, side: number): TennisState {
  const nextPlayer: Pair = [...state.nextPlayer];
  const server = nextPlayer[side]!;
  nextPlayer[side] = (server + 1) % state.players[side]!;
  return { ...state, serving: side, server, nextPlayer };
}

function withCurrentSet(state: TennisState, change: (set: SetRec) => SetRec): SetRec[] {
  const sets = [...state.sets];
  sets[sets.length - 1] = change(sets.at(-1)!);
  return sets;
}

function startGame(state: TennisState, type: GameType, firstServer: number): TennisState {
  const sets = withCurrentSet(state, (set) => ({ ...set, log: [...set.log, { type, points: [0, 0], winner: null, firstServer }] }));
  return takeServe({ ...state, sets }, firstServer);
}

function startSet(state: TennisState, config: TennisConfig, firstServer: number): TennisState {
  const setNo = state.sets.length + 1;
  const decider = setNo === config.bestOf;
  const matchTiebreak = decider && config.finalSet === 'match_tiebreak';
  const set: SetRec = {
    type: matchTiebreak ? 'match_tiebreak' : 'set',
    games: [0, 0],
    winner: null,
    tiebreak: config.tiebreakAt !== null && !(decider && config.finalSet === 'advantage'),
    log: [],
  };
  return startGame({ ...state, sets: [...state.sets, set] }, matchTiebreak ? 'match_tiebreak' : 'game', firstServer);
}

function gameWon(config: TennisConfig, game: GameRec, points: Pair, side: number): boolean {
  const mine = points[side]!;
  const theirs = points[other(side)]!;
  if (game.type === 'game') {
    if (mine < 4) return false;
    return mine - theirs >= 2 || (config.deuce === 'golden_point' && theirs === 3);
  }
  const target = game.type === 'tiebreak' ? config.tiebreakPoints : config.matchTiebreakPoints;
  return mine >= target && mine - theirs >= 2;
}

function applyPoint(state: TennisState, event: RallyWonEvent, config: TennisConfig): TennisState {
  if (state.winner !== null) matchComplete();
  const side = event.sideIndex;
  const set = state.sets.at(-1)!;
  const game = set.log.at(-1)!;
  const points = bump(game.points, side);

  if (!gameWon(config, game, points, side)) {
    const sets = withCurrentSet(state, (s) => ({ ...s, log: [...s.log.slice(0, -1), { ...game, points }] }));
    const next = { ...state, sets };
    // Tiebreaks: serve changes after the first point, then every two points.
    if (game.type !== 'game' && (points[0] + points[1]) % 2 === 1) return takeServe(next, other(state.serving));
    return next;
  }

  const finishedGame: GameRec = { ...game, points, winner: side };
  const games = set.type === 'match_tiebreak' ? bump([0, 0], side) : bump(set.games, side);
  const mine = games[side]!;
  const setWon =
    set.type === 'match_tiebreak' || game.type === 'tiebreak' || (mine >= config.setGames && mine - games[other(side)]! >= 2);
  const sets = withCurrentSet(state, (s) => ({ ...s, games, winner: setWon ? side : null, log: [...s.log.slice(0, -1), finishedGame] }));
  let next: TennisState = { ...state, sets };
  // The side that received first in a game (or tiebreak) serves the next game.
  const nextServer = other(game.firstServer);

  if (!setWon) {
    const tiebreakNow = set.tiebreak && games[0] === config.tiebreakAt && games[1] === config.tiebreakAt;
    return startGame(next, tiebreakNow ? 'tiebreak' : 'game', nextServer);
  }
  const setsWon = bump(state.setsWon, side);
  next = { ...next, setsWon };
  if (setsWon[side]! > config.bestOf / 2) return { ...next, winner: side };
  return startSet(next, config, nextServer);
}

function pointDisplay(game: GameRec, live: boolean): string[] {
  if (game.type !== 'game') return game.points.map(String);
  const [a, b] = game.points;
  if (!live || game.winner !== null) return [String(a), String(b)];
  if (a >= 3 && b >= 3) {
    if (a === b) return ['40', '40'];
    return a > b ? ['AD', '40'] : ['40', 'AD'];
  }
  return [POINT_NAMES[a]!, POINT_NAMES[b]!];
}

function setHeadline(set: SetRec): string | null {
  if (set.type === 'match_tiebreak') {
    const [a, b] = set.log[0]!.points;
    return a + b > 0 ? `[${a}-${b}]` : null;
  }
  const started = set.games[0] + set.games[1] > 0 || set.log.some((g) => g.points[0] + g.points[1] > 0);
  if (!started) return null;
  const tiebreak = set.log.find((g) => g.type === 'tiebreak' && g.winner !== null);
  const tb = tiebreak ? `(${Math.min(tiebreak.points[0], tiebreak.points[1])})` : '';
  return `${set.games[0]}-${set.games[1]}${tb}`;
}

function segments(state: TennisState): SegmentSummary[] {
  return state.sets.map((set, i) => {
    if (set.type === 'match_tiebreak') {
      const game = set.log[0]!;
      return {
        type: 'match_tiebreak',
        sequence: i + 1,
        label: 'Match tiebreak',
        scores: [...game.points],
        display: game.points.map(String),
        winnerSideIndex: set.winner,
        complete: set.winner !== null,
        children: [],
      };
    }
    return {
      type: 'set',
      sequence: i + 1,
      label: `Set ${i + 1}`,
      scores: [...set.games],
      display: set.games.map(String),
      winnerSideIndex: set.winner,
      complete: set.winner !== null,
      children: set.log.map((game, j) => ({
        type: game.type,
        sequence: j + 1,
        label: game.type === 'tiebreak' ? 'Tiebreak' : `Game ${j + 1}`,
        scores: [...game.points],
        display: pointDisplay(game, true),
        winnerSideIndex: game.winner,
        complete: game.winner !== null,
        children: [],
      })),
    };
  });
}

function callout(state: TennisState, config: TennisConfig): string | null {
  if (state.winner !== null) return null;
  let setPoint = false;
  for (const side of [0, 1] as const) {
    const after = applyPoint(state, { type: 'rally_won', sideIndex: side }, config);
    if (after.winner !== null) return 'Match point';
    if (after.sets.length > state.sets.length) setPoint = true;
  }
  if (setPoint) return 'Set point';
  const game = state.sets.at(-1)!.log.at(-1)!;
  if (game.type === 'tiebreak') return 'Tiebreak';
  if (game.type === 'match_tiebreak') return 'Match tiebreak';
  const [a, b] = game.points;
  if (a >= 3 && b >= 3) {
    if (a !== b) return 'Advantage';
    return config.deuce === 'golden_point' ? 'Golden point' : 'Deuce';
  }
  return null;
}

function completedGames(state: TennisState): number {
  return state.sets.reduce((n, set) => n + set.log.filter((g) => g.winner !== null).length, 0);
}

export const tennisPlugin: ScoringPlugin<TennisConfig, TennisState, RallyWonEvent> = {
  scoringModel: 'tennis',
  configSchema: tennisConfigSchema as z.ZodType<TennisConfig>,
  eventSchema: rallyWonEventSchema,

  validateSides: (config, sides) => validateTwoSides(sides, config.playersPerSide),

  initialState(config, sides: SideInfo[]) {
    const blank: TennisState = {
      players: playerCounts(sides),
      sets: [],
      setsWon: [0, 0],
      winner: null,
      serving: config.firstServerSideIndex,
      server: 0,
      nextPlayer: [0, 0],
    };
    return startSet(blank, config, config.firstServerSideIndex);
  },

  applyEvent: (state, event, config) => applyPoint(state, event, config),

  isComplete: (state) => state.winner !== null,

  summary(state, config): ScoreSummary {
    const live = state.winner === null;
    const game = state.sets.at(-1)!.log.at(-1)!;
    const display = pointDisplay(game, live);
    const gamesWon = state.sets.flatMap((s) => s.log).reduce<number[]>((sum, g) => (g.winner === null ? sum : bump(sum as Pair, g.winner)), [0, 0]);
    return {
      scoringModel: 'tennis',
      complete: !live,
      winnerSideIndex: state.winner,
      sides: [0, 1].map((i) => {
        const serving = live && state.serving === i;
        return {
          index: i,
          primary: String(state.setsWon[i]),
          current: live ? display[i]! : null,
          serving,
          serverNumber: null,
          serverPlayerIndex: serving ? state.server : null,
          serveNote: null,
        };
      }),
      segments: segments(state),
      headline: state.sets.map(setHeadline).filter((s): s is string => s !== null).join(', ') || '0-0',
      callout: callout(state, config),
      totals: { major: [...state.setsWon], minor: gamesWon, majorLabel: 'Sets', minorLabel: 'Games' },
      actions: live ? [0, 1].map((i) => ({ id: `point-${i}`, label: 'Point', sideIndex: i, event: { type: 'rally_won', sideIndex: i } })) : [],
    };
  },

  eventsForManualResult(config, sides, scores) {
    if (scores.length === 0) throw new ScoringError('INVALID_RESULT', 'Enter at least one set.');
    let state = tennisPlugin.initialState(config, sides);
    const events: RallyWonEvent[] = [];
    const push = (sideIndex: 0 | 1) => {
      const event: RallyWonEvent = { type: 'rally_won', sideIndex };
      state = applyPoint(state, event, config);
      events.push(event);
    };
    for (const entry of scores) {
      if (state.winner !== null) break;
      const set = state.sets.at(-1)!;
      if (set.type === 'match_tiebreak') {
        for (const owner of interleavedPoints(entry, 'match tiebreak')) push(owner);
        continue;
      }
      // Each game goes to its winner to love (a tiebreak 7-0); only the games count is entered.
      for (const owner of interleavedPoints(entry, 'set')) {
        const before = completedGames(state);
        while (completedGames(state) === before && state.winner === null) push(owner);
      }
    }
    return events;
  },
};
