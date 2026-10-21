import type { MatchView, ScoreSummary } from '../types';

/** A live badminton singles match, as the API returns it. */
export function scoreSummary(overrides: Partial<ScoreSummary> = {}): ScoreSummary {
  return {
    scoringModel: 'rally',
    complete: false,
    winnerSideIndex: null,
    sides: [
      { index: 0, primary: '1', current: '17', serving: true, serverNumber: null, serverPlayerIndex: 0, serveNote: 'Left court' },
      { index: 1, primary: '0', current: '15', serving: false, serverNumber: null, serverPlayerIndex: null, serveNote: null },
    ],
    segments: [
      { type: 'game', sequence: 1, label: 'Game 1', scores: [21, 18], display: ['21', '18'], winnerSideIndex: 0, complete: true, children: [] },
      { type: 'game', sequence: 2, label: 'Game 2', scores: [17, 15], display: ['17', '15'], winnerSideIndex: null, complete: false, children: [] },
    ],
    headline: '21-18, 17-15',
    callout: null,
    totals: { major: [1, 0], minor: [38, 33], majorLabel: 'Games', minorLabel: 'Points' },
    actions: [
      { id: 'point-0', label: 'Point', sideIndex: 0, event: { type: 'rally_won', sideIndex: 0 } },
      { id: 'point-1', label: 'Point', sideIndex: 1, event: { type: 'rally_won', sideIndex: 1 } },
    ],
    ...overrides,
  };
}

export function matchView(overrides: Partial<MatchView> = {}): MatchView {
  return {
    id: 'm1',
    context: 'friendly',
    sport: { id: '2', slug: 'badminton', name: 'Badminton', iconKey: 'badminton', accentColor: '#A855F7' },
    format: { code: 'singles', name: 'Singles', playersPerSide: 1 },
    ruleset: { id: 'r1', name: 'Best of 3 · 21 points', scoringModel: 'rally' },
    scoringMode: 'live',
    shareToken: 'abcdefghijklmnopqrstuv',
    createdByUserId: 'u1',
    venue: null,
    court: null,
    tournament: null,
    sides: [
      { index: 0, name: 'Aarav', teamId: null, entryId: null, outcome: null, players: [{ playerId: 'p1', userId: 'u1', displayName: 'Aarav Shah', isGuest: false }] },
      { index: 1, name: 'Rohan', teamId: null, entryId: null, outcome: null, players: [{ playerId: 'p2', userId: null, displayName: 'Rohan', isGuest: true }] },
    ],
    status: 'live',
    resultType: null,
    score: scoreSummary(),
    version: 72,
    canScore: true,
    startedAt: '2026-10-01T10:00:00.000Z',
    completedAt: null,
    ratingChanges: [],
    confirmation: { status: 'not_required', canConfirm: false, decisions: [] },
    ...overrides,
  };
}
