import type { MatchView, ParticipantInput } from '@/features/match/types';
import { apiRequest } from '@/shared/api/client';
import { env } from '@/shared/config/env';
import type { EventDetail, FixtureView, Tournament, TournamentListItem } from '../types';

const auth = { authenticated: true } as const;
const send = (method: 'POST' | 'PATCH' | 'DELETE', body?: unknown) => ({ method, body, authenticated: true });

/** One function per backend endpoint; see wiki.md "Tournament API". */
export const tournamentsApi = {
  list: () => apiRequest<{ tournaments: TournamentListItem[] }>('/api/v1/tournaments', auth),
  get: (id: string) => apiRequest<{ tournament: Tournament }>(`/api/v1/tournaments/${id}`, auth),
  create: (body: { name: string; venueName?: string; startsOn?: string; visibility?: string }) =>
    apiRequest<{ tournament: Tournament }>('/api/v1/tournaments', send('POST', body)),
  update: (id: string, body: Record<string, unknown>) => apiRequest<{ tournament: Tournament }>(`/api/v1/tournaments/${id}`, send('PATCH', body)),
  addCourt: (id: string, name: string) => apiRequest<{ tournament: Tournament }>(`/api/v1/tournaments/${id}/courts`, send('POST', { name })),
  addStaff: (id: string, userId: string, role: 'co_organizer' | 'scorer' | 'referee') =>
    apiRequest<{ tournament: Tournament }>(`/api/v1/tournaments/${id}/staff`, send('POST', { userId, role })),
  assignCourtScorer: (courtId: string, userId: string) => apiRequest<{ tournament: Tournament }>(`/api/v1/courts/${courtId}/scorers`, send('POST', { userId })),
  addEvent: (id: string, body: { name: string; sport: string; format: string; rulesetId?: string; drawFormat: string; drawConfig?: Record<string, unknown> }) =>
    apiRequest<{ event: EventDetail }>(`/api/v1/tournaments/${id}/events`, send('POST', body)),

  event: (id: string) => apiRequest<{ event: EventDetail }>(`/api/v1/tournament-events/${id}`, auth),
  updateEvent: (id: string, body: Record<string, unknown>) => apiRequest<{ event: EventDetail }>(`/api/v1/tournament-events/${id}`, send('PATCH', body)),
  addEntry: (id: string, players: ParticipantInput[], seed?: number) =>
    apiRequest<{ event: EventDetail }>(`/api/v1/tournament-events/${id}/entries`, send('POST', { players, ...(seed ? { seed } : {}) })),
  updateEntry: (entryId: string, body: { status?: string; seed?: number | null }) => apiRequest<{ event: EventDetail }>(`/api/v1/entries/${entryId}`, send('PATCH', body)),
  draw: (id: string) => apiRequest<{ event: EventDetail; randomSeed: number }>(`/api/v1/tournament-events/${id}/draw`, send('POST', {})),
  resetDraw: (id: string) => apiRequest<{ event: EventDetail }>(`/api/v1/tournament-events/${id}/draw`, send('DELETE')),

  fixture: (fixtureId: string) => apiRequest<{ fixture: FixtureView }>(`/api/v1/fixtures/${fixtureId}`, auth),
  myFixtures: () => apiRequest<{ fixtures: FixtureView[] }>('/api/v1/fixtures/mine', auth),
  schedule: (fixtureId: string, body: { courtId?: string | null; scheduledAt?: string | null }) =>
    apiRequest<{ fixture: FixtureView }>(`/api/v1/fixtures/${fixtureId}`, send('PATCH', body)),
  start: (fixtureId: string) => apiRequest<{ match: MatchView }>(`/api/v1/fixtures/${fixtureId}/start`, send('POST', {})),
  walkover: (fixtureId: string, winnerEntryId: string | null, reason: 'walkover' | 'no_show') =>
    apiRequest<{ match: MatchView }>(`/api/v1/fixtures/${fixtureId}/walkover`, send('POST', { winnerEntryId, reason })),
  result: (fixtureId: string, scores: number[][]) => apiRequest<{ match: MatchView }>(`/api/v1/fixtures/${fixtureId}/result`, send('POST', { scores })),
};

/** The public tournament page: brackets, fixtures, live scores and standings, no login. */
export function publicTournamentUrl(slug: string): string {
  return `${env.apiUrl}/t/${slug}`;
}
