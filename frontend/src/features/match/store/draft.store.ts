import { create } from 'zustand';
import type { PlayerRef, SportSummary } from '../types';
import { addPlayer, fitToFormat, removePlayer, type Lineup, type LineupPlayer } from '../lineup';

/**
 * The friendly match being set up: sport -> format, rules, players -> who serves first. Kept in a
 * store (not route params) because it spans NewMatchSport, NewMatchSetup, AddPlayer, ServeFirst
 * and EnterResult.
 */
interface DraftState {
  sport: SportSummary | null;
  formatCode: string | null;
  rulesetId: string | null;
  lineup: Lineup;
  /** Side index that serves first. */
  firstServer: 0 | 1;
  /** "Rematch": the sport, rules and players of a finished match. */
  start(sport: SportSummary, me: PlayerRef | null, opponent?: LineupPlayer | null): void;
  setFormat(code: string): void;
  setRuleset(id: string): void;
  add(side: number, player: LineupPlayer): void;
  remove(key: string): void;
  /** Puts `key` first on its side (the engine starts each side's serve with its first player). */
  serveFirst(side: 0 | 1, key: string): void;
  restore(state: Pick<DraftState, 'sport' | 'formatCode' | 'rulesetId' | 'lineup' | 'firstServer'>): void;
  reset(): void;
}

export function meAsLineupPlayer(me: PlayerRef): LineupPlayer {
  return { key: me.userId ?? me.playerId, displayName: me.displayName, isGuest: false, userId: me.userId, input: { playerId: me.playerId } };
}

export const useMatchDraft = create<DraftState>()((set, get) => ({
  sport: null,
  formatCode: null,
  rulesetId: null,
  lineup: [[], []],
  firstServer: 0,

  start(sport, me, opponent) {
    const format = sport.formats.find((f) => f.code === 'singles') ?? sport.formats[0] ?? null;
    const ruleset = sport.rulesets.find((r) => r.isDefault) ?? sport.rulesets[0] ?? null;
    const lineup: Lineup = [me ? [meAsLineupPlayer(me)] : [], opponent ? [opponent] : []];
    set({ sport, formatCode: format?.code ?? null, rulesetId: ruleset?.id ?? null, lineup, firstServer: 0 });
  },

  setFormat(code) {
    const format = get().sport?.formats.find((f) => f.code === code);
    if (!format) return;
    set({ formatCode: code, lineup: fitToFormat(get().lineup, format) });
  },

  setRuleset(id) {
    set({ rulesetId: id });
  },

  add(side, player) {
    const format = get().sport?.formats.find((f) => f.code === get().formatCode);
    set({ lineup: addPlayer(get().lineup, side, player, format?.maxPerSide ?? 2) });
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
    set(state);
  },

  reset() {
    set({ sport: null, formatCode: null, rulesetId: null, lineup: [[], []], firstServer: 0 });
  },
}));
