/**
 * Limited-overs scoring: box cricket. Each side bats once; more runs wins. A level match goes to
 * a super over (repeated until someone wins), so a played match always has a winner and knockouts
 * and standings need no special case. Scores are team totals: no batters or bowlers yet.
 */
import { z } from 'zod';
import { ScoringError, type ScoreSummary, type ScoringAction, type ScoringPlugin, type SegmentSummary, type SideInfo } from '../types.js';
import { matchComplete, other, sideIndexSchema } from './common.js';

const MAX_RUNS_PER_BALL = 6;
const MAX_INNINGS_TOTAL = 999;

export const oversConfigSchema = z
  .object({
    overs: z.number().int().min(1).max(50),
    /** Wickets that end an innings (not tied to the players listed: most teams only list a captain). */
    wickets: z.number().int().min(1).max(11),
    /** "6 a side": no side may list more players. Unset: up to 11. */
    playersPerSide: z.number().int().min(1).max(11).optional(),
    ballsPerOver: z.number().int().min(1).max(10).default(6),
    /** Runs a wide or no-ball costs, on top of anything run off it. */
    wideRuns: z.number().int().min(0).max(2).default(1),
    noBallRuns: z.number().int().min(0).max(2).default(1),
    superOverOvers: z.number().int().min(1).max(5).default(1),
    superOverWickets: z.number().int().min(1).max(11).default(2),
    battingFirstSideIndex: sideIndexSchema.default(0),
  })
  // Last man stands allows as many wickets as players, never more.
  .refine((c) => !c.playersPerSide || c.wickets <= c.playersPerSide, {
    message: 'Wickets can’t be more than the players a side',
    path: ['wickets'],
  })
  .refine((c) => !c.playersPerSide || c.superOverWickets <= c.playersPerSide, {
    message: 'Super over wickets can’t be more than the players a side',
    path: ['superOverWickets'],
  });

export type OversConfig = z.infer<typeof oversConfigSchema>;

export const oversEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('ball'),
    runs: z.number().int().min(0).max(MAX_RUNS_PER_BALL),
    extra: z.enum(['none', 'wide', 'no_ball']).default('none'),
    wicket: z.boolean().default(false),
  }),
  /** Declared, rain, out of time ... */
  z.object({ type: z.literal('innings_end') }),
  /** The toss went the other way: only before the first ball of the match. */
  z.object({ type: z.literal('swap_batting') }),
  /** A whole innings typed in afterwards (manual results): no balls, wickets or overs are known. */
  z.object({
    type: z.literal('innings_total'),
    runs: z.number().int().min(0).max(MAX_INNINGS_TOTAL),
  }),
]);

export type OversEvent = z.infer<typeof oversEventSchema>;

interface Ball {
  label: string;
  legal: boolean;
}

interface Innings {
  battingSide: 0 | 1;
  runs: number;
  wickets: number;
  legalBalls: number;
  balls: Ball[];
  finished: boolean;
  /** Entered as a total, so only the runs mean anything. */
  totalOnly: boolean;
}

export interface OversState {
  /** Every innings in order: two per period (the match, then each super over). */
  innings: Innings[];
  winner: 0 | 1 | null;
}

function newInnings(battingSide: 0 | 1): Innings {
  return {
    battingSide,
    runs: 0,
    wickets: 0,
    legalBalls: 0,
    balls: [],
    finished: false,
    totalOnly: false,
  };
}

const periodOf = (inningsIndex: number) => Math.floor(inningsIndex / 2);

function limits(config: OversConfig, inningsIndex: number): { overs: number; wickets: number } {
  return periodOf(inningsIndex) === 0 ? { overs: config.overs, wickets: config.wickets } : { overs: config.superOverOvers, wickets: config.superOverWickets };
}

function oversText(legalBalls: number, ballsPerOver: number): string {
  return `${Math.floor(legalBalls / ballsPerOver)}.${legalBalls % ballsPerOver}`;
}

function ballLabel(runs: number, extra: 'none' | 'wide' | 'no_ball', wicket: boolean): string {
  const tail = wicket ? ' W' : '';
  if (extra === 'wide') return `Wd${runs ? `+${runs}` : ''}${tail}`;
  if (extra === 'no_ball') return `Nb${runs ? `+${runs}` : ''}${tail}`;
  if (wicket) return runs ? `${runs} W` : 'W';
  return runs ? String(runs) : '•';
}

/** The side's score in an innings: "48/3", or just the runs when it was typed in as a total. */
function inningsScore(inn: Innings): string {
  return inn.totalOnly ? String(inn.runs) : `${inn.runs}/${inn.wickets}`;
}

/** Closes the last innings: starts the next one, decides the match, or goes to a super over. */
function afterInnings(innings: Innings[]): OversState {
  const closed = innings.at(-1)!;
  if (innings.length % 2 === 1)
    return {
      innings: [...innings, newInnings(other(closed.battingSide))],
      winner: null,
    };
  const first = innings.at(-2)!;
  if (first.runs === closed.runs)
    return {
      innings: [...innings, newInnings(closed.battingSide)],
      winner: null,
    }; // The side that batted second bats first.
  return {
    innings,
    winner: first.runs > closed.runs ? first.battingSide : closed.battingSide,
  };
}

