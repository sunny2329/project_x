import type { FormatSetup, PlayerSummary, Side } from './types';

/** The players picked for each side while setting up a match. */
export type Lineup = [PlayerSummary[], PlayerSummary[]];

export function lineupIds(lineup: Lineup): string[] {
  return [...lineup[0], ...lineup[1]].map((player) => player.id);
}

/** Adds a player to a side unless they are already in the match or the side is full. */
export function addPlayer(lineup: Lineup, side: Side, player: PlayerSummary, maxPerSide: number): Lineup {
  if (lineupIds(lineup).includes(player.id) || lineup[side - 1]!.length >= maxPerSide) return lineup;
  const next: Lineup = [[...lineup[0]], [...lineup[1]]];
  next[side - 1]!.push(player);
  return next;
}

export function removePlayer(lineup: Lineup, playerId: string): Lineup {
  return [lineup[0].filter((p) => p.id !== playerId), lineup[1].filter((p) => p.id !== playerId)];
}

/** Drops players beyond the new format's limit (e.g. switching from doubles to singles). */
export function fitToFormat(lineup: Lineup, format: FormatSetup): Lineup {
  return [lineup[0].slice(0, format.maxPlayers), lineup[1].slice(0, format.maxPlayers)];
}

/** Why the match can't start yet, or null when the lineup is complete. */
export function lineupProblem(lineup: Lineup, format: FormatSetup): string | null {
  for (const [index, players] of lineup.entries()) {
    if (players.length < format.minPlayers) {
      const needed = format.minPlayers - players.length;
      const who = index === 0 ? 'your side' : 'the other side';
      return `Add ${needed} more player${needed === 1 ? '' : 's'} to ${who}`;
    }
  }
  return null;
}
