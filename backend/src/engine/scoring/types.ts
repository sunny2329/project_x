/*
 * The scoring plugin contract. Everything under src/engine is pure TypeScript: no Express, pg,
 * Prisma, Redis or app imports (enforced by eslint/tests), so it can move into a shared package.
 */
import type { z } from 'zod';

/** A side as the plugin sees it: its 0-based index and how many players it fields. */
export interface SideInfo {
  index: number;
  playerCount: number;
}

/** Every plugin event is an object with a string `type`; the rest is plugin-defined. */
export interface PluginEvent {
  type: string;
}

/** A button the scorer may press next, carrying the exact event to send. */
export interface ScoringAction {
  id: string;
  label: string;
  /** The side the button belongs to (drawn under that side), or null for match-level actions. */
  sideIndex: number | null;
  event: PluginEvent;
}

export interface SideSummary {
  index: number;
  /** The big number: games or sets won. */
  primary: string;
  /** The running score inside the current unit ("17", "40", "AD"), or null when there is none. */
  current: string | null;
  serving: boolean;
  /** Pickleball doubles: server 1 or 2; null elsewhere. */
  serverNumber: 1 | 2 | null;
  /** Which of the side's players serves (0-based, by order in the side). */
  serverPlayerIndex: number | null;
  /** Extra serve detail for the scorer, e.g. "Right court". */
  serveNote: string | null;
}

/** One node of the score hierarchy (set -> game -> tiebreak), mirrored into match_segments. */
export interface SegmentSummary {
  /** Plugin-defined segment type: "game", "set", "tiebreak", "match_tiebreak" ... */
  type: string;
  /** 1-based position among its siblings of any type. */
  sequence: number;
  label: string;
  /** Raw score per side (points, or games for a set). */
  scores: number[];
  /** Display score per side ("15", "AD", "6"). */
  display: string[];
  winnerSideIndex: number | null;
  complete: boolean;
  children: SegmentSummary[];
}

/** The generic display and stats shape. UI, feeds, profiles and standings read only this. */
export interface ScoreSummary {
  scoringModel: string;
  complete: boolean;
  winnerSideIndex: number | null;
  sides: SideSummary[];
  segments: SegmentSummary[];
  /** "21-17, 18-21, 21-19" / "6-4, 7-6(5), [10-7]" (side 0 first). */
  headline: string;
  /** "Deuce", "Golden point", "4-7-2", "Match point" ... */
  callout: string | null;
  /**
   * Units for records and tiebreakers. major = games (badminton) or sets (tennis);
   * minor = points (badminton) or games (tennis).
   */
  totals: { major: number[]; minor: number[]; majorLabel: string; minorLabel: string };
  actions: ScoringAction[];
}

export interface ScoringPlugin<Config = unknown, State = unknown, Event extends PluginEvent = PluginEvent> {
  /** Registry key, stored on sports.scoring_model and matches.scoring_model. */
  readonly scoringModel: string;
  readonly configSchema: z.ZodType<Config>;
  readonly eventSchema: z.ZodType<Event>;
  /** Null when this side layout is playable under `config`, else a message for the user. */
  validateSides(config: Config, sides: SideInfo[]): string | null;
  initialState(config: Config, sides: SideInfo[]): State;
  /** Pure: returns the next state, never mutates `state`. Throws ScoringError when not allowed. */
  applyEvent(state: State, event: Event, config: Config): State;
  isComplete(state: State): boolean;
  summary(state: State, config: Config): ScoreSummary;
  /**
   * Optional: events that reproduce a typed-in final score (manual results), one inner array per
   * top-level segment, scores per side ([[21, 15], [18, 21], [21, 19]] or tennis [[6, 4], [7, 6]]).
   * The core replays them and checks that the match is complete.
   */
  eventsForManualResult?(config: Config, sides: SideInfo[], scores: number[][]): Event[];
}

export type ScoringErrorCode = 'UNKNOWN_SCORING_MODEL' | 'INVALID_CONFIG' | 'INVALID_SIDES' | 'INVALID_EVENT' | 'MATCH_COMPLETE' | 'INVALID_RESULT';

export class ScoringError extends Error {
  constructor(
    readonly code: ScoringErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ScoringError';
  }
}
