import { ScoringError, type Pair, type PeriodScore, type RallyConfig, type ScoringEngine, type Side } from './types.js';

interface Game {
  score: Pair;
  winner: Side | null;
}

export interface RallyState {
  games: Game[];
  gamesWon: Pair;
  winner: Side | null;
}

function pointsNeeded(config: RallyConfig, gameNo: number): number {
  return gameNo === config.bestOf && config.decidingPoints !== null ? config.decidingPoints : config.pointsToWin;
}

function gameWonBy(config: RallyConfig, gameNo: number, score: Pair, side: Side): boolean {
  const mine = score[side - 1]!;
  const theirs = score[2 - side]!;
  if (config.cap !== null && mine >= config.cap) return true;
  return mine >= pointsNeeded(config, gameNo) && mine - theirs >= config.winBy;
}

/** Point-by-point games (or sets): pickleball, badminton, table tennis, volleyball. */
export const rallyEngine: ScoringEngine<RallyConfig, RallyState> = {
  initial: () => ({ games: [{ score: [0, 0], winner: null }], gamesWon: [0, 0], winner: null }),

  apply(config, state, event) {
    if (state.winner) throw new ScoringError('MATCH_OVER', 'The match is already decided.');
    if (event.type !== 'point') throw new ScoringError('INVALID_EVENT', 'Only points can be scored in this sport.');

    const games = state.games.map((game) => ({ score: [...game.score] as Pair, winner: game.winner }));
    const gamesWon = [...state.gamesWon] as Pair;
    const game = games.at(-1)!;
    game.score[event.side - 1]! += 1;

    let winner: Side | null = null;
    if (gameWonBy(config, games.length, game.score, event.side)) {
      game.winner = event.side;
      gamesWon[event.side - 1]! += 1;
      if (gamesWon[event.side - 1]! > config.bestOf / 2) winner = event.side;
      else games.push({ score: [0, 0], winner: null });
    }
    return { games, gamesWon, winner };
  },

  view(config, state) {
    const periods: PeriodScore[] = state.games.map((game, index) => ({
      no: index + 1,
      label: `${config.periodName} ${index + 1}`,
      score: game.score,
      winner: game.winner,
      finished: game.winner !== null,
    }));
    const totals = state.games.reduce<Pair>((sum, game) => [sum[0] + game.score[0], sum[1] + game.score[1]], [0, 0]);
    const played = state.games.filter((game) => game.winner !== null || game.score[0] + game.score[1] > 0);
    return {
      kind: 'rally',
      finished: state.winner !== null,
      winner: state.winner,
      currentPeriod: periods.at(-1)!,
      periods,
      headline: state.gamesWon,
      totals,
      summary: played.map((game) => `${game.score[0]}-${game.score[1]}`).join(', ') || '0-0',
      cricket: null,
      allowedEvents: state.winner ? [] : ['point'],
    };
  },
};
