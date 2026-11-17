import type { ParticipantInput } from '@/features/match/types';

/* Mirrors backend/src/modules/teams/teams.service.ts. */

export type TeamRole = 'captain' | 'player';

export interface TeamSport {
  id: string;
  slug: string;
  name: string;
  iconKey: string;
  accentColor: string;
}

export interface TeamRecord {
  played: number;
  won: number;
  lost: number;
  drawn: number;
}

export interface TeamSummary {
  id: string;
  name: string;
  sport: TeamSport;
  memberCount: number;
  /** My role, or null when I'm not in the team. */
  myRole: TeamRole | null;
  record: TeamRecord;
  preview: { displayName: string; userId: string | null; photoUrl: string | null }[];
}

export interface TeamMember {
  playerId: string;
  userId: string | null;
  username: string | null;
  displayName: string;
  photoUrl: string | null;
  isGuest: boolean;
  role: TeamRole;
  joinedAt: string;
}

export interface TeamMatch {
  matchId: string;
  playedAt: string;
  outcome: 'won' | 'lost' | 'drawn' | null;
  opponent: string;
  headline: string | null;
}

export interface TeamDetail extends TeamSummary {
  createdAt: string;
  members: TeamMember[];
  canManage: boolean;
  recentMatches: TeamMatch[];
}

export interface NewTeam {
  sport: string;
  name: string;
  members?: ParticipantInput[];
}
