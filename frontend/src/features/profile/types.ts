import type { User } from '@/features/auth/types';

/** Mirrors backend/src/modules/profile/profile.types.ts. */
export interface Sport {
  id: string;
  slug: string;
  name: string;
  iconKey: string;
  accentColor: string;
}

/** major = games (badminton) or sets (tennis); minor = points (badminton) or games (tennis). */
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
  user: User;
  bio: string | null;
  sports: PlayerSport[];
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
  resultType: string | null;
  otherPlayers: string[];
  /** Score from my side ("21-15, 18-21"). */
  headline: string | null;
  ratingChange: number | null;
}

export interface ProfileChanges {
  fullName?: string;
  /** Empty string clears the bio. */
  bio?: string;
}
