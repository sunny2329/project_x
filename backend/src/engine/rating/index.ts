/*
 * Ratings per player per sport. The match service gathers the current ratings of everyone in a
 * rated match, asks a RatingSystem for the new ones, and writes player_ratings + history.
 */

export interface PlayerRatingState {
  playerId: string;
  rating: number;
  /** Glicko-2 rating deviation / volatility; unused by Elo. */
  deviation: number | null;
  volatility: number | null;
  ratedMatches: number;
}

export interface RatedSide {
  players: PlayerRatingState[];
}

export interface RatingUpdate {
  playerId: string;
  before: number;
  after: number;
  deviationBefore: number | null;
  deviationAfter: number | null;
  volatility: number | null;
}

export interface RatingSystem {
  /** Stored in player_ratings.system. */
  readonly key: string;
  readonly initialRating: number;
  /** New ratings for every player of both sides; `winnerIndex` null = draw. */
  rate(sides: [RatedSide, RatedSide], winnerIndex: 0 | 1 | null): RatingUpdate[];
}

export const DEFAULT_RATING = 1000;

const average = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;
const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Elo for two sides. A side's rating is its players' average; every player on a side gets the
 * same change. K = 32 suits players whose level is not known yet.
 */
export function eloSystem(k = 32): RatingSystem {
  return {
    key: 'elo',
    initialRating: DEFAULT_RATING,
    rate(sides, winnerIndex) {
      const [r0, r1] = sides.map((s) => average(s.players.map((p) => p.rating))) as [number, number];
      const expected0 = 1 / (1 + 10 ** ((r1 - r0) / 400));
      const score0 = winnerIndex === null ? 0.5 : winnerIndex === 0 ? 1 : 0;
      const change = round1(k * (score0 - expected0));
      return sides.flatMap((side, i) =>
        side.players.map((p) => ({
          playerId: p.playerId,
          before: p.rating,
          after: round1(p.rating + (i === 0 ? change : -change)),
          deviationBefore: p.deviation,
          deviationAfter: p.deviation,
          volatility: p.volatility,
        })),
      );
    },
  };
}

/*
 * Glicko-2 hook: implement `RatingSystem` with key "glicko2" (rating, deviation, volatility are
 * already columns on player_ratings / player_rating_history) and switch `ratingSystem` below.
 * Ratings would then be updated per rating period rather than per match.
 */
export const ratingSystem: RatingSystem = eloSystem();
