/*
 * Design v2 live scoring wording (tested in scoring-v2.test.ts).
 */
import { firstName } from '@/shared/utils/format';
import { serveTurn } from './rules';
import type { MatchView, ScoreSummary, ScoringAction } from './types';

/** "SERVE · RIGHT", "SERVING · 2", "SERVE · 1 OF 2"; tennis says "Serving"; side-out receivers "RECEIVING". */
export function sidePill(match: Pick<MatchView, 'rulesetConfig' | 'sides'>, score: ScoreSummary, i: number): { text: string; tone: 'filled' | 'outline' | 'plain' } | null {
  const side = score.sides[i];
  if (!side || score.complete) return null;
  if (score.scoringModel === 'tennis') return { text: side.serving ? 'Serving' : 'Receiving', tone: 'plain' };
  if (!side.serving) return score.scoringModel === 'side_out' ? { text: 'RECEIVING', tone: 'outline' } : null;
  if (score.scoringModel === 'side_out') return { text: side.serverNumber ? `SERVING · ${side.serverNumber}` : 'SERVING', tone: 'filled' };
  const turn = serveTurn(match.rulesetConfig, score.segments.at(-1)?.scores ?? [0, 0]);
  if (turn && turn.of > 1) return { text: `SERVE · ${turn.nth} OF ${turn.of}`, tone: 'filled' };
  const court = side.serveNote?.replace(/ court$/i, '');
  return { text: court ? `SERVE · ${court.toUpperCase()}` : 'SERVE', tone: 'filled' };
}

/** "Server 2 · Aarav · left court" under CALL THE SCORE (side-out doubles), "Aarav serving · right court" in singles. */
export function serverLine(match: Pick<MatchView, 'sides'>, score: ScoreSummary): string | null {
  const i = score.sides.findIndex((s) => s.serving);
  if (i < 0) return null;
  const side = score.sides[i]!;
  const players = match.sides[i]?.players ?? [];
  const who = side.serverPlayerIndex !== null ? firstName(players[side.serverPlayerIndex]?.displayName ?? '') : players.length === 1 ? firstName(players[0]!.displayName) : null;
  return [side.serverNumber ? `Server ${side.serverNumber}` : null, who || null, side.serveNote].filter(Boolean).join(' · ') || null;
}

/** The line at the bottom of a side's card: what a tap does. */
export function tapHint(score: ScoreSummary, action: ScoringAction | undefined, preview: string | null): string | null {
  if (score.complete || !action) return null;
  if (score.scoringModel === 'side_out') return `Rally won → ${action.label.toLowerCase()}`;
  if (score.scoringModel === 'tennis') return preview ?? 'Tap when they win the point';
  return preview ?? 'Tap to add a point';
}

/** Info banner text: "Match point", "20-all", "Deuce", "Advantage Aarav", "Tiebreak · first to 7, win by 2". Null when nothing is on. */
export function banner(score: ScoreSummary, names: string[], config: unknown): string | null {
  const c = (config ?? {}) as { tiebreakPoints?: number; matchTiebreakPoints?: number };
  // Side-out's callout is the score call ("7-4-2"), shown in the CALL THE SCORE block instead.
  if (score.complete || score.scoringModel === 'side_out') return null;
  const last = score.segments.at(-1);
  const child = last?.children.at(-1)?.type;
  const matchTb = last?.type === 'match_tiebreak' || child === 'match_tiebreak';
  const inTiebreak = matchTb || child === 'tiebreak';
  const raw = score.callout;
  if (raw && raw.toUpperCase() === 'ADVANTAGE') {
    const game = last?.children.at(-1);
    const ahead = game ? (game.scores[0]! > game.scores[1]! ? 0 : 1) : 0;
    return `Advantage ${firstName(names[ahead] ?? '')}`;
  }
  if (inTiebreak && (!raw || /tiebreak/i.test(raw))) {
    const to = matchTb ? (c.matchTiebreakPoints ?? 10) : (c.tiebreakPoints ?? 7);
    return `${matchTb ? 'Match tiebreak' : 'Tiebreak'} · first to ${to}, win by 2`;
  }
  if (raw) return inTiebreak ? `${raw} · tiebreak` : raw;
  const [a, b] = score.sides.map((s) => Number(s.current ?? 0));
  if (score.scoringModel === 'rally' && a === b && a! >= 10) return `${a}-all`;
  return null;
}

/** Rallies scored so far (the number on the LIVE pill). */
export function ralliesPlayed(events: MatchView['events']): number {
  return events.filter((e) => e.type === 'rally_won').length;
}
