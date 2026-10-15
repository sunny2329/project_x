/*
 * NOT IN THE MVP. The football (timed goals) and box cricket (overs) engines from the six-sport
 * version, parked here unchanged. They use the old engine contract (legacy-types.ts), are not
 * registered in the scoring registry, and the sports are seeded inactive with no rulesets.
 * To bring one back: port it to the ScoringPlugin interface (../types.ts), register it in
 * ../index.ts, add a ruleset to src/catalog/sports.ts and set the sport active.
 */
import { oversEngine } from './overs.js';
import { timedGoalsEngine } from './timed-goals.js';
import type { OversConfig, ScoreEvent, ScoreView, TimedGoalsConfig } from './legacy-types.js';

export * from './legacy-types.js';

export function replay(config: TimedGoalsConfig | OversConfig, events: ScoreEvent[], next?: ScoreEvent): ScoreView {
  const all = next ? [...events, next] : events;
  if (config.kind === 'timed_goals') {
    return timedGoalsEngine.view(config, all.reduce((s, e) => timedGoalsEngine.apply(config, s, e), timedGoalsEngine.initial(config)));
  }
  return oversEngine.view(config, all.reduce((s, e) => oversEngine.apply(config, s, e), oversEngine.initial(config)));
}
