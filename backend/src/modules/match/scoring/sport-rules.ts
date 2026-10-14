import { FormatType, PeriodType, ScoreEventType, ScoringType } from '../match.codes.js';
import type { OversConfig, RallyConfig, ScoringConfig, Side, TimedGoalsConfig } from './types.js';

export interface FormatRule {
  formatType: number;
  name: string;
  /** Players per side. */
  minPlayers: number;
  maxPlayers: number;
}

export interface SportRule {
  scoringType: number;
  periodType: number;
  formats: FormatRule[];
  config: ScoringConfig;
  events: Array<{ type: number; name: string }>;
  stats: Array<{ code: string; name: string }>;
}

const SINGLES: FormatRule = { formatType: FormatType.SINGLES, name: 'Singles', minPlayers: 1, maxPlayers: 1 };
const DOUBLES: FormatRule = { formatType: FormatType.DOUBLES, name: 'Doubles', minPlayers: 2, maxPlayers: 2 };
/** Team sports: a friendly can be scored with only the captains on the app. */
const team = (maxPlayers: number): FormatRule => ({ formatType: FormatType.TEAM, name: 'Team', minPlayers: 1, maxPlayers });

const rally = (periodName: RallyConfig['periodName'], pointsToWin: number, bestOf: number, extra: Partial<RallyConfig> = {}): RallyConfig => ({
  kind: 'rally',
  periodName,
  pointsToWin,
  winBy: 2,
  cap: null,
  bestOf,
  decidingPoints: null,
  ...extra,
});

const POINT_EVENTS = [{ type: ScoreEventType.POINT, name: 'Point won' }];
const RALLY_STATS = [
  { code: 'points_won', name: 'Points won' },
  { code: 'points_lost', name: 'Points lost' },
  { code: 'periods_won', name: 'Games won' },
];

/**
 * Default friendly-match rules per sport (`mst_sport.code`), written to the `mst_sport_*` setup
 * tables by `npm run seed`. At runtime the scoring config is read from `mst_sport_scoring`.
 */
export const SPORT_RULES: Record<string, SportRule> = {
  PICKLEBALL: {
    scoringType: ScoringType.POINT,
    periodType: PeriodType.GAME,
    formats: [SINGLES, DOUBLES],
    config: rally('Game', 11, 3),
    events: POINT_EVENTS,
    stats: RALLY_STATS,
  },
  BADMINTON: {
    scoringType: ScoringType.POINT,
    periodType: PeriodType.GAME,
    formats: [SINGLES, DOUBLES],
    config: rally('Game', 21, 3, { cap: 30 }),
    events: POINT_EVENTS,
    stats: RALLY_STATS,
  },
  TABLE_TENNIS: {
    scoringType: ScoringType.POINT,
    periodType: PeriodType.GAME,
    formats: [SINGLES, DOUBLES],
    config: rally('Game', 11, 5),
    events: POINT_EVENTS,
    stats: RALLY_STATS,
  },
  VOLLEYBALL: {
    scoringType: ScoringType.SET,
    periodType: PeriodType.SET,
    formats: [team(6)],
    config: rally('Set', 25, 5, { decidingPoints: 15 }),
    events: POINT_EVENTS,
    stats: [...RALLY_STATS.slice(0, 2), { code: 'periods_won', name: 'Sets won' }],
  },
  FOOTBALL: {
    scoringType: ScoringType.TIME_GOAL,
    periodType: PeriodType.HALF,
    formats: [team(11)],
    config: { kind: 'timed_goals', periods: 2, periodMinutes: 20 },
    events: [
      { type: ScoreEventType.GOAL, name: 'Goal' },
      { type: ScoreEventType.PERIOD_END, name: 'End of half' },
    ],
    stats: [
      { code: 'goals_for', name: 'Goals scored' },
      { code: 'goals_against', name: 'Goals conceded' },
    ],
  },
  BOX_CRICKET: {
    scoringType: ScoringType.OVER,
    periodType: PeriodType.INNINGS,
    formats: [team(11)],
    config: { kind: 'overs', overs: 6, ballsPerOver: 6, wickets: 5, wideRuns: 1, noBallRuns: 1, battingFirst: 1 },
    events: [
      { type: ScoreEventType.BALL, name: 'Ball' },
      { type: ScoreEventType.INNINGS_END, name: 'End of innings' },
    ],
    stats: [
      { code: 'runs_for', name: 'Runs scored' },
      { code: 'runs_against', name: 'Runs conceded' },
    ],
  },
};

/** Rule changes the players may pick when starting a match. Each applies only to its kind. */
export interface MatchOptions {
  bestOf?: 1 | 3 | 5 | undefined;
  pointsToWin?: number | undefined;
  periodMinutes?: number | undefined;
  overs?: number | undefined;
  wickets?: number | undefined;
  battingFirst?: Side | undefined;
}

export function applyOptions(config: ScoringConfig, options: MatchOptions): ScoringConfig {
  switch (config.kind) {
    case 'rally': {
      const next: RallyConfig = { ...config };
      if (options.bestOf) next.bestOf = options.bestOf;
      if (options.pointsToWin) {
        // Keep the cap the same distance above the target (badminton 21 -> cap 30; 15 -> 24).
        next.cap = config.cap === null ? null : options.pointsToWin + (config.cap - config.pointsToWin);
        next.pointsToWin = options.pointsToWin;
      }
      return next;
    }
    case 'timed_goals':
      return { ...config, ...(options.periodMinutes ? { periodMinutes: options.periodMinutes } : {}) } satisfies TimedGoalsConfig;
    case 'overs':
      return {
        ...config,
        ...(options.overs ? { overs: options.overs } : {}),
        ...(options.wickets ? { wickets: options.wickets } : {}),
        ...(options.battingFirst ? { battingFirst: options.battingFirst } : {}),
      } satisfies OversConfig;
  }
}
