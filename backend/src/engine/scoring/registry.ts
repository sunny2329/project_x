import { ScoringError, type ScoringPlugin } from './types.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyScoringPlugin = ScoringPlugin<any, any, any>;

/** Maps `scoringModel` to its plugin. The only place that knows which plugins exist. */
export class ScoringRegistry {
  private readonly plugins = new Map<string, AnyScoringPlugin>();

  constructor(plugins: AnyScoringPlugin[] = []) {
    for (const plugin of plugins) this.register(plugin);
  }

  register(plugin: AnyScoringPlugin): this {
    if (this.plugins.has(plugin.scoringModel)) throw new Error(`Scoring model "${plugin.scoringModel}" is already registered`);
    this.plugins.set(plugin.scoringModel, plugin);
    return this;
  }

  has(scoringModel: string): boolean {
    return this.plugins.has(scoringModel);
  }

  get(scoringModel: string): AnyScoringPlugin {
    const plugin = this.plugins.get(scoringModel);
    if (!plugin) throw new ScoringError('UNKNOWN_SCORING_MODEL', `No scoring plugin for "${scoringModel}".`);
    return plugin;
  }

  models(): string[] {
    return [...this.plugins.keys()];
  }
}
