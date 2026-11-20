/*
 * Design v2 group standings wording (tested in groups.test.ts).
 */
import type { FixtureView, StandingRow } from './types';

/** Under a group chip: "Complete", "3-way tie", "2 left", "Not started". */
export function groupSub(rows: StandingRow[], fixtures: Pick<FixtureView, 'status'>[]): string {
  const real = fixtures.filter((f) => f.status !== 'bye' && f.status !== 'cancelled');
  const left = real.filter((f) => f.status !== 'completed').length;
  const levels = new Map<number, number>();
  for (const r of rows) if (r.played) levels.set(r.won, (levels.get(r.won) ?? 0) + 1);
  const tie = Math.max(0, ...[...levels.values()]);
  if (tie >= 3 && rows.some((r) => r.tiebreak && r.tiebreak !== 'match_wins')) return `${tie}-way tie`;
  if (real.length && !left) return 'Complete';
  if (left === real.length) return 'Not started';
  return `${left} left`;
}

/** "Qualified" / "Out on tiebreak" / null under a name. Only once the group is complete. */
export function rowStatus(r: StandingRow, rows: StandingRow[], qualifiers: number, complete: boolean): { text: string; tone: 'good' | 'bad' } | null {
  if (!complete || qualifiers <= 0 || r.withdrawn) return null;
  if (r.rank <= qualifiers) return { text: 'Qualified', tone: 'good' };
  const lastIn = rows.find((x) => x.rank === qualifiers);
  if (lastIn && r.won === lastIn.won && r.tiebreak && r.tiebreak !== 'match_wins') return { text: 'Out on tiebreak', tone: 'bad' };
  return null;
}
