import type { Side } from './scoring/types.js';

/** How far one result can move a rating. 32 suits new players whose true level is still unknown. */
export const ELO_K = 32;

/**
 * Elo for two sides. A side's rating is its players' average; every player on a side gets the
 * same change. `winner` null is a draw. Returns the change for side 1 and side 2, rounded to 0.1.
 */
export function eloChange(side1Rating: number, side2Rating: number, winner: Side | null): [number, number] {
  const expected1 = 1 / (1 + 10 ** ((side2Rating - side1Rating) / 400));
  const score1 = winner === null ? 0.5 : winner === 1 ? 1 : 0;
  const change = Math.round(ELO_K * (score1 - expected1) * 10) / 10;
  return [change, -change];
}

export function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