function applyBall(state: OversState, event: Extract<OversEvent, { type: 'ball' }>, config: OversConfig): OversState {
  const index = state.innings.length - 1;
  const inn = state.innings[index]!;
  const penalty = event.extra === 'wide' ? config.wideRuns : event.extra === 'no_ball' ? config.noBallRuns : 0;
  const legal = event.extra === 'none';
  const next: Innings = {
    ...inn,
    runs: inn.runs + event.runs + penalty,
    wickets: inn.wickets + (event.wicket ? 1 : 0),
    legalBalls: inn.legalBalls + (legal ? 1 : 0),
    balls: [...inn.balls, { label: ballLabel(event.runs, event.extra, event.wicket), legal }],
  };
  const limit = limits(config, index);
  const chaseWon = index % 2 === 1 && next.runs > state.innings[index - 1]!.runs;
  const finished = next.wickets >= limit.wickets || next.legalBalls >= limit.overs * config.ballsPerOver || chaseWon;
  const innings = [...state.innings.slice(0, index), { ...next, finished }];
  return finished ? afterInnings(innings) : { ...state, innings };
}

function applyOvers(state: OversState, event: OversEvent, config: OversConfig): OversState {
  if (state.winner !== null) matchComplete();
  const index = state.innings.length - 1;
  const inn = state.innings[index]!;
  switch (event.type) {
    case 'ball':
      return applyBall(state, event, config);
    case 'innings_end':
      return afterInnings([...state.innings.slice(0, index), { ...inn, finished: true }]);
    case 'swap_batting':
      if (index !== 0 || inn.balls.length > 0) throw new ScoringError('INVALID_EVENT', 'The batting order can only change before the first ball.');
      return { ...state, innings: [newInnings(other(inn.battingSide))] };
    case 'innings_total':
      if (inn.balls.length > 0) throw new ScoringError('INVALID_EVENT', 'This innings already has balls scored.');
      return afterInnings([...state.innings.slice(0, index), { ...inn, runs: event.runs, finished: true, totalOnly: true }]);
  }
}

/** "6 overs · 5 wickets", then only what differs from the usual game ("· 6 a side · 4-ball overs"). */
export function describeOvers(config: OversConfig): string {
  const parts = [`${config.overs} over${config.overs === 1 ? '' : 's'}`, `${config.wickets} wicket${config.wickets === 1 ? '' : 's'}`];
  if (config.playersPerSide) parts.push(`${config.playersPerSide} a side`);
  if (config.ballsPerOver !== 6) parts.push(`${config.ballsPerOver}-ball overs`);
  return parts.join(' · ');
}

/** Balls of the over in progress; right after an over ends, that over (until the next ball). */
function thisOver(inn: Innings, ballsPerOver: number): string[] {
  if (inn.legalBalls === 0) return inn.balls.map((b) => b.label);
  const overStart = inn.legalBalls - (inn.legalBalls % ballsPerOver || ballsPerOver);
  let legal = 0;
  let start = 0;
  if (overStart > 0) {
    start = inn.balls.findIndex((b) => {
      if (b.legal) legal += 1;
      return legal === overStart;
    });
    start += 1;
  }
  return inn.balls.slice(start).map((b) => b.label);
}

function segments(state: OversState, config: OversConfig): SegmentSummary[] {
  const out: SegmentSummary[] = [];
  for (let i = 0; i < state.innings.length; i += 2) {
    const pair = state.innings.slice(i, i + 2);
    const scores = [0, 0];
    const display = ['-', '-'];
    for (const inn of pair) {
      scores[inn.battingSide] = inn.runs;
      display[inn.battingSide] = inningsScore(inn);
    }
    const complete = pair.length === 2 && pair[1]!.finished;
    const period = periodOf(i);
    out.push({
      type: period === 0 ? 'regulation' : 'super_over',
      sequence: period + 1,
      label: period === 0 ? 'Match' : `Super over ${period}`,
      scores,
      display,
      winnerSideIndex: !complete || scores[0] === scores[1] ? null : scores[0]! > scores[1]! ? 0 : 1,
      complete,
      children: pair.map((inn, j) => ({
        type: 'innings',
        sequence: j + 1,
        label: period > 0 ? `Super over ${period}` : j === 0 ? '1st innings' : '2nd innings',
        scores: [inn.battingSide === 0 ? inn.runs : 0, inn.battingSide === 1 ? inn.runs : 0],
        display: [0, 1].map((side) => (side !== inn.battingSide ? '' : inn.totalOnly ? String(inn.runs) : `${inningsScore(inn)} (${oversText(inn.legalBalls, config.ballsPerOver)})`)),
        winnerSideIndex: null,
        complete: inn.finished,
        children: [],
      })),
    });
  }
  return out;
}

