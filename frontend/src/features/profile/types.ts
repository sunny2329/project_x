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

export interface RatingTrend {
  sportId: string;
  /** 1000, then the rating after each recent rated match. */
  points: number[];
}

export interface Profile {
  user: User;
  bio: string | null;
  /** Name on scoreboards. */
  displayName: string;
  city: string | null;
  photoUrl: string | null;
  ratingTrends: RatingTrend[];
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
  status: string;
  verification: string;
  /** Who must confirm a typed-in result ("Arjun T"), or "you". */
  awaiting: string | null;
  format: string | null;
  otherPlayers: string[];
  partners: string[];
  opponents: string[];
  tournament: { name: string; eventName: string; roundName: string | null } | null;
  /** Score from my side ("21-15, 18-21"). */
  headline: string | null;
  ratingChange: number | null;
}

export interface ProfileChanges {
  fullName?: string;
  displayName?: string;
  username?: string;
  city?: string;
  /** Empty string clears the bio. */
  bio?: string;
  /** From /api/v1/media; null removes the photo. */
  photoMediaId?: string | null;
}

/** Another person (search results, follower lists). */
export interface UserSummary {
  id: string;
  username: string;
  fullName: string;
  photoUrl: string | null;
  city: string | null;
  isFollowing: boolean;
  ratings: { sportId: string; slug: string; name: string; accentColor: string; rating: number }[];
}

/** A row in a followers / following list; `isFollowing` / `followsMe` are relative to me. */
export interface FollowListUser extends UserSummary {
  followsMe: boolean;
}

export type FollowList = 'followers' | 'following';

export interface FollowListPage {
  users: FollowListUser[];
  nextCursor: string | null;
}

export interface PublicProfile extends UserSummary {
  bio: string | null;
  displayName: string | null;
  followers: number;
  following: number;
  isMe: boolean;
  sports: PlayerSport[];
  headToHead: { wins: number; losses: number; partnerWins: number; partnerLosses: number; recent: ('W' | 'L')[] } | null;
  recentMatches: MatchHistoryItem[];
}

/** A match friends scored with me as a guest, offered after sign-up. */
export interface ClaimableMatch {
  matchId: string;
  guestPlayerId: string;
  sport: { slug: string; name: string; accentColor: string };
  playedAt: string;
  scoredBy: string;
  outcome: 'won' | 'lost' | 'drawn' | null;
  partners: string[];
  opponents: string[];
  headline: string | null;
}
