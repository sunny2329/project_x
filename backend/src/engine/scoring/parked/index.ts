/*
 * NOT IN THE MVP. The football (timed goals) engine from the six-sport version, parked here
 * unchanged. They use the old engine contract (legacy-types.ts), are not
 * registered in the scoring registry, and the sport is seeded inactive with no rulesets.
 * To bring it back: port it to the ScoringPlugin interface (../types.ts), register it in
 * ../index.ts, add a ruleset to src/catalog/sports.ts and set the sport active.
 */
import { timedGoalsEngine } from './timed-goals.js';
import type { ScoreEvent, ScoreView, TimedGoalsConfig } from './legacy-types.js';

export * from './legacy-types.js';

export function replay(config: TimedGoalsConfig, events: ScoreEvent[], next?: ScoreEvent): ScoreView {
  const all = next ? [...events, next] : events;
  return timedGoalsEngine.view(config, all.reduce((s, e) => timedGoalsEngine.apply(config, s, e), timedGoalsEngine.initial(config)));
}
