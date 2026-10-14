import type { PublicUser } from '../auth/auth.types.js';

/**
 * `usr_user_follow.status_id` values. `type_master` holds no rows yet, so they are defined
 * here; see wiki.md "Status codes".
 */
export const FollowStatus = { ACCEPTED: 1, PENDING: 2 } as const;

/** Starting skill rating; matches the `usr_sport_rating.rating` column default. */
export const DEFAULT_RATING = 1000;

export interface Sport {
  id: string;
  code: string;
  name: string;
}

/** A sport the user plays, with their stats and skill rating in it. */
export interface PlayerSport extends Sport {
  isPrimary: boolean;
  rating: number;
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  pointsScored: number;
  pointsConceded: number;
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

export type MatchOutcome = 'won' | 'lost' | 'draw' | 'in_progress';

export interface MatchHistoryItem {
  matchId: string;
  sport: { code: string; name: string };
  playedAt: string;
  outcome: MatchOutcome;
  /** Display names of the other participants (opponents and, in doubles, the partner). */
  otherPlayers: string[];
  /** Sport-specific score summary from `match_result.result_data`. */
  result: unknown;
}

/** What player search reveals about other users: no email or phone. */
export interface PlayerSearchResult {
  id: string;
  username: string;
  fullName: string;
}
