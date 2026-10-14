import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { SPORTS } from '../../catalog/sports.js';
import { createDefaultRegistry, createScorer, parseConfig, replay, scoringRegistry, ScoringError, type ScoringPlugin } from './index.js';

/** A made-up sport: first side to `target` points wins. Proves a model plugs in with no core change. */
interface FirstToConfig {
  target: number;
}
interface FirstToState {
  score: number[];
  winner: number | null;
}
type FirstToEvent = { type: 'score'; sideIndex: number; points: number };

const firstTo: ScoringPlugin<FirstToConfig, FirstToState, FirstToEvent> = {
  scoringModel: 'first_to',
  configSchema: z.object({ target: z.number().int().min(1) }),
  eventSchema: z.object({ type: z.literal('score'), sideIndex: z.number().int().min(0), points: z.number().int().min(1) }),
  validateSides: (_c, sides) => (sides.length >= 2 ? null : 'Needs at least two sides'),
  initialState: (_c, sides) => ({ score: sides.map(() => 0), winner: null }),
  applyEvent(state, event, config) {
    const score = state.score.map((s, i) => (i === event.sideIndex ? s + event.points : s));
    return { score, winner: score[event.sideIndex]! >= config.target ? event.sideIndex : null };
  },
  isComplete: (state) => state.winner !== null,
  summary: (state) => ({
    scoringModel: 'first_to',
    complete: state.winner !== null,
    winnerSideIndex: state.winner,
    sides: state.score.map((s, index) => ({ index, primary: String(s), current: null, serving: false, serverNumber: null, serverPlayerIndex: null, serveNote: null })),
    segments: [],
    headline: state.score.join('-'),
    callout: null,
    totals: { major: state.score, minor: state.score, majorLabel: 'Points', minorLabel: 'Points' },
    actions: [],
  }),
};

describe('scoring registry', () => {
  it('accepts a new scoring model (three sides, a custom event) without touching core code', () => {
    const registry = createDefaultRegistry().register(firstTo);
    const sides = [0, 1, 2].map((index) => ({ index, playerCount: 11 }));
    const scorer = createScorer(registry, 'first_to', { target: 5 }, sides);
    const result = replay(scorer, [
      { type: 'score', sideIndex: 2, points: 3 },
      { type: 'score', sideIndex: 0, points: 4 },
      { type: 'score', sideIndex: 2, points: 2 },
    ]);
    expect(result.summary).toMatchObject({ complete: true, winnerSideIndex: 2, headline: '4-0-5' });
    expect(() => replay(scorer, [{ type: 'rally_won', sideIndex: 0 }])).toThrow(ScoringError);
  });

  it('rejects unknown models, duplicate registration, bad configs and bad events', () => {
    expect(() => scoringRegistry.get('overs')).toThrow('No scoring plugin');
    expect(() => createDefaultRegistry().register(firstTo).register(firstTo)).toThrow('already registered');
    expect(() => createScorer(scoringRegistry, 'rally', { pointsToWin: 21, bestOf: 2 }, [])).toThrow(ScoringError);
    const scorer = createScorer(scoringRegistry, 'rally', { pointsToWin: 21, bestOf: 3 }, [{ index: 0, playerCount: 1 }, { index: 1, playerCount: 1 }]);
    expect(() => replay(scorer, [{ type: 'rally_won', sideIndex: 2 }])).toThrow(ScoringError);
  });

  it('validates every catalog ruleset against its plugin', () => {
    for (const sport of SPORTS) {
      for (const ruleset of sport.rulesets) {
        expect(() => parseConfig(scoringRegistry.get(ruleset.scoringModel), ruleset.config), `${sport.slug}/${ruleset.slug}`).not.toThrow();
      }
      if (sport.isActive) expect(scoringRegistry.has(sport.scoringModel), sport.slug).toBe(true);
      if (sport.isActive) expect(sport.rulesets.filter((r) => r.isDefault)).toHaveLength(1);
    }
  });

  it('keeps the engine free of framework, database and app imports', () => {
    const root = path.dirname(fileURLToPath(import.meta.url));
    const engineDir = path.resolve(root, '..');
    const files = readdirSync(engineDir, { recursive: true, encoding: 'utf8' }).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && !f.includes('test-helpers'));
    for (const file of files) {
      const source = readFileSync(path.join(engineDir, file), 'utf8');
      const imports = [...source.matchAll(/from '([^']+)'/g)].map((m) => m[1]!);
      for (const spec of imports) {
        const allowed = spec === 'zod' || (spec.startsWith('.') && !path.resolve(path.dirname(path.join(engineDir, file)), spec).startsWith(path.resolve(engineDir, '..', 'modules')));
        expect(allowed && !/express|pg|prisma|redis|ioredis|database|modules/.test(spec), `${file} imports ${spec}`).toBe(true);
      }
    }
  });
});
