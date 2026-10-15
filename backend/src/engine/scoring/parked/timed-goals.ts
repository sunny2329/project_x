import { ScoringError, type Pair, type PeriodScore, type ScoringEngine, type Side, type TimedGoalsConfig } from './types.js';

export interface TimedGoalsState {
  periods: Array<{ score: Pair; finished: boolean }>;
}

function periodLabel(config: TimedGoalsConfig, no: number): string {
  if (config.periods === 2) return no === 1 ? '1st half' : '2nd half';
  return config.periods === 1 ? 'Full time' : `Period ${no}`;
}

function isFinished(config: TimedGoalsConfig, state: TimedGoalsState): boolean {
  return state.periods.length === config.periods && state.periods.at(-1)!.finished;
}

/** Goals over timed periods (football). The scorer ends each period; a draw is a valid result. */
export const timedGoalsEngine: ScoringEngine<TimedGoalsConfig, TimedGoalsState> = {
  initial: () => ({ periods: [{ score: [0, 0], finished: false }] }),

  apply(config, state, event) {
    if (isFinished(config, state)) throw new ScoringError('MATCH_OVER', 'The match has ended.');
    const periods = state.periods.map((period) => ({ score: [...period.score] as Pair, finished: period.finished }));
    const current = periods.at(-1)!;

    if (event.type === 'goal') {
      current.score[event.side - 1]! += 1;
    } else if (event.type === 'period_end') {
      current.finished = true;
      if (periods.length < config.periods) periods.push({ score: [0, 0], finished: false });
    } else {
      throw new ScoringError('INVALID_EVENT', 'Only goals and the end of a period can be recorded in this sport.');
    }
    return { periods };
  },

  view(config, state) {
    const totals = state.periods.reduce<Pair>((sum, period) => [sum[0] + period.score[0], sum[1] + period.score[1]], [0, 0]);
    const finished = isFinished(config, state);
    const winner: Side | null = !finished || totals[0] === totals[1] ? null : totals[0] > totals[1] ? 1 : 2;
    const periods: PeriodScore[] = state.periods.map((period, index) => ({
      no: index + 1,
      label: periodLabel(config, index + 1),
      score: period.score,
      winner: null,
      finished: period.finished,
    }));
    return {
      kind: 'timed_goals',
      finished,
      winner,
      currentPeriod: periods.at(-1)!,
      periods,
      headline: totals,
      totals,
      summary: `${totals[0]}-${totals[1]}`,
      cricket: null,
      allowedEvents: finished ? [] : ['goal', 'period_end'],
    };
  },
};
