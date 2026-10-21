/*
 * Mirrors the backend's generic match API (backend/src/modules/matches/matches.types.ts and
 * backend/src/engine/scoring/types.ts). Nothing here is sport-specific: every sport's scoreboard
 * and scoring buttons come from the plugin's ScoreSummary.
 */

export interface PluginEvent {
  type: string;
  [key: string]: unknown;
}

export interface ScoringAction {
  id: string;
  label: string;
  sideIndex: number | null;
  event: PluginEvent;
}

export interface SideSummary {
  index: number;
  primary: string;
  current: string | null;
  serving: boolean;
  serverNumber: 1 | 2 | null;
  serverPlayerIndex: number | null;
  serveNote: string | null;
}

export interface SegmentSummary {
  type: string;
  sequence: number;
  label: string;
  scores: number[];
  display: string[];
  winnerSideIndex: number | null;
  complete: boolean;
  children: SegmentSummary[];
}

export interface ScoreSummary {
  scoringModel: string;
  complete: boolean;
  winnerSideIndex: number | null;
  sides: SideSummary[];
  segments: SegmentSummary[];
  headline: string;
  callout: string | null;
  totals: { major: number[]; minor: number[]; majorLabel: string; minorLabel: string };
  actions: ScoringAction[];
}

export interface SportRef {
  id: string;
  slug: string;
  name: string;
  /** MaterialCommunityIcons name. */
  iconKey: string;
  accentColor: string;
}

export interface FormatOption {
  code: string;
  name: string;
  playersPerSide: number;
  minPerSide: number;
  maxPerSide: number;
}

export interface RulesetOption {
  id: string;
  slug: string;
  name: string;
  scoringModel: string;
  isDefault: boolean;
  config: Record<string, unknown>;
}

/** GET /api/v1/sports (active sports only). */
export interface SportSummary extends SportRef {
  category: string;
  formats: FormatOption[];
  rulesets: RulesetOption[];
}

export interface PlayerRef {
  playerId: string;
  userId: string | null;
  displayName: string;
  isGuest: boolean;
}

/** A search result: a registered user (maybe no player row yet) or one of my guests. */
export interface PlayerOption {
  playerId: string | null;
  userId: string | null;
  username: string | null;
  displayName: string;
  isGuest: boolean;
  /** Rating in the sport searched for (registered players with a rating). */
  rating: number | null;
  photoUrl: string | null;
}

export type ParticipantInput = { playerId: string } | { userId: string } | { guest: { displayName: string; phone?: string | null } };

export type MatchStatus = 'scheduled' | 'live' | 'completed' | 'abandoned' | 'disputed' | 'walkover' | 'retired';
export type ResultType = 'played' | 'walkover' | 'no_show' | 'retired' | 'double_walkover';
export type Verification = 'not_required' | 'pending' | 'confirmed' | 'disputed';

export interface SideView {
  index: number;
  name: string;
  teamId: string | null;
  entryId: string | null;
  players: PlayerRef[];
  outcome: 'won' | 'lost' | 'drawn' | null;
}

export interface TournamentRef {
  tournamentId: string;
  slug: string;
  name: string;
  eventId: string;
  eventName: string;
  fixtureId: string;
  roundName: string | null;
}

export interface ConfirmationView {
  status: Verification;
  canConfirm: boolean;
  decisions: { sideIndex: number; displayName: string; decision: 'confirmed' | 'disputed'; comment: string | null; decidedAt: string }[];
}

export interface MatchView {
  id: string;
  /** The ruleset snapshot the match is scored with. */
  rulesetConfig: unknown;
  /** Plugin events in order; replaying them gives `score`. */
  events: PluginEvent[];
  context: 'friendly' | 'tournament';
  sport: SportRef;
  format: { code: string; name: string; playersPerSide: number };
  ruleset: { id: string | null; name: string | null; scoringModel: string };
  scoringMode: 'live' | 'manual';
  shareToken: string;
  createdByUserId: string;
  venue: { id: string; name: string } | null;
  court: { id: string; name: string } | null;
  tournament: TournamentRef | null;
  sides: SideView[];
  status: MatchStatus;
  resultType: ResultType | null;
  score: ScoreSummary;
  version: number;
  canScore: boolean;
  startedAt: string | null;
  completedAt: string | null;
  ratingChanges: { playerId: string; before: number; after: number }[];
  confirmation: ConfirmationView;
}

export interface MatchCard {
  id: string;
  context: 'friendly' | 'tournament';
  status: MatchStatus;
  sport: SportRef;
  sides: { index: number; name: string; outcome: SideView['outcome'] }[];
  score: Pick<ScoreSummary, 'headline' | 'complete' | 'winnerSideIndex' | 'callout'> & {
    sides: { index: number; primary: string; current: string | null; serving: boolean }[];
  };
  mine: boolean;
  startedAt: string | null;
  updatedAt: string;
}

export interface NewMatch {
  sport: string;
  format: string;
  rulesetId?: string;
  sides: { name?: string; players: ParticipantInput[] }[];
  /** Result entered afterwards: one [side 0, side 1] score per game/set. */
  manualScores?: number[][];
  /** Results afterwards: YYYY-MM-DD. */
  playedOn?: string;
  venueName?: string;
  /** Plugin options on top of the ruleset (who serves first). */
  rulesOverride?: Record<string, unknown>;
}

/** Ratings, photos and scorer names for the watching and confirming screens. */
export interface MatchDetails {
  players: { playerId: string; userId: string | null; username: string | null; photoUrl: string | null; rating: number | null }[];
  scorers: { userId: string; name: string }[];
}
