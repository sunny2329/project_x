/*
 * Design v2 tournament hub: progress and one status line per category (tested in hub.test.ts).
 */
import { clock12 } from '@/shared/utils/format';
import { roundCode } from './rounds';
import type { EventSummary, FixtureView } from './types';

type Fx = Pick<FixtureView, 'eventId' | 'status' | 'roundName' | 'round' | 'position' | 'stageType' | 'groupName' | 'court' | 'scheduledAt' | 'match'>;

const matches = (n: number) => `${n} ${n === 1 ? 'match' : 'matches'}`;
const real = (f: Fx) => f.status !== 'bye' && f.status !== 'cancelled';
const isLive = (f: Fx) => f.status === 'live' || f.match?.status === 'live';

/** "23 of 61 matches" and the fraction for the bar; null before any draw. */
export function progress(fixtures: Fx[]): { done: number; total: number; text: string } | null {
  const list = fixtures.filter(real);
  if (!list.length) return null;
  const done = list.filter((f) => f.status === 'completed').length;
  return { done, total: list.length, text: `${done} of ${list.length} matches` };
}

export type HubTone = 'live' | 'progress' | 'next' | 'done' | 'open' | 'plain';

/** Badge and line for a category card: "QF · 1 live on Court 2" / LIVE, "Group stage · 2 matches left" / In progress. */
export function categoryStatus(e: Pick<EventSummary, 'id' | 'status' | 'maxEntries' | 'approvedEntries' | 'pendingEntries'>, fixtures: Fx[], now = new Date()): { badge: string; tone: HubTone; line: string } {
  const mine = fixtures.filter((f) => f.eventId === e.id && real(f));
  const live = mine.filter(isLive);
  const left = mine.filter((f) => f.status !== 'completed');
  const stageWord = (f: Fx) => (f.stageType === 'round_robin' ? 'Group stage' : (roundCode(f) ?? '').replace(/\d+$/, '').trim() || 'Draw');
  if (live.length) {
    const f = live[0]!;
    const where = live.length === 1 && f.court ? ` on ${f.court.name}` : '';
    return { badge: 'LIVE', tone: 'live', line: `${stageWord(f)} · ${live.length} live${where}` };
  }
  if (mine.length && !left.length) return { badge: 'Done', tone: 'done', line: mine.length === 1 ? 'Match played' : `All ${mine.length} matches played` };
  if (mine.length && left.length < mine.length) {
    const f = left[0]!;
    return { badge: 'In progress', tone: 'progress', line: `${stageWord(f)} · ${matches(left.length)} left` };
  }
  if (mine.length) {
    const next = left.filter((f) => f.scheduledAt).sort((a, b) => a.scheduledAt!.localeCompare(b.scheduledAt!))[0];
    if (next) {
      const d = new Date(next.scheduledAt!);
      const when = d.toDateString() === now.toDateString() ? clock12(d) : `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]} ${clock12(d)}`;
      return { badge: 'Up next', tone: 'next', line: `${stageWord(next)} starts ${when}${next.court ? ` · ${next.court.name}` : ''}` };
    }
    return { badge: 'Drawn', tone: 'next', line: `${matches(mine.length)} drawn` };
  }
  const taken = e.approvedEntries + e.pendingEntries;
  const count = e.maxEntries ? `${taken}/${e.maxEntries} entries` : `${taken} ${taken === 1 ? 'entry' : 'entries'}`;
  if (e.status === 'registration_open') return e.maxEntries !== null && taken >= e.maxEntries ? { badge: 'Full', tone: 'plain', line: count } : { badge: 'Entries open', tone: 'open', line: count };
  if (e.status === 'registration_closed') return { badge: 'Entries closed', tone: 'plain', line: `${count} · draw coming` };
  return { badge: 'Draft', tone: 'plain', line: count };
}
