import type { MatchDetail, ScoreView } from '../types';

export function scoreView(overrides: Partial<ScoreView> = {}): ScoreView {
  const period = { no: 1, label: 'Game 1', score: [0, 0] as [number, number], winner: null, finished: false };
  return {
    kind: 'rally',
    finished: false,
    winner: null,
    currentPeriod: period,
    periods: [period],
    headline: [0, 0],
    totals: [0, 0],
    summary: '0-0',
    cricket: null,
    allowedEvents: ['point'],
    ...overrides,
  };
}

export function matchDetail(overrides: Partial<MatchDetail> = {}): MatchDetail {
  return {
    id: 'm1',
    sport: { id: '1', code: 'PICKLEBALL', name: 'Pickleball' },
    format: { id: '1', name: 'Singles' },
    status: 'live',
    createdBy: 'u1',
    canScore: true,
    config: { kind: 'rally', periodName: 'Game', pointsToWin: 11, winBy: 2, cap: null, bestOf: 3, decidingPoints: null },
    sides: [
      { no: 1, teamId: 't1', name: 'Aarav', players: [{ participantId: 'p1', userId: 'u1', username: 'aarav', fullName: 'Aarav Shah' }] },
      { no: 2, teamId: 't2', name: 'Rohan', players: [{ participantId: 'p2', userId: 'u2', username: 'rohan', fullName: 'Rohan Rao' }] },
    ],
    score: scoreView(),
    version: 0,
    startedAt: '2026-09-29T10:00:00.000Z',
    completedAt: null,
    currentPeriodStartedAt: '2026-09-29T10:00:00.000Z',
    ratingChanges: [],
    ...overrides,
  };
}
