import {
  other,
  ScoringError,
  type InningsView,
  type OversConfig,
  type Pair,
  type PeriodScore,
  type ScoringEngine,
  type Side,
} from './types.js';

interface Ball {
  label: string;
  legal: boolean;
}

interface Innings {
  battingSide: Side;
  runs: number;
  wickets: number;
  legalBalls: number;
  extras: number;
  balls: Ball[];
  finished: boolean;
}

export interface OversState {
  innings: Innings[];
}

const MAX_RUNS_PER_BALL = 6;

function newInnings(battingSide: Side): Innings {
  return { battingSide, runs: 0, wickets: 0, legalBalls: 0, extras: 0, balls: [], finished: false };
}

function oversText(legalBalls: number, ballsPerOver: number): string {
  return `${Math.floor(legalBalls / ballsPerOver)}.${legalBalls % ballsPerOver}`;
}

function ballLabel(runs: number, extra: 'none' | 'wide' | 'no_ball', wicket: boolean): string {
  if (extra === 'wide') return `Wd${runs ? `+${runs}` : ''}${wicket ? ' W' : ''}`;
  if (extra === 'no_ball') return `Nb${runs ? `+${runs}` : ''}${wicket ? ' W' : ''}`;
  if (wicket) return runs ? `${runs} W` : 'W';
  return runs ? String(runs) : '•';
}

function isFinished(state: OversState): boolean {
  return state.innings.length === 2 && state.innings[1]!.finished;
}

/** Balls of the over in progress; right after an over ends, that completed over (until the next ball). */
function currentOver(innings: Innings, ballsPerOver: number): string[] {
  const { legalBalls } = innings;
  const overStart = legalBalls > 0 && legalBalls % ballsPerOver === 0 ? legalBalls - ballsPerOver : legalBalls - (legalBalls % ballsPerOver);
  let legalSeen = 0;
  let startIndex = 0;
  if (overStart > 0) {
    for (let i = 0; i < innings.balls.length; i += 1) {
      if (innings.balls[i]!.legal) legalSeen += 1;
      if (legalSeen === overStart) {
        startIndex = i + 1;
        break;
      }
    }
  }
  return innings.balls.slice(startIndex).map((ball) => ball.label);
}

/** Box cricket: two limited-overs innings; the side with more runs wins, equal runs is a tie. */
export const oversEngine: ScoringEngine<OversConfig, OversState> = {
  initial: (config) => ({ innings: [newInnings(config.battingFirst)] }),

  apply(config, state, event) {
    if (isFinished(state)) throw new ScoringError('MATCH_OVER', 'Both innings are complete.');
    const innings = state.innings.map((inn) => ({ ...inn, balls: [...inn.balls] }));
    const current = innings.at(-1)!;

    if (event.type === 'ball') {
      if (!Number.isInteger(event.runs) || event.runs < 0 || event.runs > MAX_RUNS_PER_BALL) {
        throw new ScoringError('INVALID_EVENT', `Runs off a ball must be 0 to ${MAX_RUNS_PER_BALL}.`);
      }
      const extraRuns = event.extra === 'wide' ? config.wideRuns : event.extra === 'no_ball' ? config.noBallRuns : 0;
      const legal = event.extra === 'none';
      current.runs += event.runs + extraRuns;
      current.extras += extraRuns + (event.extra === 'wide' ? event.runs : 0);
      if (event.wicket) current.wickets += 1;
      if (legal) current.legalBalls += 1;
      current.balls.push({ label: ballLabel(event.runs, event.extra, event.wicket), legal });

      const chaseWon = innings.length === 2 && current.runs > innings[0]!.runs;
      if (current.wickets >= config.wickets || current.legalBalls >= config.overs * config.ballsPerOver || chaseWon) {
        current.finished = true;
      }
    } else if (event.type === 'innings_end') {
      current.finished = true;
    } else {
      throw new ScoringError('INVALID_EVENT', 'Only balls and the end of an innings can be recorded in this sport.');
    }

    if (current.finished && innings.length === 1) innings.push(newInnings(other(current.battingSide)));
    return { innings };
  },

  view(config, state) {
    const finished = isFinished(state);
    const runsBySide: Pair = [0, 0];
    for (const inn of state.innings) runsBySide[inn.battingSide - 1] = inn.runs;
    const winner: Side | null = !finished || runsBySide[0] === runsBySide[1] ? null : runsBySide[0] > runsBySide[1] ? 1 : 2;
    const current = state.innings.at(-1)!;

    const inningsViews: InningsView[] = state.innings.map((inn) => ({
      battingSide: inn.battingSide,
      runs: inn.runs,
      wickets: inn.wickets,
      legalBalls: inn.legalBalls,
      overs: oversText(inn.legalBalls, config.ballsPerOver),
      extras: inn.extras,
      finished: inn.finished,
    }));
    const periods: PeriodScore[] = state.innings.map((inn, index) => {
      const score: Pair = [0, 0];
      score[inn.battingSide - 1] = inn.runs;
      return { no: index + 1, label: `Innings ${index + 1}`, score, winner: null, finished: inn.finished };
    });
    // Always list side 1 first, whichever side batted first.
    const summary = [...inningsViews]
      .sort((a, b) => a.battingSide - b.battingSide)
      .map((inn) => `${inn.runs}/${inn.wickets} (${inn.overs})`)
      .join(' – ');

    return {
      kind: 'overs',
      finished,
      winner,
      currentPeriod: periods.at(-1)!,
      periods,
      headline: runsBySide,
      totals: runsBySide,
      summary,
      cricket: {
        battingSide: current.battingSide,
        innings: inningsViews,
        target: state.innings.length === 2 ? state.innings[0]!.runs + 1 : null,
        thisOver: currentOver(current, config.ballsPerOver),
      },
      allowedEvents: finished ? [] : ['ball', 'innings_end'],
    };
  },
};
