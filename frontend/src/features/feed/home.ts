/*
 * Wording for the design v2 Home dashboard (tested in home.test.ts).
 */
import type { MatchHistoryItem } from '@/features/profile/types';
import type { FixtureView, TournamentListItem } from '@/features/tournaments/types';
import { clock12, shortDay } from '@/shared/utils/format';

/** "Good morning" (5-11), "Good afternoon" (12-16), "Good evening" otherwise. */
export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  return 'Good evening';
}

const ROUND_SHORT: Record<string, string> = { 'Quarter-final': 'QF', 'Semi-final': 'SF', Final: 'the final', 'Third place': 'the 3rd-place match' };

/** "QF", "R16", "Group A". */
export function roundShort(f: Pick<FixtureView, 'roundName' | 'groupName'>): string {
  if (f.groupName) return f.groupName;
  if (!f.roundName) return 'a match';
  const roundOf = /^Round of (\d+)$/.exec(f.roundName);
  return ROUND_SHORT[f.roundName] ?? (roundOf ? `R${roundOf[1]}` : f.roundName);
}

/** My next unfinished fixture in this tournament (earliest scheduled first, then unscheduled). */
export function nextFixtureFor(t: Pick<TournamentListItem, 'events'>, fixtures: FixtureView[]): FixtureView | null {
  const ids = new Set(t.events.map((e) => e.id));
  const open = fixtures.filter((f) => ids.has(f.eventId) && f.status !== 'completed' && f.status !== 'bye' && f.status !== 'cancelled');
  open.sort((a, b) => (a.scheduledAt ?? '9999').localeCompare(b.scheduledAt ?? '9999'));
  return open[0] ?? null;
}

/**
 * "Badminton · Knockout · You play QF at 7:30 PM" / "Multi-sport · 4 sports · 9 categories".
 * `format` is the single event's draw format when known.
 */
export function tournamentLine(t: Pick<TournamentListItem, 'sports' | 'events' | 'live'>, next: FixtureView | null, now = new Date()): string {
  const categories = `${t.events.length} ${t.events.length === 1 ? 'category' : 'categories'}`;
  const head = t.sports.length > 1 ? ['Multi-sport', `${t.sports.length} sports`, categories] : [t.sports[0]?.name ?? 'Tournament', categories];
  if (next) {
    const live = next.match?.status === 'live' || next.status === 'live';
    if (live) head.push(`You're playing ${roundShort(next)} now`);
    else if (next.scheduledAt) {
      const at = new Date(next.scheduledAt);
      const sameDay = at.toDateString() === now.toDateString();
      head.push(`You play ${roundShort(next)} ${sameDay ? `at ${clock12(at)}` : `${shortDay(next.scheduledAt, now)} ${clock12(at)}`}`);
    } else head.push(`You play ${roundShort(next)} next`);
  } else if (t.live) head.push('Live now');
  return head.join(' · ');
}

/** "Won vs Kabir S. · Pickleball" for a finished match in my history. */
export function resultTitle(m: MatchHistoryItem): string {
  const word = m.outcome === 'won' ? 'Won' : m.outcome === 'lost' ? 'Lost' : m.outcome === 'draw' ? 'Drew' : 'Played';
  const short = (name: string) => {
    const [first, ...rest] = name.trim().split(/\s+/);
    return rest.length ? `${first} ${rest.at(-1)![0]}.` : first!;
  };
  const vs = m.opponents.length ? ` vs ${m.opponents.map(short).join(' & ')}` : '';
  return `${word}${vs} · ${m.sport.name}`;
}

/** "11–7, 11–9 · Friendly · Yesterday". */
export function resultLine(m: MatchHistoryItem, now = new Date()): string {
  return [m.headline?.replace(/-/g, '–'), m.context === 'tournament' ? (m.tournament?.name ?? 'Tournament') : 'Friendly', shortDay(m.playedAt, now)].filter(Boolean).join(' · ');
}
