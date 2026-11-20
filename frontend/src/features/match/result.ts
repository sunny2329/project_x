/*
 * Design v2 result card wording (tested in result.test.ts).
 */
import { firstName } from '@/shared/utils/format';
import type { MatchView } from './types';

export interface ResultHeadline {
  /** "Won" / "Lost" / "Draw" / "Aarav & Kabir won" / "No result". */
  title: string;
  /** "2 – 1" from the viewer's side (or the winner's), null for walkovers. */
  score: string | null;
  /** The side the numbers are told from (mine, else the winner, else side A). */
  refSide: number;
}

const WALKOVER = new Set(['walkover', 'no_show', 'double_walkover']);

export function resultHeadline(m: Pick<MatchView, 'sides' | 'score' | 'status' | 'resultType'>, myUserId: string | undefined): ResultHeadline {
  const mine = m.sides.find((s) => s.players.some((p) => p.userId && p.userId === myUserId));
  const winner = m.score.winnerSideIndex;
  const refSide = mine?.index ?? winner ?? 0;
  const other = refSide === 0 ? 1 : 0;
  const major = m.score.totals.major;
  const score = WALKOVER.has(m.resultType ?? '') || !major.length ? null : `${major[refSide] ?? 0} – ${major[other] ?? 0}`;
  if (m.status === 'abandoned') return { title: 'No result', score, refSide };
  if (winner === null) return { title: 'Draw', score, refSide };
  const walkover = WALKOVER.has(m.resultType ?? '');
  if (mine) return { title: mine.index === winner ? (walkover ? 'Won (W/O)' : 'Won') : walkover ? 'Lost (W/O)' : 'Lost', score, refSide };
  const names = m.sides[winner]!.players.map((p) => firstName(p.displayName)).join(' & ') || m.sides[winner]!.name;
  return { title: `${names} won`, score, refSide };
}

/** "PICKLEBALL · DOUBLES · FRIENDLY". */
export function resultKicker(m: Pick<MatchView, 'sport' | 'format' | 'context'>): string {
  return [m.sport.name, m.format.name, m.context === 'tournament' ? 'Tournament' : 'Friendly'].join(' · ').toUpperCase();
}

export type RatingRow =
  | { kind: 'change'; playerId: string; name: string; before: number; after: number }
  | { kind: 'guest'; playerId: string; name: string }
  | { kind: 'unrated'; playerId: string; name: string };

/**
 * One row per player, winners first. A guest is "Unrated until claimed"; a registered player
 * without a change is unrated (a guest played, a walkover, or still awaiting confirmation).
 */
export function ratingRows(m: Pick<MatchView, 'sides' | 'score' | 'ratingChanges'>): RatingRow[] {
  const winner = m.score.winnerSideIndex ?? 0;
  const order = [...m.sides].sort((a, b) => (a.index === winner ? -1 : b.index === winner ? 1 : a.index - b.index));
  return order.flatMap((side) =>
    side.players.map((p): RatingRow => {
      if (p.isGuest) return { kind: 'guest', playerId: p.playerId, name: p.displayName };
      const c = m.ratingChanges.find((r) => r.playerId === p.playerId);
      return c ? { kind: 'change', playerId: p.playerId, name: p.displayName, before: Math.round(c.before), after: Math.round(c.after) } : { kind: 'unrated', playerId: p.playerId, name: p.displayName };
    }),
  );
}

/** Why nobody's rating moved, when that's the case. */
export function unratedReason(m: Pick<MatchView, 'sides' | 'ratingChanges' | 'resultType' | 'confirmation' | 'status'>): string | null {
  if (m.ratingChanges.length) return null;
  if (m.confirmation.status === 'pending') return 'Ratings change once the other side confirms.';
  if (m.status === 'abandoned') return 'Abandoned matches aren’t rated.';
  if (WALKOVER.has(m.resultType ?? '')) return 'Walkovers aren’t rated.';
  if (m.sides.some((s) => s.players.some((p) => p.isGuest))) return 'Matches with a guest aren’t rated until every guest has joined.';
  return null;
}

/** Longest run of rallies in a row won by `side` (racket sports log every rally as `rally_won`). */
export function bestRun(events: MatchView['events'], side: number): number {
  let best = 0;
  let run = 0;
  for (const e of events) {
    if (e.type !== 'rally_won') continue;
    run = e.sideIndex === side ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

/** The three numbers under the score: best point run, points won (or games played), rating change (or minutes). */
export function resultStats(
  m: Pick<MatchView, 'score' | 'events'>,
  refSide: number,
  myDelta: number | null,
  durationMin: number | null,
): { value: string; label: string }[] {
  const { minor, minorLabel, majorLabel } = m.score.totals;
  const segs = m.score.segments.filter((s) => s.complete || s.scores.some((n) => n > 0)).length;
  const stats: { value: string; label: string }[] = [];
  const run = bestRun(m.events, refSide);
  if (run > 1) stats.push({ value: String(run), label: 'Best point run' });
  if (minor.length) stats.push({ value: String(minor[refSide] ?? 0), label: `${minorLabel} won` });
  if (segs && stats.length < 2) stats.push({ value: String(segs), label: `${segs === 1 ? majorLabel.replace(/s$/, '') : majorLabel} played` });
  if (myDelta !== null) stats.push({ value: myDelta > 0 ? `+${myDelta}` : String(myDelta), label: 'Your rating' });
  else if (durationMin) stats.push({ value: String(durationMin), label: 'Minutes' });
  return stats;
}
