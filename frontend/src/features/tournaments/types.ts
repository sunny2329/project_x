import type { SportRef } from '@/features/match/types';

/** Mirrors backend/src/modules/tournaments/tournaments.service.ts. */
export type TournamentStatus = 'draft' | 'registration_open' | 'registration_closed' | 'in_progress' | 'completed' | 'cancelled';
export type EventStatus = 'draft' | 'registration_open' | 'registration_closed' | 'drawn' | 'in_progress' | 'completed' | 'cancelled';
export type Visibility = 'public' | 'unlisted' | 'private';

export interface TournamentListItem {
  id: string;
  slug: string;
  name: string;
  status: TournamentStatus;
  visibility: Visibility;
  startsOn: string | null;
  endsOn: string | null;
  registrationClosesAt: string | null;
  venue: { id: string; name: string } | null;
  sports: { slug: string; name: string; iconKey: string; accentColor: string }[];
  events: { id: string; name: string; sport: { slug: string; accentColor: string } }[];
  /** Pending + approved entries across events. */
  entries: number;
  /** Sum of event sizes, when every event has one. */
  capacity: number | null;
  courts: number;
  live: { rounds: string[]; courtsInUse: number } | null;
  isOrganizer: boolean;
  isStaff: boolean;
}

export interface EventSummary {
  id: string;
  name: string;
  status: EventStatus;
  sport: SportRef;
  format: { code: string; name: string; playersPerSide: number };
  ruleset: { id: string; name: string };
  drawFormat: DrawFormat;
  drawConfig: Record<string, unknown>;
  tiebreakers: Tiebreaker[];
  maxEntries: number | null;
  approvedEntries: number;
  pendingEntries: number;
  myEntry: { id: string; status: string } | null;
}

export type StaffRole = 'organizer' | 'co_organizer' | 'scorer' | 'referee';

export interface Tournament {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: TournamentStatus;
  visibility: Visibility;
  startsOn: string | null;
  endsOn: string | null;
  registrationClosesAt: string | null;
  entryFee: string | null;
  venue: { id: string; name: string } | null;
  organizer: { userId: string | null; name: string | null };
  isOrganizer: boolean;
  isStaff: boolean;
  pendingEntries: number;
  staff: { userId: string; role: StaffRole; name: string | null }[];
  courts: { id: string; name: string; scorerUserIds: string[]; scorers: { userId: string; name: string | null }[] }[];
  events: EventSummary[];
}

export interface FixtureEntry {
  id: string;
  name: string;
  seed: number | null;
  rating: number;
  players: { playerId: string; userId: string | null; displayName: string }[];
}

export type FixtureStatus = 'pending' | 'ready' | 'live' | 'completed' | 'bye' | 'cancelled';

export interface FixtureView {
  id: string;
  eventId: string;
  event: { id: string; name: string; sport: { slug: string; name: string; accentColor: string } };
  stageId: string;
  stageName: string;
  stageType: 'knockout' | 'round_robin' | string;
  groupId: string | null;
  groupName: string | null;
  round: number;
  position: number;
  roundName: string | null;
  status: FixtureStatus;
  entries: (FixtureEntry | null)[];
  placeholders: (string | null)[];
  winnerEntryId: string | null;
  court: { id: string; name: string; scorers: { userId: string; name: string | null }[] } | null;
  scheduledAt: string | null;
  match: {
    id: string;
    shareToken: string;
    status: string;
    headline: string;
    winnerSideIndex: number | null;
    callout: string | null;
    sides: { primary: string; current: string | null }[];
    segments: number[][];
  } | null;
  nextFixtureId: string | null;
  next: { fixtureId: string; roundName: string | null; position: number; opponent: string | null } | null;
}

export type Tiebreaker = 'match_wins' | 'head_to_head' | 'major_diff' | 'minor_diff' | 'major_won' | 'minor_won';

export interface StandingRow {
  entryId: string;
  name: string;
  rank: number;
  /** What split it from others level with it; null when it was never level. */
  tiebreak: Tiebreaker | 'seed' | null;
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
  rating: number;
  createdAt: string;
  players: { playerId: string; userId: string | null; displayName: string; isGuest: boolean }[];
}

export type DrawFormat = 'knockout' | 'round_robin' | 'groups_knockout';

export interface Podium {
  champion: FixtureEntry | null;
  runnerUp: FixtureEntry | null;
  third: FixtureEntry[];
  final: { matchId: string | null; headline: string | null };
}

export interface EventDetail {
  id: string;
  tournament: { id: string; slug: string; name: string };
  name: string;
  status: EventStatus;
  sport: SportRef;
  format: { code: string; name: string; playersPerSide: number };
  ruleset: { id: string; name: string };
  drawFormat: DrawFormat;
  drawConfig: Record<string, unknown>;
  tiebreakers: Tiebreaker[];
  maxEntries: number | null;
  entries: EntryView[];
  myEntryId: string | null;
  podium: Podium | null;
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

/** A draw that has not been saved ("Not saved yet · draw code 4821"). */
export interface DrawPreview {
  randomSeed: number;
  preview: {
    name: string;
    type: string;
    groups: { key: string; name: string; entries: string[]; seeds: (number | null)[] }[];
    fixtures: { round: number; position: number; roundName: string | null; slots: string[]; seeds: (number | null)[] }[];
  }[];
}

export interface MyMatches {
  playing: FixtureView[];
  pendingEntries: { id: string; event: { id: string; name: string; sport: { slug: string; accentColor: string } }; tournament: { id: string; name: string } }[];
  scoring: FixtureView[];
  courts: { id: string; name: string }[];
  upcoming: FixtureView[];
}

export const DRAW_FORMATS: { value: DrawFormat; label: string }[] = [
  { value: 'knockout', label: 'Knockout' },
  { value: 'round_robin', label: 'Round robin' },
  { value: 'groups_knockout', label: 'Groups + knockout' },
];

export function drawFormatLabel(format: string): string {
  return DRAW_FORMATS.find((f) => f.value === format)?.label ?? format;
}
