import { rallyPlugin } from './plugins/rally.js';
import { sideOutPlugin } from './plugins/side-out.js';
import { tennisPlugin } from './plugins/tennis.js';
import { ScoringRegistry } from './registry.js';

export * from './types.js';
export * from './registry.js';
export * from './replay.js';
export { rallyPlugin, sideOutPlugin, tennisPlugin };

/** Every scoring model the app supports. Adding a sport with a new model = one more plugin here. */
export function createDefaultRegistry(): ScoringRegistry {
  return new ScoringRegistry([rallyPlugin, sideOutPlugin, tennisPlugin]);
}

export const scoringRegistry = createDefaultRegistry();
