import type { User } from '@/features/auth/types';

/** Mirrors backend/src/modules/profile/profile.types.ts. */
export interface Sport {
  id: string;
  code: string;
  name: string;
}

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
  user: User;
  bio: string | null;
  sports: PlayerSport[];
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
  otherPlayers: string[];
  result: unknown;
}

export interface ProfileChanges {
  fullName?: string;
  /** Empty string clears the bio. */
  bio?: string;
}
