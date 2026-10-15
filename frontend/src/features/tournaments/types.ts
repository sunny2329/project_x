import type { SportRef } from '@/features/match/types';

/** Mirrors backend/src/modules/tournaments/tournaments.service.ts. */
export type TournamentStatus = 'draft' | 'registration_open' | 'registration_closed' | 'in_progress' | 'completed' | 'cancelled';

export interface TournamentListItem {
  id: string;
  slug: string;
  name: string;
  status: TournamentStatus;
  visibility: 'public' | 'unlisted' | 'private';
  startsOn: string | null;
  endsOn: string | null;
  venue: { id: string; name: string } | null;
  sports: { slug: string; name: string; iconKey: string }[];
  isOrganizer: boolean;
}

export interface EventSummary {
  id: string;
  name: string;
  status: string;
  sport: SportRef;
  format: { code: string; name: string; playersPerSide: number };
  ruleset: { id: string; name: string };
  drawFormat: string;
  drawConfig: Record<string, unknown>;
  tiebreakers: string[];
  maxEntries: number | null;
  approvedEntries: number;
}

export interface Tournament {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: TournamentStatus;
  visibility: 'public' | 'unlisted' | 'private';
  startsOn: string | null;
  endsOn: string | null;
  venue: { id: string; name: string } | null;
  isOrganizer: boolean;
  staff: { userId: string; role: string; name: string | null }[];
  courts: { id: string; name: string; scorerUserIds: string[] }[];
  events: EventSummary[];
}

export interface FixtureView {
  id: string;
  eventId: string;
  stageId: string;
  groupId: string | null;
  round: number;
  position: number;
  roundName: string | null;
  status: 'pending' | 'ready' | 'live' | 'completed' | 'bye' | 'cancelled';
  entries: ({ id: string; name: string } | null)[];
  placeholders: (string | null)[];
  winnerEntryId: string | null;
  court: { id: string; name: string } | null;
  scheduledAt: string | null;
  match: { id: string; status: string; headline: string; winnerSideIndex: number | null; callout: string | null } | null;
  nextFixtureId: string | null;
}

export interface StandingRow {
  entryId: string;
  name: string;
  rank: number;
  played: number;
  won: number;
  lost: number;
  majorWon: number;
  majorLost: number;
  minorWon: number;
  minorLost: number;
}

export interface EntryView {
  id: string;
  name: string;
  seed: number | null;
  status: 'pending' | 'approved' | 'withdrawn' | 'disqualified';
  players: { playerId: string; displayName: string; isGuest: boolean }[];
}

export interface EventDetail {
  id: string;
  tournament: { id: string; slug: string; name: string };
  name: string;
  status: string;
  sport: SportRef;
  format: { code: string; name: string; playersPerSide: number };
  ruleset: { id: string; name: string };
  drawFormat: string;
  drawConfig: Record<string, unknown>;
  tiebreakers: string[];
  entries: EntryView[];
  stages: {
    id: string;
    sequence: number;
    type: string;
    name: string;
    status: string;
    groups: { id: string; type: string; name: string; standings: StandingRow[] | null }[];
  }[];
  fixtures: FixtureView[];
}

export const DRAW_FORMATS = [
  { value: 'knockout', label: 'Knockout' },
  { value: 'round_robin', label: 'Round robin' },
  { value: 'groups_knockout', label: 'Groups → knockout' },
] as const;

export function statusText(status: string): string {
  return status.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}
