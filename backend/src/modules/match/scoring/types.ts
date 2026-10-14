/** Side 1 or side 2 of a match (a player, a pair or a team). */
export type Side = 1 | 2;
/** A value per side: index 0 is side 1. */
export type Pair = [number, number];

/** Pickleball, badminton, table tennis, volleyball: first to N points (win by M) per game/set, best of K. */
export interface RallyConfig {
  kind: 'rally';
  periodName: 'Game' | 'Set';
  pointsToWin: number;
  winBy: number;
  /** A game ends when either side reaches this, lead or not (badminton: 30). */
  cap: number | null;
  bestOf: number;
  /** Points needed in the deciding game/set, when different (volleyball: 15). */
  decidingPoints: number | null;
}

/** Football: goals over timed periods; the scorer ends each period. Draws allowed. */
export interface TimedGoalsConfig {
  kind: 'timed_goals';
  periods: number;
  periodMinutes: number;
}

/** Box cricket: two innings of N overs; an innings ends on overs, wickets, or the target being passed. */
export interface OversConfig {
  kind: 'overs';
  overs: number;
  ballsPerOver: number;
  /** Wickets that end an innings. */
  wickets: number;
  wideRuns: number;
  noBallRuns: number;
  battingFirst: Side;
}

export type ScoringConfig = RallyConfig | TimedGoalsConfig | OversConfig;
export type ScoringKind = ScoringConfig['kind'];

export type BallExtra = 'none' | 'wide' | 'no_ball';

export type ScoreEvent =
  | { type: 'point'; side: Side }
  | { type: 'goal'; side: Side }
  | { type: 'period_end' }
  /** `runs`: off the bat (or run on a wide / no-ball), on top of the extra's own runs. */
  | { type: 'ball'; runs: number; extra: BallExtra; wicket: boolean }
  | { type: 'innings_end' };

export type ScoreEventType = ScoreEvent['type'];

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
  /** "3.2" = 3 overs and 2 balls. */
  overs: string;
  extras: number;
  finished: boolean;
}

export interface CricketView {
  battingSide: Side;
  innings: InningsView[];
  /** Runs side 2 of the chase needs to win (first innings + 1); null in the first innings. */
  target: number | null;
  /** Ball-by-ball labels of the current (or just completed) over: "1", "4", "W", "Wd", "Nb+2", "•". */
  thisOver: string[];
}

/** Everything a client needs to draw the scoreboard; derived by replaying the events. */
export interface ScoreView {
  kind: ScoringKind;
  finished: boolean;
  /** Set once finished; null on a draw (or while live). */
  winner: Side | null;
  currentPeriod: PeriodScore;
  periods: PeriodScore[];
  /** The big number per side: games/sets won, goals, or runs. */
  headline: Pair;
  /** Points, goals or runs per side over the whole match (feeds points scored/conceded stats). */
  totals: Pair;
  /** "11-7, 9-11, 11-5" / "2-1" / "54/3 (6.0) – 50/5 (6.0)". */
  summary: string;
  cricket: CricketView | null;
  /** Event types the scorer may send next. */
  allowedEvents: ScoreEventType[];
}

export interface ScoringEngine<C extends ScoringConfig, S> {
  initial(config: C): S;
  /** Returns the next state; throws ScoringError when the event is not valid now. Never mutates `state`. */
  apply(config: C, state: S, event: ScoreEvent): S;
  view(config: C, state: S): ScoreView;
}

export class ScoringError extends Error {
  constructor(
    readonly code: 'MATCH_OVER' | 'INVALID_EVENT',
    message: string,
  ) {
    super(message);
    this.name = 'ScoringError';
  }
}

export function other(side: Side): Side {
  return side === 1 ? 2 : 1;
}
