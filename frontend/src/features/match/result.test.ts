import { bestRun, ratingRows, resultHeadline, resultKicker, resultStats, unratedReason } from './result';
import type { MatchView } from './types';

const player = (id: string, name: string, userId: string | null, isGuest = false) => ({ playerId: id, userId, displayName: name, isGuest }) as MatchView['sides'][number]['players'][number];
function match(over: Partial<MatchView> = {}): MatchView {
  return {
    sport: { id: '3', slug: 'pickleball', name: 'Pickleball', iconKey: 'pickleball', accentColor: '' },
    format: { code: 'doubles', name: 'Doubles', playersPerSide: 2 },
    context: 'friendly',
    status: 'completed',
    resultType: 'played',
    sides: [
      { index: 0, name: 'A', teamId: null, entryId: null, outcome: 'won', players: [player('p1', 'Aarav Mehta', 'u1'), player('p2', 'Kabir Shah', 'u2')] },
      { index: 1, name: 'B', teamId: null, entryId: null, outcome: 'lost', players: [player('p3', 'Ishaan Rao', null, true), player('p4', 'Tara Kapoor', 'u4')] },
    ],
    score: {
      winnerSideIndex: 0,
      totals: { major: [2, 1], minor: [29, 26], majorLabel: 'Games', minorLabel: 'Points' },
      segments: [11, 9, 11].map((a, i) => ({ type: 'game', sequence: i + 1, label: '', scores: [a, [7, 11, 8][i]!], display: [], winnerSideIndex: a === 11 ? 0 : 1, complete: true, children: [] })),
    },
    events: [],
    ratingChanges: [],
    confirmation: { status: 'not_required', canConfirm: false, decisions: [] },
    ...over,
  } as unknown as MatchView;
}

describe('resultHeadline', () => {
  it('tells the score from my side', () => {
    expect(resultHeadline(match(), 'u1')).toEqual({ title: 'Won', score: '2 – 1', refSide: 0 });
    expect(resultHeadline(match(), 'u4')).toEqual({ title: 'Lost', score: '1 – 2', refSide: 1 });
  });
  it('names the winners for a spectator and handles draws, walkovers and abandoned matches', () => {
    expect(resultHeadline(match(), 'zz').title).toBe('Aarav & Kabir won');
    expect(resultHeadline(match({ score: { ...match().score, winnerSideIndex: null } }), 'u1').title).toBe('Draw');
    expect(resultHeadline(match({ resultType: 'walkover' }), 'u1')).toEqual({ title: 'Won (W/O)', score: null, refSide: 0 });
    expect(resultHeadline(match({ status: 'abandoned', score: { ...match().score, winnerSideIndex: null } }), 'u1').title).toBe('No result');
  });
});

it('resultKicker', () => {
  expect(resultKicker(match())).toBe('PICKLEBALL · DOUBLES · FRIENDLY');
});

describe('rating rows', () => {
  it('lists winners first, guests as unrated until claimed', () => {
    const m = match({ ratingChanges: [{ playerId: 'p1', before: 1588.4, after: 1606.2 }, { playerId: 'p2', before: 1561, after: 1576 }, { playerId: 'p4', before: 1602, after: 1587 }] });
    expect(ratingRows(m)).toEqual([
      { kind: 'change', playerId: 'p1', name: 'Aarav Mehta', before: 1588, after: 1606 },
      { kind: 'change', playerId: 'p2', name: 'Kabir Shah', before: 1561, after: 1576 },
      { kind: 'guest', playerId: 'p3', name: 'Ishaan Rao' },
      { kind: 'change', playerId: 'p4', name: 'Tara Kapoor', before: 1602, after: 1587 },
    ]);
    expect(unratedReason(m)).toBeNull();
  });
  it('explains why nothing moved', () => {
    expect(ratingRows(match())[0]).toEqual({ kind: 'unrated', playerId: 'p1', name: 'Aarav Mehta' });
    expect(unratedReason(match())).toMatch(/guest/);
    expect(unratedReason(match({ confirmation: { status: 'pending', canConfirm: false, decisions: [] } }))).toMatch(/confirms/);
    expect(unratedReason(match({ resultType: 'walkover' }))).toMatch(/Walkovers/);
    const noGuests = match({ sides: match().sides.map((s) => ({ ...s, players: s.players.filter((p) => !p.isGuest) })) });
    expect(unratedReason(noGuests)).toBeNull();
  });
});

describe('stats', () => {
  const ev = (sides: number[]) => sides.map((sideIndex) => ({ type: 'rally_won', sideIndex }));
  it('finds the best run of rallies, ignoring other events', () => {
    expect(bestRun([...ev([0, 0, 1, 0, 0, 0]), { type: 'timeout', sideIndex: 1 }, ...ev([0, 1])], 0)).toBe(4);
    expect(bestRun(ev([0, 0, 1]), 1)).toBe(1);
    expect(bestRun([], 0)).toBe(0);
  });
  it('shows best run, points and my rating change', () => {
    const m = match({ events: ev([0, 0, 0, 1, 0]) as MatchView['events'] });
    expect(resultStats(m, 0, 18, 42)).toEqual([
      { value: '3', label: 'Best point run' },
      { value: '29', label: 'Points won' },
      { value: '+18', label: 'Your rating' },
    ]);
  });
  it('falls back to games played and minutes', () => {
    expect(resultStats(match(), 1, null, 42)).toEqual([
      { value: '26', label: 'Points won' },
      { value: '3', label: 'Games played' },
      { value: '42', label: 'Minutes' },
    ]);
    expect(resultStats(match(), 0, -7, null).at(-1)).toEqual({ value: '-7', label: 'Your rating' });
  });
});
