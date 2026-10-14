import { z } from 'zod';
import { bracketOrder, circleRounds, groupName, nextPowerOfTwo, roundName, seedOrder, snakeGroups } from './draw.js';
import { TournamentError, type DrawPlan, type EntryInput, type PlannedFixture, type PlannedGroup, type PlannedStage, type SlotSource, type TournamentFormat } from './types.js';

// ---------------------------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------------------------

/**
 * A single-elimination bracket. `seeded[i]` is the source for seed i + 1. Missing lines up to
 * the next power of two are byes, which the standard order gives to the top seeds.
 */
export function knockoutStage(stageKey: string, sequence: number, name: string, seeded: SlotSource[], thirdPlace: boolean): PlannedStage {
  const size = nextPowerOfTwo(Math.max(seeded.length, 2));
  const order = bracketOrder(size);
  const rounds = Math.log2(size);
  const groupKey = `${stageKey}-main`;
  const key = (r: number, p: number) => `${stageKey}-r${r}-p${p}`;
  const source = (seed: number): SlotSource => (seed <= seeded.length ? seeded[seed - 1]! : { kind: 'bye' });

  const fixtures: PlannedFixture[] = [];
  for (let r = 1; r <= rounds; r += 1) {
    const count = size / 2 ** r;
    for (let p = 1; p <= count; p += 1) {
      const slots: [SlotSource, SlotSource] =
        r === 1
          ? [source(order[2 * (p - 1)]!), source(order[2 * (p - 1) + 1]!)]
          : [
              { kind: 'winner', fixtureKey: key(r - 1, 2 * p - 1) },
              { kind: 'winner', fixtureKey: key(r - 1, 2 * p) },
            ];
      fixtures.push({
        key: key(r, p),
        stageKey,
        groupKey,
        round: r,
        position: p,
        roundName: roundName(r, rounds),
        slots,
        next: r < rounds ? { fixtureKey: key(r + 1, Math.ceil(p / 2)), slot: p % 2 === 1 ? 1 : 2 } : null,
        loserNext: null,
      });
    }
  }

  if (thirdPlace && rounds >= 2) {
    const thirdKey = `${stageKey}-third`;
    const semis = fixtures.filter((f) => f.round === rounds - 1);
    semis.forEach((semi, i) => (semi.loserNext = { fixtureKey: thirdKey, slot: i === 0 ? 1 : 2 }));
    fixtures.push({
      key: thirdKey,
      stageKey,
      groupKey,
      round: rounds,
      position: 2,
      roundName: 'Third place',
      slots: [
        { kind: 'loser', fixtureKey: semis[0]!.key },
        { kind: 'loser', fixtureKey: semis[1]!.key },
      ],
      next: null,
      loserNext: null,
    });
  }

  const entryIds = seeded.flatMap((s) => (s.kind === 'entry' ? [s.entryId] : []));
  const group: PlannedGroup = { key: groupKey, type: 'bracket', name: 'Main draw', sequence: 1, entryIds };
  return { key: stageKey, sequence, type: 'knockout', name, groups: [group], fixtures };
}

/** Round-robin groups: everyone in a group plays everyone (twice with legs = 2). */
export function roundRobinStage(stageKey: string, sequence: number, name: string, groups: string[][], legs: number): PlannedStage {
  const planned: PlannedGroup[] = groups.map((entryIds, i) => ({
    key: `${stageKey}-g${i + 1}`,
    type: 'group',
    name: groups.length === 1 ? 'Round robin' : groupName(i),
    sequence: i + 1,
    entryIds,
  }));
  const fixtures: PlannedFixture[] = [];
  for (const group of planned) {
    const rounds = circleRounds(group.entryIds);
    for (let leg = 0; leg < legs; leg += 1) {
      rounds.forEach((pairs, r) => {
        const round = leg * rounds.length + r + 1;
        pairs.forEach(([a, b], p) => {
          const [one, two] = leg % 2 === 0 ? [a, b] : [b, a];
          fixtures.push({
            key: `${group.key}-r${round}-p${p + 1}`,
            stageKey,
            groupKey: group.key,
            round,
            position: p + 1,
            roundName: `Round ${round}`,
            slots: [
              { kind: 'entry', entryId: one },
              { kind: 'entry', entryId: two },
            ],
            next: null,
            loserNext: null,
          });
        });
      });
    }
  }
  return { key: stageKey, sequence, type: 'round_robin', name, groups: planned, fixtures };
}

