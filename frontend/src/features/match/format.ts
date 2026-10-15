import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import type { MatchCard, MatchView, SegmentSummary } from './types';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Sports carry their own icon key (sports.icon_key), so there is no per-sport table here. */
export function sportIcon(sport: { iconKey: string } | null | undefined): IconName {
  return (sport?.iconKey as IconName | undefined) ?? 'trophy-outline';
}

export function sportColor(sport: { accentColor: string } | null | undefined): string {
  return sport?.accentColor ?? '#FF6B00';
}

/** Top-level segments that have started (games / sets), for compact score rows. */
export function playedSegments(segments: SegmentSummary[]): SegmentSummary[] {
  return segments.filter((s) => s.complete || s.scores.some((n) => n > 0));
}

/** "Alice won 21-15, 21-18" / "Bob won by walkover" / "Final score" for a decided match. */
export function resultText(match: Pick<MatchView, 'sides' | 'score' | 'resultType'> | MatchCard): string {
  const winner = match.sides.find((s) => s.index === match.score.winnerSideIndex);
  const resultType = 'resultType' in match ? match.resultType : null;
  if (resultType === 'double_walkover') return 'Double walkover';
  if (!winner) return 'Final score';
  if (resultType === 'walkover') return `${winner.name} won by walkover`;
  if (resultType === 'no_show') return `${winner.name} won (no-show)`;
  if (resultType === 'retired') return `${winner.name} won (retired)`;
  return `${winner.name} won`;
}

/** A short status for pills: LIVE, FT, W/O, RET, … */
export function statusLabel(status: MatchView['status']): string {
  switch (status) {
    case 'live':
      return 'LIVE';
    case 'completed':
      return 'FT';
    case 'walkover':
      return 'W/O';
    case 'retired':
      return 'RET';
    case 'disputed':
      return 'DISPUTED';
    case 'abandoned':
      return 'ABANDONED';
    default:
      return 'SCHEDULED';
  }
}

/** A random v4 UUID for idempotent scoring requests (no crypto dependency needed). */
export function newClientEventId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Parses "21-15, 18-21 21-19" into [[21, 15], [18, 21], [21, 19]]; null if malformed. */
export function parseScores(text: string): number[][] | null {
  const parts = text
    .split(/[,;\s]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return null;
  const scores = parts.map((p) => p.split(/[-–:]/).map((n) => Number(n)));
  return scores.every((s) => s.length === 2 && s.every((n) => Number.isInteger(n) && n >= 0)) ? scores : null;
}
