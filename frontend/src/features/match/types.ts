/** Mirrors backend/src/modules/match/scoring/types.ts and match.types.ts. */
export type Side = 1 | 2;
export type Pair = [number, number];
export type ScoringKind = 'rally' | 'timed_goals' | 'overs';

export interface RallyConfig {
  kind: 'rally';
  periodName: 'Game' | 'Set';
  pointsToWin: number;
  winBy: number;
  cap: number | null;
  bestOf: number;
  decidingPoints: number | null;
}

export interface TimedGoalsConfig {
  kind: 'timed_goals';
  periods: number;
  periodMinutes: number;
}

export interface OversConfig {
  kind: 'overs';
  overs: number;
  ballsPerOver: number;
  wickets: number;
  wideRuns: number;
  noBallRuns: number;
  battingFirst: Side;
}

export type ScoringConfig = RallyConfig | TimedGoalsConfig | OversConfig;

export type BallExtra = 'none' | 'wide' | 'no_ball';

export type ScoreEvent =
  | { type: 'point'; side: Side }
  | { type: 'goal'; side: Side }
  | { type: 'period_end' }
  | { type: 'ball'; runs: number; extra: BallExtra; wicket: boolean }
  | { type: 'innings_end' };

export interface PeriodScore {
  no: number;
  label: string;
  score: Pair;
  winner: Side | null;
  finished: boolean;
}

export interface InningsView {
  battingSide: Side;
  runs: number;
  wickets: number;
  legalBalls: number;
  overs: string;
  extras: number;
  finished: boolean;
}

export interface ScoreView {
  kind: ScoringKind;
  finished: boolean;
  winner: Side | null;
  currentPeriod: PeriodScore;
  periods: PeriodScore[];
  headline: Pair;
  totals: Pair;
  summary: string;
  cricket: { battingSide: Side; innings: InningsView[]; target: number | null; thisOver: string[] } | null;
  allowedEvents: ScoreEvent['type'][];
}

export interface SportRef {
  id: string;
  code: string;
  name: string;
}

export interface FormatSetup {
  id: string;
  name: string;
  minPlayers: number;
  maxPlayers: number;
}

export interface SportSetup {
  sport: SportRef;
  kind: ScoringKind;
  formats: FormatSetup[];
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

export type MatchStatus = 'live' | 'completed' | 'abandoned';

export interface MatchCard {
  id: string;
  sport: SportRef;
  status: MatchStatus;
  sides: { no: Side; name: string }[];
  score: ScoreView;
  mine: boolean;
  startedAt: string;
  updatedAt: string;
}

export interface MatchDetail {
  id: string;
  sport: SportRef;
  format: { id: string; name: string };
  status: MatchStatus;
  createdBy: string;
  canScore: boolean;
  config: ScoringConfig;
  sides: MatchSide[];
  score: ScoreView;
  version: number;
  startedAt: string;
  completedAt: string | null;
  currentPeriodStartedAt: string | null;
  ratingChanges: { userId: string; before: number; after: number }[];
}

/** A player found by search (no contact details). */
export interface PlayerSummary {
  id: string;
  username: string;
  fullName: string;
}

export interface MatchOptions {
  bestOf?: 1 | 3 | 5;
  pointsToWin?: number;
  periodMinutes?: number;
  overs?: number;
  wickets?: number;
  battingFirst?: Side;
}

export interface NewMatch {
  sportId: string;
  formatId: string;
  sides: [{ name?: string; playerIds: string[] }, { name?: string; playerIds: string[] }];
  options: MatchOptions;
}
