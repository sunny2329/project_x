import { oversEngine } from './overs.js';
import { rallyEngine } from './rally.js';
import { timedGoalsEngine } from './timed-goals.js';
import type { ScoreEvent, ScoreView, ScoringConfig } from './types.js';

export * from './types.js';

/**
 * Replays the (not undone) events from the start and returns the resulting scoreboard. Matches
 * have at most a few hundred events, so replaying on every change keeps undo trivially correct.
 * With `next`, also applies one more event (throws ScoringError if it is not allowed).
 */
export function replay(config: ScoringConfig, events: ScoreEvent[], next?: ScoreEvent): ScoreView {
  const all = next ? [...events, next] : events;
  switch (config.kind) {
    case 'rally':
      return rallyEngine.view(config, all.reduce((state, event) => rallyEngine.apply(config, state, event), rallyEngine.initial(config)));
    case 'timed_goals':
      return timedGoalsEngine.view(
        config,
        all.reduce((state, event) => timedGoalsEngine.apply(config, state, event), timedGoalsEngine.initial(config)),
      );
    case 'overs':
      return oversEngine.view(config, all.reduce((state, event) => oversEngine.apply(config, state, event), oversEngine.initial(config)));
  }
}
