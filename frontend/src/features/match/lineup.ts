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
  /** Rating in the match's sport, when known (search results). */
  rating?: number | null;
  /** Guests: the phone given, shown masked. */
  phone?: string | null;
}

export type Lineup = LineupPlayer[][];

export function fromOption(option: PlayerOption): LineupPlayer {
  const input: ParticipantInput = option.playerId ? { playerId: option.playerId } : { userId: option.userId! };
  return { key: option.userId ?? option.playerId!, displayName: option.displayName, isGuest: option.isGuest, userId: option.userId, input, rating: option.rating };
}

let guestSeq = 0;
export function newGuest(displayName: string, phone?: string | null): LineupPlayer {
  guestSeq += 1;
  return { key: `guest-${guestSeq}-${displayName}`, displayName, isGuest: true, userId: null, phone: phone ?? null, input: { guest: { displayName, ...(phone ? { phone } : {}) } } };
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
export function lineupProblem(lineup: Lineup, format: Pick<FormatOption, 'minPerSide'> & { maxPerSide?: number }): string | null {
  for (const [index, players] of lineup.entries()) {
    if (format.maxPerSide !== undefined && players.length > format.maxPerSide) {
      const extra = players.length - format.maxPerSide;
      return `Remove ${extra} player${extra === 1 ? '' : 's'} from ${index === 0 ? 'your side' : 'the other side'} (${format.maxPerSide} a side)`;
    }
    if (players.length < format.minPerSide) {
      const needed = format.minPerSide - players.length;
      return `Add ${needed} more player${needed === 1 ? '' : 's'} to ${index === 0 ? 'your side' : 'the other side'}`;
    }
  }
  return null;
}

/** A saved team's member as a lineup player (registered players are keyed by user id, like search results). */
export function fromTeamMember(m: { playerId: string; userId: string | null; displayName: string; isGuest: boolean }): LineupPlayer {
  return { key: m.userId ?? m.playerId, displayName: m.displayName, isGuest: m.isGuest, userId: m.userId, input: { playerId: m.playerId } };
}

/**
 * Puts a saved team's players on `side`, replacing who was there: everyone not already on the
 * other side, up to `maxPerSide` (the first listed are captains, then by when they joined).
 */
export function withTeam(lineup: Lineup, side: number, members: LineupPlayer[], maxPerSide: number): Lineup {
  const elsewhere = new Set(lineup.flatMap((players, i) => (i === side ? [] : players.map((p) => p.key))));
  const players = members.filter((p) => !elsewhere.has(p.key)).slice(0, maxPerSide);
  return lineup.map((current, i) => (i === side ? players : current));
}

/** "+91 98••• ••210": country code, first two and last three digits. */
export function maskPhone(phone: string): string {
  const compact = phone.replace(/[\s-]/g, '');
  if (!/^\+\d+$/.test(compact)) return phone.length > 5 ? `${phone.slice(0, 2)}•••${phone.slice(-3)}` : phone;
  const digits = compact.slice(1);
  // Only for display: most numbers are 10 digits after the country code (India, US); else assume 2.
  const ccLen = digits.length - 10 >= 1 && digits.length - 10 <= 3 ? digits.length - 10 : 2;
  const [cc, rest] = [digits.slice(0, ccLen), digits.slice(ccLen)];
  if (rest.length < 6) return `+${cc} ${rest}`;
  return `+${cc} ${rest.slice(0, 2)}••• ••${rest.slice(-3)}`;
}
