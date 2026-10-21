import type { ScoreSummary } from '../../engine/scoring/index.js';
import type { PlayerRef } from '../players/players.service.js';

export type MatchStatusName = 'scheduled' | 'live' | 'completed' | 'abandoned' | 'disputed' | 'walkover' | 'retired';
export type MatchContextName = 'friendly' | 'tournament';
export type ResultTypeName = 'played' | 'walkover' | 'no_show' | 'retired' | 'double_walkover';
export type VerificationName = 'not_required' | 'pending' | 'confirmed' | 'disputed';

export interface SportRef {
  id: string;
  slug: string;
  name: string;
  iconKey: string;
  accentColor: string;
}

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

/** What does not change while a match is played; cached with the live state. */
export interface MatchStatic {
  id: string;
  context: MatchContextName;
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
}

export interface RatingChange {
  playerId: string;
  before: number;
  after: number;
}

export interface ConfirmationView {
  status: VerificationName;
  /** True when the viewer is the opponent who may confirm or dispute this result. */
  canConfirm: boolean;
  decisions: Array<{ sideIndex: number; displayName: string; decision: 'confirmed' | 'disputed'; comment: string | null; decidedAt: string }>;
}

export interface MatchView extends MatchStatic {
  /** The ruleset snapshot the match is scored with (lets the app preview a point before the server answers). */
  rulesetConfig: unknown;
  /** Plugin events in order (undone ones left out): replaying them gives `score`. */
  events: unknown[];
  status: MatchStatusName;
  resultType: ResultTypeName | null;
  score: ScoreSummary;
  /** Echoed back by scoring requests; a stale or repeated request is rejected (409 STALE_MATCH). */
  version: number;
  canScore: boolean;
  startedAt: string | null;
  completedAt: string | null;
  ratingChanges: RatingChange[];
  confirmation: ConfirmationView;
}

/** A match in lists (live now, history, fixtures). */
export interface MatchCard {
  id: string;
  context: MatchContextName;
  status: MatchStatusName;
  sport: SportRef;
  sides: Array<{ index: number; name: string; outcome: SideView['outcome'] }>;
  score: Pick<ScoreSummary, 'headline' | 'complete' | 'winnerSideIndex' | 'callout'> & { sides: Array<{ index: number; primary: string; current: string | null; serving: boolean }> };
  mine: boolean;
  startedAt: string | null;
  updatedAt: string;
}

/** Extra facts for the watching and confirming screens: ratings, photos and who is scoring. */
export interface MatchDetails {
  players: Array<{ playerId: string; userId: string | null; username: string | null; photoUrl: string | null; rating: number | null }>;
  scorers: Array<{ userId: string; name: string }>;
}
