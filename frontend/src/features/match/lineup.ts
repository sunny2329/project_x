import type { FormatOption, ParticipantInput, PlayerOption } from './types';

/** A player picked for a side while setting up a match: a registered player or a new guest. */
export interface LineupPlayer {
  /** Stable key in the editor: player id, user id, or a temporary key for a new guest. */
  key: string;
  displayName: string;
  isGuest: boolean;
  /** Registered players only. */
  userId: string | null;
  input: ParticipantInput;
}

export type Lineup = LineupPlayer[][];

export function fromOption(option: PlayerOption): LineupPlayer {
  const input: ParticipantInput = option.playerId ? { playerId: option.playerId } : { userId: option.userId! };
  return { key: option.userId ?? option.playerId!, displayName: option.displayName, isGuest: option.isGuest, userId: option.userId, input };
}

let guestSeq = 0;
export function newGuest(displayName: string, phone?: string | null): LineupPlayer {
  guestSeq += 1;
  return { key: `guest-${guestSeq}-${displayName}`, displayName, isGuest: true, userId: null, input: { guest: { displayName, ...(phone ? { phone } : {}) } } };
}

export function lineupKeys(lineup: Lineup): string[] {
  return lineup.flat().map((p) => p.key);
}

/** Adds a player to a side unless already in the match or the side is full. */
export function addPlayer(lineup: Lineup, side: number, player: LineupPlayer, maxPerSide: number): Lineup {
  if (lineupKeys(lineup).includes(player.key) || lineup[side]!.length >= maxPerSide) return lineup;
  return lineup.map((players, i) => (i === side ? [...players, player] : players));
}

export function removePlayer(lineup: Lineup, key: string): Lineup {
  return lineup.map((players) => players.filter((p) => p.key !== key));
}

/** Drops players beyond the new format's limit (e.g. switching from doubles to singles). */
export function fitToFormat(lineup: Lineup, format: Pick<FormatOption, 'maxPerSide'>): Lineup {
  return lineup.map((players) => players.slice(0, format.maxPerSide));
}

/** Why the match can't start yet, or null when the lineup is complete. */
export function lineupProblem(lineup: Lineup, format: Pick<FormatOption, 'minPerSide'>): string | null {
  for (const [index, players] of lineup.entries()) {
    if (players.length < format.minPerSide) {
      const needed = format.minPerSide - players.length;
      return `Add ${needed} more player${needed === 1 ? '' : 's'} to ${index === 0 ? 'your side' : 'the other side'}`;
    }
  }
  return null;
}
