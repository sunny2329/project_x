/*
 * Pure tournament engine: draws, fixtures, advancement and standings. No DB or HTTP; the
 * tournament service maps these plans and states to tournament_stages / stage_groups / fixtures.
 */
import type { z } from 'zod';

export interface EntryInput {
  id: string;
  /** 1 = top seed; null = unseeded (placed after the seeds, in random order). */
  seed: number | null;
}

/** Where a fixture slot's entry comes from. */
export type SlotSource =
  | { kind: 'entry'; entryId: string }
  | { kind: 'bye' }
  | { kind: 'winner'; fixtureKey: string }
  | { kind: 'loser'; fixtureKey: string }
  | { kind: 'group_rank'; groupKey: string; rank: number };

export interface Link {
  fixtureKey: string;
  slot: 1 | 2;
}

export interface PlannedFixture {
  /** Unique within the plan, e.g. "s2-r1-p3". The service maps keys to fixture ids. */
  key: string;
  stageKey: string;
  groupKey: string | null;
  round: number;
  position: number;
  roundName: string | null;
  slots: [SlotSource, SlotSource];
  next: Link | null;
  loserNext: Link | null;
}

export interface PlannedGroup {
  key: string;
  type: 'group' | 'bracket';
  name: string;
  sequence: number;
  /** Entry ids in draw position order (empty for brackets fed by an earlier stage). */
  entryIds: string[];
}

export interface PlannedStage {
  key: string;
  sequence: number;
  /** Open set: "knockout", "round_robin"; later "double_elimination", "swiss". */
  type: string;
  name: string;
  groups: PlannedGroup[];
  fixtures: PlannedFixture[];
}

export interface DrawPlan {
  format: string;
  stages: PlannedStage[];
}

export interface DrawOptions {
  /** Random source in [0, 1). Pass a seeded one (see seededRandom) for reproducible draws. */
  random: () => number;
}

export interface TournamentFormat<Config = unknown> {
  readonly key: string;
  readonly configSchema: z.ZodType<Config>;
  /** Smallest field the format can run with. */
  minEntries(config: Config): number;
  generate(entries: EntryInput[], config: Config, options: DrawOptions): DrawPlan;
}

export class TournamentError extends Error {
  constructor(
    readonly code: 'UNKNOWN_FORMAT' | 'INVALID_CONFIG' | 'NOT_ENOUGH_ENTRIES' | 'INVALID_RESULT' | 'NOT_READY',
    message: string,
  ) {
    super(message);
    this.name = 'TournamentError';
  }
}
