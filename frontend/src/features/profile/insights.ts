/*
 * Pure helpers behind the profile v2 sections (tested in insights.test.ts): the trend chart
 * geometry, the 12-week activity grid in the phone's local time, and the stat-tile wording.
 */
import type { SportInsights } from './types';

const DAY = 86_400_000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface TrendGeometry {
  line: string;
  area: string;
  /** Highest point (hollow dot) and the latest point (solid dot). */
  high: { x: number; y: number };
  end: { x: number; y: number };
  hi: number;
  lo: number;
}

/** SVG paths for `values` in a `width` x `height` box, 8px headroom top and bottom (design: 318x96). */
export function trendGeometry(values: number[], width: number, height: number): TrendGeometry | null {
  if (values.length < 2 || width <= 0) return null;
  const top = 8;
  const bottom = height - 8;
  const hi = Math.max(...values);
  const lo = Math.min(...values);
  const span = Math.max(hi - lo, 1);
  const pts = values.map((v, i) => ({ x: (i / (values.length - 1)) * (width - 6) + 3, y: bottom - ((v - lo) / span) * (bottom - top) }));
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L${pts.at(-1)!.x.toFixed(1)} ${height} L${pts[0]!.x.toFixed(1)} ${height} Z`;
  return { line, area, high: pts[values.indexOf(hi)]!, end: pts.at(-1)!, hi, lo };
}

/** Local midnight, as a day number (days since the epoch in the phone's time zone). */
function localDay(t: Date): number {
  return Math.floor((t.getTime() - t.getTimezoneOffset() * 60_000) / DAY);
}

/**
 * 84 cells, column per week (oldest left), Sun..Sat down each column, the last column ending
 * with this week. Levels 0-3 by matches that day (0, 1, 2, 3+). Cells after today are null.
 */
export function activityGrid(isoTimes: string[], now = new Date()): (0 | 1 | 2 | 3 | null)[] {
  const today = localDay(now);
  const todayWeekday = now.getDay();
  const first = today - todayWeekday - 77; // Sunday, 11 weeks before this week's Sunday
  const counts = new Map<number, number>();
  for (const iso of isoTimes) {
    const d = localDay(new Date(iso));
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  return Array.from({ length: 84 }, (_, i) => {
    const day = first + i;
    if (day > today) return null;
    const n = counts.get(day) ?? 0;
    return (n >= 3 ? 3 : n) as 0 | 1 | 2 | 3;
  });
}

/** "1.8 / week · busiest Sat" over the last 12 weeks, or "No matches yet". */
export function activitySummary(isoTimes: string[]): string {
  if (!isoTimes.length) return 'No matches in 12 weeks';
  const per = isoTimes.length / 12;
  const byDay = Array<number>(7).fill(0);
  for (const iso of isoTimes) byDay[new Date(iso).getDay()]! += 1;
  const busiest = byDay.indexOf(Math.max(...byDay));
  return `${per < 0.1 ? '<0.1' : per.toFixed(1)} / week · busiest ${WEEKDAYS[busiest]}`;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** "points" -> "point", "games" -> "game". */
const singular = (s: string) => s.replace(/s$/, '');

/** The six Performance tiles, labelled in the sport's own units. */
export function performanceTiles(i: SportInsights): { value: string; label: string }[] {
  const { stats } = i;
  const minor = stats.minorLabel;
  const major = singular(stats.majorLabel);
  const margin = stats.avgMinorMargin;
  return [
    { value: stats.minorWonPct === null ? '—' : `${stats.minorWonPct}%`, label: `${cap(minor)} won` },
    { value: margin === null ? '—' : margin > 0 ? `+${margin}` : margin < 0 ? `−${Math.abs(margin)}` : '0', label: `Avg ${singular(minor)} margin` },
    { value: `${stats.deciding.won}–${stats.deciding.lost}`, label: `Deciding ${major}s` },
    { value: String(stats.comebacks), label: 'Comeback wins' },
    { value: stats.avgMinutes === null ? '—' : `${stats.avgMinutes}m`, label: 'Avg match time' },
    { value: stats.bestStreak ? `W${stats.bestStreak}` : '—', label: 'Best streak' },
  ];
}

/** "67%" or "—" when nothing was played. */
export function pct(won: number, lost: number): { text: string; value: number } {
  const n = won + lost;
  return n ? { text: `${Math.round((won / n) * 100)}%`, value: won / n } : { text: '—', value: 0 };
}

export const BAND_LABEL = {
  higher: { label: 'Higher rated', range: '+50 or more' },
  similar: { label: 'Similar', range: 'within 50' },
  lower: { label: 'Lower rated', range: '−50 or less' },
} as const;

/** "Top 12% of Jaipur badminton" / "Top 30% of badminton players". */
export function percentileLine(p: SportInsights['percentile'], sportName: string): string | null {
  if (!p) return null;
  return p.city ? `Top ${p.topPercent}% of ${p.city} ${sportName.toLowerCase()}` : `Top ${p.topPercent}% of ${sportName.toLowerCase()} players`;
}
