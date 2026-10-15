import type { PublicUser } from '../auth/auth.types.js';

/**
 * `usr_user_follow.status_id` values. `type_master` holds no rows yet, so they are defined
 * here; see wiki.md "Status codes".
 */
export const FollowStatus = { ACCEPTED: 1, PENDING: 2 } as const;

/** A sport as the profile shows it. */
export interface Sport {
  id: string;
  slug: string;
  name: string;
  iconKey: string;
  accentColor: string;
}

/**
 * A sport the user plays, with their record and rating in it. major = games (badminton) or
 * sets (tennis); minor = points (badminton) or games (tennis).
 */
export interface PlayerSport extends Sport {
  isPrimary: boolean;
  rating: number;
  ratedMatches: number;
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  majorWon: number;
  majorLost: number;
  minorWon: number;
  minorLost: number;
}

export interface Profile {
  user: PublicUser;
  bio: string | null;
  sports: PlayerSport[];
  /** Totals across every sport, including ones no longer in the user's list. */
  record: { played: number; won: number; lost: number };
  followers: number;
  following: number;
}

export type MatchOutcome = 'won' | 'lost' | 'draw' | 'in_progress' | 'disputed';

export interface MatchHistoryItem {
  matchId: string;
  context: 'friendly' | 'tournament';
  sport: Sport;
  playedAt: string;
  outcome: MatchOutcome;
  /** played / walkover / no_show / retired / double_walkover, once decided. */
  resultType: string | null;
  /** Display names of the other participants (opponents and, in doubles, the partner). */
  otherPlayers: string[];
  /** Score line from the side of the user ("21-15, 18-21, 21-19"). */
  headline: string | null;
  /** Rating change in this match, when it was rated. */
  ratingChange: number | null;
}
