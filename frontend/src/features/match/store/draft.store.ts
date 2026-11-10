import { create } from 'zustand';
import type { PlayerRef, SportSummary } from '../types';
import { addPlayer, fitToFormat, removePlayer, type Lineup, type LineupPlayer } from '../lineup';
import { autoNumbers, DEFAULT_NAMES, PRESETS, TEAM_COLORS, type HoopsSetup, type Jerseys } from '../basketball';
import { changeRule, maxPlayersPerSide } from '../rules';

/** Basketball's extra setup: the rules card choices, team names and colours, shirt numbers. */
export interface HoopsDraft {
  setup: HoopsSetup;
  names: [string, string];
  colors: [string, string];
  /** Shirt number per lineup key. */
  jerseys: Jerseys;
  /** "Who scored too" (per-player stats) or "Team score only". */
  tagPlayers: boolean;
}

export const freshHoops = (): HoopsDraft => ({
  setup: PRESETS[3],
  names: [...DEFAULT_NAMES],
  colors: [TEAM_COLORS[0][0]!, TEAM_COLORS[1][0]!],
  jerseys: {},
  tagPlayers: true,
});

/**
 * The friendly match being set up: sport -> format, rules, players -> who serves first. Kept in a
 * store (not route params) because it spans NewMatchSport, NewMatchSetup, AddPlayer, ServeFirst
 * and EnterResult.
 */
interface DraftState {
  sport: SportSummary | null;
  formatCode: string | null;
  rulesetId: string | null;
  /** Rules changed on top of the ruleset ("Change a rule"): sent as rulesOverride. */
  override: Record<string, number>;
  lineup: Lineup;
  /** Side index that serves first. */
  firstServer: 0 | 1;
  hoops: HoopsDraft;
  setHoops(change: Partial<HoopsDraft>): void;
  setJersey(key: string, value: number | null): void;
  /** Gives every player without a shirt number the lowest free one, per side. */
  autoJerseys(): void;
  /** Swaps two players of a side (starters are the first listed). */
  swap(side: number, a: string, b: string): void;
  /** "Rematch": the sport, rules and players of a finished match. */
  start(sport: SportSummary, me: PlayerRef | null, opponent?: LineupPlayer | null): void;
  setFormat(code: string): void;
  setRuleset(id: string): void;
  setRule(key: string, value: number): void;
  resetRules(): void;
  add(side: number, player: LineupPlayer): void;
  remove(key: string): void;
  /** Puts `key` first on its side (the engine starts each side's serve with its first player). */
  serveFirst(side: 0 | 1, key: string): void;
  restore(state: Pick<DraftState, 'sport' | 'formatCode' | 'rulesetId' | 'lineup' | 'firstServer'> & { override?: Record<string, number>; hoops?: HoopsDraft }): void;
  reset(): void;
}

export function meAsLineupPlayer(me: PlayerRef): LineupPlayer {
  return { key: me.userId ?? me.playerId, displayName: me.displayName, isGuest: false, userId: me.userId, input: { playerId: me.playerId } };
}

export const useMatchDraft = create<DraftState>()((set, get) => ({
  sport: null,
  formatCode: null,
  rulesetId: null,
  override: {},
  lineup: [[], []],
  firstServer: 0,
  hoops: freshHoops(),

  setHoops(change) {
    set({ hoops: { ...get().hoops, ...change } });
  },

  setJersey(key, value) {
    const hoops = get().hoops;
    set({ hoops: { ...hoops, jerseys: { ...hoops.jerseys, [key]: value } } });
  },

  autoJerseys() {
    const hoops = get().hoops;
    let jerseys = hoops.jerseys;
    for (const players of get().lineup) jerseys = autoNumbers(players.map((p) => p.key), jerseys);
    set({ hoops: { ...hoops, jerseys } });
  },

  swap(side, a, b) {
    const lineup = get().lineup.map((players, i) => {
      if (i !== side) return players;
      const ia = players.findIndex((p) => p.key === a);
      const ib = players.findIndex((p) => p.key === b);
      if (ia < 0 || ib < 0) return players;
      const next = [...players];
      [next[ia], next[ib]] = [next[ib]!, next[ia]!];
      return next;
    });
    set({ lineup });
  },

  start(sport, me, opponent) {
    const format = sport.formats.find((f) => f.code === 'singles') ?? sport.formats[0] ?? null;
    const ruleset = sport.rulesets.find((r) => r.isDefault) ?? sport.rulesets[0] ?? null;
    const lineup: Lineup = [me ? [meAsLineupPlayer(me)] : [], opponent ? [opponent] : []];
    set({ sport, formatCode: format?.code ?? null, rulesetId: ruleset?.id ?? null, override: {}, lineup, firstServer: 0, hoops: freshHoops() });
  },

  setFormat(code) {
    const format = get().sport?.formats.find((f) => f.code === code);
    if (!format) return;
    set({ formatCode: code, lineup: fitToFormat(get().lineup, format) });
  },

  setRuleset(id) {
    set({ rulesetId: id, override: {} });
  },

  setRule(key, value) {
    const { sport, rulesetId, override } = get();
    const ruleset = sport?.rulesets.find((r) => r.id === rulesetId);
    if (!ruleset) return;
    set({ override: changeRule(ruleset.scoringModel, ruleset.config, override, key, value) });
  },

  resetRules() {
    set({ override: {} });
  },

  add(side, player) {
    const { sport, formatCode, rulesetId, override } = get();
    const format = sport?.formats.find((f) => f.code === formatCode);
    const config = { ...(sport?.rulesets.find((r) => r.id === rulesetId)?.config ?? {}), ...override };
    set({ lineup: addPlayer(get().lineup, side, player, maxPlayersPerSide(format?.maxPerSide ?? 2, config)) });
  },

  remove(key) {
    set({ lineup: removePlayer(get().lineup, key) });
  },

  serveFirst(side, key) {
    const lineup = get().lineup.map((players, i) => {
      if (i !== side) return players;
      const chosen = players.find((p) => p.key === key);
      return chosen ? [chosen, ...players.filter((p) => p.key !== key)] : players;
    });
    set({ lineup, firstServer: side });
  },

  restore(state) {
    set({ override: {}, hoops: freshHoops(), ...state });
  },

  reset() {
    set({ sport: null, formatCode: null, rulesetId: null, override: {}, lineup: [[], []], firstServer: 0, hoops: freshHoops() });
  },
}));
