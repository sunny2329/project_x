/*
 * The rating language shared by every screen (design v2 "Rating · shared component").
 * Mirrors TIERS / confidenceOf in backend/src/engine/rating; the profile gets these computed by
 * the API, other screens (setup, brackets, result cards) only have a number and use these.
 */
import type { Confidence, TierKey } from '@/features/profile/types';

export const START_RATING = 1500;
export const PLACEMENT_MATCHES = 3;

export const TIERS: readonly { key: TierKey; name: string; lo: number; hi: number; range: string }[] = [
  { key: 'elite', name: 'Elite', lo: 1850, hi: Number.POSITIVE_INFINITY, range: '1850+' },
  { key: 'platinum', name: 'Platinum', lo: 1700, hi: 1850, range: '1700–1849' },
  { key: 'gold', name: 'Gold', lo: 1550, hi: 1700, range: '1550–1699' },
  { key: 'silver', name: 'Silver', lo: 1400, hi: 1550, range: '1400–1549' },
  { key: 'bronze', name: 'Bronze', lo: 1200, hi: 1400, range: '1200–1399' },
  { key: 'rookie', name: 'Rookie', lo: Number.NEGATIVE_INFINITY, hi: 1200, range: 'Below 1200' },
];

/** Index from the bottom: Rookie 0 ... Elite 5 (how many ladder bars light up, minus one). */
export function tierLevel(key: TierKey): number {
  return TIERS.length - 1 - TIERS.findIndex((t) => t.key === key);
}

export function tierFor(rating: number) {
  const t = TIERS.find((x) => rating >= x.lo && rating < x.hi)!;
  const lo = Number.isFinite(t.lo) ? t.lo : 1000;
  const hi = Number.isFinite(t.hi) ? t.hi : 2100;
  const i = TIERS.indexOf(t);
  const next = i > 0 ? TIERS[i - 1]! : null;
  return {
    key: t.key,
    name: t.name,
    progress: Math.min(1, Math.max(0, (rating - lo) / (hi - lo))),
    next: next ? { key: next.key, name: next.name, pointsToGo: Math.max(1, Math.ceil(t.hi - rating)) } : null,
  };
}

export function confidenceFor(ratedMatches: number): Confidence {
  if (ratedMatches < PLACEMENT_MATCHES) return 'placement';
  if (ratedMatches < 5) return 'low';
  if (ratedMatches < 15) return 'medium';
  return 'high';
}

/** Lit confidence bars (of 3). */
export const CONFIDENCE_BARS: Record<Confidence, number> = { placement: 0, low: 1, medium: 2, high: 3 };
export const CONFIDENCE_LABEL: Record<Confidence, string> = { placement: 'Placement', low: 'Low confidence', medium: 'Medium confidence', high: 'High confidence' };

/** "+18" / "−6" / "0" with a real minus sign. */
export function signed(n: number): string {
  const r = Math.round(n);
  return r > 0 ? `+${r}` : r < 0 ? `−${Math.abs(r)}` : '0';
}
