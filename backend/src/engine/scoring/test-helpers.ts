import { rulesetConfig, sportSeed } from '../../catalog/sports.js';
import { createScorer, replay, scoringRegistry, type PluginEvent, type Scorer } from './index.js';

/** A scorer for a catalog sport's ruleset (default ruleset when omitted). */
export function scorerFor(sport: string, ruleset?: string, playersPerSide = 1, overrides: Record<string, unknown> = {}): Scorer {
  const seed = sportSeed(sport);
  const model = ruleset ? seed.rulesets.find((r) => r.slug === ruleset)!.scoringModel : seed.scoringModel;
  return createScorer(scoringRegistry, model, { ...rulesetConfig(sport, ruleset), ...overrides }, [
    { index: 0, playerCount: playersPerSide },
    { index: 1, playerCount: playersPerSide },
  ]);
}

export const rally = (...sides: Array<0 | 1>): PluginEvent[] => sides.map((sideIndex) => ({ type: 'rally_won', sideIndex }) as PluginEvent);
export const times = (side: 0 | 1, n: number): Array<0 | 1> => Array.from({ length: n }, () => side);
/** n rallies alternating a, b, a, b ... */
export const alternate = (n: number, first: 0 | 1 = 0): Array<0 | 1> => Array.from({ length: n }, (_, i) => ((i + first) % 2) as 0 | 1);

export function play(scorer: Scorer, ...sides: Array<0 | 1>) {
  return replay(scorer, rally(...sides));
}