function requireEntries(entries: EntryInput[], min: number): void {
  if (entries.length < min) throw new TournamentError('NOT_ENOUGH_ENTRIES', `This format needs at least ${min} entries.`);
  if (new Set(entries.map((e) => e.id)).size !== entries.length) throw new TournamentError('INVALID_CONFIG', 'An entry is listed twice.');
}

// ---------------------------------------------------------------------------------------------
// Formats
// ---------------------------------------------------------------------------------------------

export const knockoutConfigSchema = z.object({ thirdPlaceMatch: z.boolean().default(false) });
export type KnockoutConfig = z.infer<typeof knockoutConfigSchema>;

export const knockoutFormat: TournamentFormat<KnockoutConfig> = {
  key: 'knockout',
  configSchema: knockoutConfigSchema as z.ZodType<KnockoutConfig>,
  minEntries: () => 2,
  generate(entries, config, { random }): DrawPlan {
    requireEntries(entries, 2);
    const seeded = seedOrder(entries, random).map((e): SlotSource => ({ kind: 'entry', entryId: e.id }));
    return { format: 'knockout', stages: [knockoutStage('s1', 1, 'Knockout', seeded, config.thirdPlaceMatch)] };
  },
};

export const roundRobinConfigSchema = z.object({ legs: z.union([z.literal(1), z.literal(2)]).default(1) });
export type RoundRobinConfig = z.infer<typeof roundRobinConfigSchema>;

export const roundRobinFormat: TournamentFormat<RoundRobinConfig> = {
  key: 'round_robin',
  configSchema: roundRobinConfigSchema as z.ZodType<RoundRobinConfig>,
  minEntries: () => 3,
  generate(entries, config, { random }): DrawPlan {
    requireEntries(entries, 3);
    const ordered = seedOrder(entries, random).map((e) => e.id);
    return { format: 'round_robin', stages: [roundRobinStage('s1', 1, 'Round robin', [ordered], config.legs)] };
  },
};

export const groupsKnockoutConfigSchema = z.object({
  groupCount: z.number().int().min(1).max(32),
  qualifiersPerGroup: z.number().int().min(1).max(8).default(2),
  thirdPlaceMatch: z.boolean().default(false),
  legs: z.union([z.literal(1), z.literal(2)]).default(1),
});
export type GroupsKnockoutConfig = z.infer<typeof groupsKnockoutConfigSchema>;

export const groupsKnockoutFormat: TournamentFormat<GroupsKnockoutConfig> = {
  key: 'groups_knockout',
  configSchema: groupsKnockoutConfigSchema as z.ZodType<GroupsKnockoutConfig>,
  minEntries: (config) => config.groupCount * Math.max(2, config.qualifiersPerGroup + 1),
  generate(entries, config, { random }): DrawPlan {
    requireEntries(entries, groupsKnockoutFormat.minEntries(config));
    const ordered = seedOrder(entries, random).map((e) => e.id);
    const groups = snakeGroups(ordered, config.groupCount);
    const groupStage = roundRobinStage('s1', 1, 'Group stage', groups, config.legs);
    if (groupStage.groups.length > 1) groupStage.groups.forEach((g, i) => (g.name = groupName(i)));
    // Qualifiers seeded rank by rank (all winners, then all runners-up ...), so that with the
    // standard bracket order A1 meets B2 and B1 meets A2.
    const qualifiers: SlotSource[] = [];
    for (let rank = 1; rank <= config.qualifiersPerGroup; rank += 1) {
      for (const group of groupStage.groups) qualifiers.push({ kind: 'group_rank', groupKey: group.key, rank });
    }
    const knockout = knockoutStage('s2', 2, 'Knockout', qualifiers, config.thirdPlaceMatch);
    return { format: 'groups_knockout', stages: [groupStage, knockout] };
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FORMATS = new Map<string, TournamentFormat<any>>([knockoutFormat, roundRobinFormat, groupsKnockoutFormat].map((f) => [f.key, f]));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getFormat(key: string): TournamentFormat<any> {
  const format = FORMATS.get(key);
  if (!format) throw new TournamentError('UNKNOWN_FORMAT', `Unknown tournament format "${key}".`);
  return format;
}

export function formatKeys(): string[] {
  return [...FORMATS.keys()];
}

export function parseFormatConfig(key: string, config: unknown): unknown {
  const parsed = getFormat(key).configSchema.safeParse(config ?? {});
  if (!parsed.success) throw new TournamentError('INVALID_CONFIG', parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  return parsed.data;
}
