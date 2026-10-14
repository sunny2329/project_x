import type { ScoreView, ScoringConfig, ScoringKind, Side } from './scoring/types.js';

export type MatchStatusName = 'live' | 'completed' | 'abandoned';

export interface SportRef {
  id: string;
  code: string;
  name: string;
}

/** A sport with its formats and default rules, for the "Start a match" screen. */
export interface SportSetup {
  sport: SportRef;
  kind: ScoringKind;
  formats: Array<{ id: string; name: string; minPlayers: number; maxPlayers: number }>;
  /** Default rules (the first format's; formats of one sport share rules today). */
  defaults: ScoringConfig;
}

export interface PlayerRef {
  participantId: string;
  userId: string;
  username: string;
  fullName: string;
}

export interface MatchSide {
  no: Side;
  teamId: string;
  name: string;
  players: PlayerRef[];
}

/** A match in a list (live now, feed). `score` is the scoreboard as of the last change. */
export interface MatchCard {
  id: string;
  sport: SportRef;
  status: MatchStatusName;
  sides: Array<{ no: Side; name: string }>;
  score: ScoreView;
  /** True when the signed-in user created (and so can score) the match. */
  mine: boolean;
  startedAt: string;
  updatedAt: string;
}

export interface RatingChange {
  userId: string;
  before: number;
  after: number;
}

export interface MatchDetail {
  id: string;
  sport: SportRef;
  format: { id: string; name: string };
  status: MatchStatusName;
  createdBy: string;
  /** Only the creator scores, so two phones never race on the same point. */
  canScore: boolean;
  config: ScoringConfig;
  sides: MatchSide[];
  score: ScoreView;
  /**
   * Increases with every event and every undo. Scoring requests echo it back, so a retried or
   * stale request (e.g. a double tap after a slow response) is rejected instead of counted twice.
   */
  version: number;
  startedAt: string;
  completedAt: string | null;
  /** When the current game/half/innings started (drives the football clock). */
  currentPeriodStartedAt: string | null;
  /** Rating changes, once the result has been saved. */
  ratingChanges: RatingChange[];
}