/** "48/3 v 45/5" per period, side 0 first; super overs follow as "SO 12/1 v 8/2". */
function headline(segs: SegmentSummary[]): string {
  return segs
    .filter((s) => s.children.some((c) => c.complete || c.scores.some((n) => n > 0)) || s.sequence === 1)
    .map((s) => `${s.type === 'super_over' ? 'SO ' : ''}${s.display.join(' v ')}`)
    .join(', ');
}

function margin(state: OversState, config: OversConfig): string | null {
  if (state.winner === null) return null;
  const index = state.innings.length - 1;
  if (periodOf(index) > 0) return 'Won the super over';
  const [first, second] = state.innings as [Innings, Innings];
  if (first.battingSide === state.winner || second.totalOnly) {
    const runs = Math.abs(first.runs - second.runs);
    return `Won by ${runs} run${runs === 1 ? '' : 's'}`;
  }
  const left = limits(config, index).wickets - second.wickets;
  return `Won by ${left} wicket${left === 1 ? '' : 's'}`;
}

function callout(state: OversState, config: OversConfig): string | null {
  if (state.winner !== null) return margin(state, config);
  const index = state.innings.length - 1;
  if (index % 2 === 0) return periodOf(index) > 0 ? 'Super over' : null;
  const need = state.innings[index - 1]!.runs + 1 - state.innings[index]!.runs;
  const balls = limits(config, index).overs * config.ballsPerOver - state.innings[index]!.legalBalls;
  return `Need ${need} off ${balls} ball${balls === 1 ? '' : 's'}`;
}

function actions(state: OversState): ScoringAction[] {
  if (state.winner !== null) return [];
  const balls: ScoringAction[] = Array.from({ length: MAX_RUNS_PER_BALL + 1 }, (_, runs) => ({
    id: `ball-${runs}`,
    label: String(runs),
    sideIndex: null,
    event: {
      type: 'ball',
      runs,
      extra: 'none',
      wicket: false,
    } as ScoringAction['event'],
  }));
  const end: ScoringAction = {
    id: 'innings-end',
    label: 'End innings',
    sideIndex: null,
    event: { type: 'innings_end' },
  };
  const fresh = state.innings.length === 1 && state.innings[0]!.balls.length === 0;
  return fresh
    ? [
        ...balls,
        end,
        {
          id: 'swap-batting',
          label: 'Other side bats first',
          sideIndex: null,
          event: { type: 'swap_batting' },
        },
      ]
    : [...balls, end];
}

export const oversPlugin: ScoringPlugin<OversConfig, OversState, OversEvent> = {
  scoringModel: 'overs',
  configSchema: oversConfigSchema as unknown as z.ZodType<OversConfig>,
  eventSchema: oversEventSchema as unknown as z.ZodType<OversEvent>,

  validateSides(config, sides: SideInfo[]) {
    if (sides.length !== 2) return 'This sport is played between exactly two sides.';
    const max = config.playersPerSide ?? 11;
    return sides.some((s) => s.playerCount < 1 || s.playerCount > max) ? `Each side needs 1 to ${max} players.` : null;
  },

  describeRules: (config) => describeOvers(config),

  initialState: (config) => ({
    innings: [newInnings(config.battingFirstSideIndex)],
    winner: null,
  }),

  applyEvent: (state, event, config) => applyOvers(state, event, config),

  isComplete: (state) => state.winner !== null,

  summary(state, config): ScoreSummary {
    const live = state.winner === null;
    const current = state.innings.at(-1)!;
    const period = state.innings.slice(periodOf(state.innings.length - 1) * 2);
    const segs = segments(state, config);
    return {
      scoringModel: 'overs',
      complete: !live,
      winnerSideIndex: state.winner,
      sides: [0, 1].map((i) => {
        const inn = period.find((p) => p.battingSide === i);
        return {
          index: i,
          primary: inn ? inningsScore(inn) : '-',
          current: null,
          // The side at the crease: "serving" is the generic "this side has the initiative".
          serving: live && current.battingSide === i,
          serverNumber: null,
          serverPlayerIndex: null,
          serveNote: null,
        };
      }),
      segments: segs,
      headline: headline(segs),
      callout: callout(state, config),
      totals: {
        major: [state.winner === 0 ? 1 : 0, state.winner === 1 ? 1 : 0],
        // Runs in the match proper; super overs only break the tie, as in the laws of the game.
        minor: [0, 1].map((i) => state.innings.slice(0, 2).find((inn) => inn.battingSide === i)?.runs ?? 0),
        majorLabel: 'Wins',
        minorLabel: 'Runs',
      },
      actions: actions(state),
      ticker: thisOver(current, config.ballsPerOver),
    };
  },

  /** One row per period ([[48, 45]], or [[48, 48], [12, 8]] after a super over). */
  eventsForManualResult(config, _sides, scores) {
    if (scores.length === 0) throw new ScoringError('INVALID_RESULT', 'Enter both sides’ runs.');
    let first: 0 | 1 = config.battingFirstSideIndex;
    return scores.flatMap((row) => {
      const second = other(first);
      const events: OversEvent[] = [
        { type: 'innings_total', runs: row[first]! },
        { type: 'innings_total', runs: row[second]! },
      ];
      first = second;
      return events;
    });
  },
};
