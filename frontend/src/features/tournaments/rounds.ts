import type { FixtureView } from './types';

const ROUND_CODES: Record<string, string> = { Final: 'Final', 'Semi-final': 'SF', 'Quarter-final': 'QF', 'Third place': '3rd place' };

/** "QF2", "SF1", "R16 3", "Final". */
export function roundCode(f: Pick<FixtureView, 'roundName' | 'position'>): string | null {
  if (!f.roundName) return null;
  const of = /^Round of (\d+)$/.exec(f.roundName);
  const code = ROUND_CODES[f.roundName] ?? (of ? `R${of[1]}` : null);
  if (!code) return f.roundName;
  if (code === 'Final' || code === '3rd place') return code;
  return of ? `${code} ${f.position}` : `${code}${f.position}`;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Under a round chip: "1 live", "8 done", "Sat" (first match day), "4 matches". */
export function roundSub(fixtures: Pick<FixtureView, 'status' | 'scheduledAt' | 'match'>[], now = new Date()): string {
  const live = fixtures.filter((f) => f.status === 'live' || f.match?.status === 'live').length;
  if (live) return `${live} live`;
  const real = fixtures.filter((f) => f.status !== 'bye' && f.status !== 'cancelled');
  const done = real.filter((f) => f.status === 'completed').length;
  if (real.length && done === real.length) return `${done} done`;
  const next = real.map((f) => f.scheduledAt).filter((d): d is string => !!d).sort()[0];
  if (next) {
    const d = new Date(next);
    return d.toDateString() === now.toDateString() ? 'Today' : DAYS[d.getDay()]!;
  }
  if (done) return `${done} of ${real.length} done`;
  return `${real.length} ${real.length === 1 ? 'match' : 'matches'}`;
}

/** "R16", "QF", "SF", "Final" for a round chip. */
export function roundChip(roundName: string | null, index: number): string {
  if (!roundName) return `R${index + 1}`;
  const of = /^Round of (\d+)$/.exec(roundName);
  if (of) return `R${of[1]}`;
  return ({ 'Quarter-final': 'QF', 'Semi-final': 'SF', Final: 'Final' } as Record<string, string>)[roundName] ?? roundName;
}
