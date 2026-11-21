import { categoryStatus, progress } from './hub';

const ev = (o = {}) => ({ id: 'e1', status: 'in_progress', maxEntries: 16, approvedEntries: 13, pendingEntries: 0, ...o }) as never;
const fx = (o: Record<string, unknown>) => ({ eventId: 'e1', status: 'pending', roundName: 'Quarter-final', round: 2, position: 1, stageType: 'knockout', groupName: null, court: null, scheduledAt: null, match: null, ...o }) as never;

describe('progress', () => {
  it('counts played matches, ignoring byes', () => {
    expect(progress([])).toBeNull();
    expect(progress([fx({ status: 'completed' }), fx({ status: 'bye' }), fx({ status: 'ready' })])).toEqual({ done: 1, total: 2, text: '1 of 2 matches' });
  });
});

describe('categoryStatus', () => {
  const now = new Date(2026, 10, 21, 12);
  it('shows live matches first', () => {
    expect(categoryStatus(ev(), [fx({ status: 'completed' }), fx({ status: 'live', court: { id: 'c', name: 'Court 2', scorers: [] } })], now)).toEqual({ badge: 'LIVE', tone: 'live', line: 'QF · 1 live on Court 2' });
    expect(categoryStatus(ev(), [fx({ status: 'live' }), fx({ status: 'ready', match: { status: 'live' } })], now).line).toBe('QF · 2 live');
  });
  it('counts what is left, then done', () => {
    expect(categoryStatus(ev(), [fx({ status: 'completed', stageType: 'round_robin' }), fx({ stageType: 'round_robin' }), fx({ stageType: 'round_robin' })], now)).toEqual({ badge: 'In progress', tone: 'progress', line: 'Group stage · 2 matches left' });
    expect(categoryStatus(ev(), [fx({ status: 'completed' }), fx({ status: 'bye' })], now)).toEqual({ badge: 'Done', tone: 'done', line: 'Match played' });
  });
  it('says when a drawn category starts', () => {
    const at = new Date(2026, 10, 21, 14).toISOString();
    expect(categoryStatus(ev(), [fx({ roundName: 'Round of 16', scheduledAt: at, court: { id: 't', name: 'Table 1', scorers: [] } })], now)).toEqual({ badge: 'Up next', tone: 'next', line: 'R16 starts 2:00 PM · Table 1' });
    const sat = new Date(2026, 10, 22, 9).toISOString();
    expect(categoryStatus(ev(), [fx({ roundName: 'Semi-final', scheduledAt: sat })], now).line).toBe('SF starts Sun 9:00 AM');
    expect(categoryStatus(ev(), [fx({})], now)).toEqual({ badge: 'Drawn', tone: 'next', line: '1 match drawn' });
  });
  it('shows entries before the draw', () => {
    expect(categoryStatus(ev({ status: 'registration_open', approvedEntries: 10, pendingEntries: 2 }), [], now)).toEqual({ badge: 'Entries open', tone: 'open', line: '12/16 entries' });
    expect(categoryStatus(ev({ status: 'registration_open', approvedEntries: 16 }), [], now).badge).toBe('Full');
    expect(categoryStatus(ev({ status: 'registration_closed', maxEntries: null, approvedEntries: 1 }), [], now)).toEqual({ badge: 'Entries closed', tone: 'plain', line: '1 entry · draw coming' });
    expect(categoryStatus(ev({ status: 'draft', approvedEntries: 0 }), [], now).badge).toBe('Draft');
  });
});
