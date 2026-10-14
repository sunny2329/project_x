/*
 * Lookup values stored in `type_master`. `type_master.type_id` is the category and
 * `type_master.id` the value, which other tables store (e.g. `mst_sport_format.format_type_id`).
 * Ids are fixed (category × 100 + n) so code can refer to them; `npm run seed` inserts them.
 * See wiki.md "Match module > Lookup codes".
 */

export const TypeCategory = {
  FORMAT: 1,
  SCORING: 2,
  PERIOD: 3,
  SCORE_EVENT: 4,
  STAT_DATA: 5,
  MATCH_STATUS: 6,
  MATCH_TYPE: 7,
  POST_TYPE: 8,
  CORRECTION: 9,
  PERIOD_STATUS: 10,
  RESULT: 11,
  POST_VISIBILITY: 12,
  CONVERSATION_TYPE: 13,
} as const;

export const FormatType = { SINGLES: 101, DOUBLES: 102, TEAM: 103 } as const;
export const ScoringType = { POINT: 201, SET: 202, TIME_GOAL: 203, OVER: 204 } as const;
export const PeriodType = { GAME: 301, SET: 302, HALF: 303, INNINGS: 304 } as const;
export const ScoreEventType = { POINT: 401, GOAL: 402, PERIOD_END: 403, BALL: 404, INNINGS_END: 405 } as const;
export const StatDataType = { INTEGER: 501 } as const;
export const MatchStatus = { SCHEDULED: 601, LIVE: 602, COMPLETED: 603, ABANDONED: 604 } as const;
export const MatchType = { FRIENDLY: 701 } as const;
export const PostType = { MATCH_RESULT: 801, TEXT: 802 } as const;
/** `social_post.visibility_id`; NULL (older match posts) counts as public. */
export const PostVisibility = { PUBLIC: 1201, FOLLOWERS: 1202 } as const;
export const ConversationType = { DIRECT: 1301, GROUP: 1302 } as const;
export const CorrectionType = { UNDO: 901 } as const;
export const PeriodStatus = { LIVE: 1001, COMPLETED: 1002, VOID: 1003 } as const;
export const ResultType = { WIN: 1101, DRAW: 1102 } as const;

/** Every `type_master` row the app relies on: [id, category, description]. */
export const TYPE_MASTER_ROWS: ReadonlyArray<readonly [number, number, string]> = [
  [FormatType.SINGLES, TypeCategory.FORMAT, 'Singles'],
  [FormatType.DOUBLES, TypeCategory.FORMAT, 'Doubles'],
  [FormatType.TEAM, TypeCategory.FORMAT, 'Team'],
  [ScoringType.POINT, TypeCategory.SCORING, 'Point-based'],
  [ScoringType.SET, TypeCategory.SCORING, 'Set/rally-based'],
  [ScoringType.TIME_GOAL, TypeCategory.SCORING, 'Time + goal-based'],
  [ScoringType.OVER, TypeCategory.SCORING, 'Over-based'],
  [PeriodType.GAME, TypeCategory.PERIOD, 'Game'],
  [PeriodType.SET, TypeCategory.PERIOD, 'Set'],
  [PeriodType.HALF, TypeCategory.PERIOD, 'Half'],
  [PeriodType.INNINGS, TypeCategory.PERIOD, 'Innings'],
  [ScoreEventType.POINT, TypeCategory.SCORE_EVENT, 'Point'],
  [ScoreEventType.GOAL, TypeCategory.SCORE_EVENT, 'Goal'],
  [ScoreEventType.PERIOD_END, TypeCategory.SCORE_EVENT, 'Period end'],
  [ScoreEventType.BALL, TypeCategory.SCORE_EVENT, 'Ball'],
  [ScoreEventType.INNINGS_END, TypeCategory.SCORE_EVENT, 'Innings end'],
  [StatDataType.INTEGER, TypeCategory.STAT_DATA, 'Integer'],
  [MatchStatus.SCHEDULED, TypeCategory.MATCH_STATUS, 'Scheduled'],
  [MatchStatus.LIVE, TypeCategory.MATCH_STATUS, 'Live'],
  [MatchStatus.COMPLETED, TypeCategory.MATCH_STATUS, 'Completed'],
  [MatchStatus.ABANDONED, TypeCategory.MATCH_STATUS, 'Abandoned'],
  [MatchType.FRIENDLY, TypeCategory.MATCH_TYPE, 'Friendly'],
  [PostType.MATCH_RESULT, TypeCategory.POST_TYPE, 'Match result'],
  [PostType.TEXT, TypeCategory.POST_TYPE, 'Post'],
  [PostVisibility.PUBLIC, TypeCategory.POST_VISIBILITY, 'Public'],
  [PostVisibility.FOLLOWERS, TypeCategory.POST_VISIBILITY, 'Followers'],
  [ConversationType.DIRECT, TypeCategory.CONVERSATION_TYPE, 'Direct'],
  [ConversationType.GROUP, TypeCategory.CONVERSATION_TYPE, 'Group'],
  [CorrectionType.UNDO, TypeCategory.CORRECTION, 'Undo'],
  [PeriodStatus.LIVE, TypeCategory.PERIOD_STATUS, 'Live'],
  [PeriodStatus.COMPLETED, TypeCategory.PERIOD_STATUS, 'Completed'],
  [PeriodStatus.VOID, TypeCategory.PERIOD_STATUS, 'Void (reopened by undo)'],
  [ResultType.WIN, TypeCategory.RESULT, 'Win'],
  [ResultType.DRAW, TypeCategory.RESULT, 'Draw'],
];
