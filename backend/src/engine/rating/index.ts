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

/** Everyone starts here in every sport (design v2; was 1000 until migration 6_rating_scale_1500). */
export const DEFAULT_RATING = 1500;
/** Rated matches before a rating counts: until then the player is "Prov. n/3". */
export const PLACEMENT_MATCHES = 3;

/** Tier ladder, same for every sport. `hi` is exclusive; Elite has no top. */
export const TIERS = [
  { key: 'rookie', name: 'Rookie', lo: Number.NEGATIVE_INFINITY, hi: 1200 },
  { key: 'bronze', name: 'Bronze', lo: 1200, hi: 1400 },
  { key: 'silver', name: 'Silver', lo: 1400, hi: 1550 },
  { key: 'gold', name: 'Gold', lo: 1550, hi: 1700 },
  { key: 'platinum', name: 'Platinum', lo: 1700, hi: 1850 },
  { key: 'elite', name: 'Elite', lo: 1850, hi: Number.POSITIVE_INFINITY },
] as const;

export type TierKey = (typeof TIERS)[number]['key'];
export type Confidence = 'placement' | 'low' | 'medium' | 'high';

export interface TierInfo {
  key: TierKey;
  name: string;
  /** 0-1 through the tier (ring / bar fill). Rookie counts from 1000, Elite fills up to 2100. */
  progress: number;
  /** The next tier and the points still needed, or null at Elite. */
  next: { key: TierKey; name: string; pointsToGo: number } | null;
}

export function tierOf(rating: number): TierInfo {
  const i = TIERS.findIndex((t) => rating >= t.lo && rating < t.hi);
  const t = TIERS[i]!;
  const lo = Number.isFinite(t.lo) ? t.lo : 1000;
  const hi = Number.isFinite(t.hi) ? t.hi : 2100;
  const progress = Math.min(1, Math.max(0, (rating - lo) / (hi - lo)));
  const n = TIERS[i + 1];
  return { key: t.key, name: t.name, progress, next: n ? { key: n.key, name: n.name, pointsToGo: Math.max(1, Math.ceil(t.hi - rating)) } : null };
}

/** Placement under 3 rated matches; then low (3-4), medium (5-14), high (15+). */
export function confidenceOf(ratedMatches: number): Confidence {
  if (ratedMatches < PLACEMENT_MATCHES) return 'placement';
  if (ratedMatches < 5) return 'low';
  if (ratedMatches < 15) return 'medium';
  return 'high';
}

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
