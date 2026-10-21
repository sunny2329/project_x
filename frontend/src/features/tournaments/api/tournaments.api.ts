import type { MatchView, ParticipantInput } from '@/features/match/types';
import { apiRequest } from '@/shared/api/client';
import { env } from '@/shared/config/env';
import type { DrawPreview, EventDetail, FixtureView, MyMatches, StaffRole, Tiebreaker, Tournament, TournamentListItem, Visibility } from '../types';

const auth = { authenticated: true } as const;
const send = (method: 'POST' | 'PATCH' | 'DELETE', body?: unknown) => ({ method, body, authenticated: true });

export interface NewTournament {
  name: string;
  startsOn?: string;
  endsOn?: string;
  venueName?: string;
  visibility: Visibility;
  entryFee?: string;
}

export interface NewEvent {
  name: string;
  sport: string;
  format: string;
  rulesetId?: string;
  drawFormat: string;
  drawConfig?: Record<string, unknown>;
  tiebreakers?: Tiebreaker[];
  rulesOverride?: Record<string, unknown>;
  maxEntries?: number;
}

/** One function per backend endpoint (backend/src/modules/tournaments/tournaments.routes.ts). */
export const tournamentsApi = {
  list: (filter: 'all' | 'open' | 'live' | 'mine' = 'all', q?: string) =>
    apiRequest<{ tournaments: TournamentListItem[] }>(`/api/v1/tournaments?filter=${filter}${q ? `&q=${encodeURIComponent(q)}` : ''}`, auth),
  get: (id: string) => apiRequest<{ tournament: Tournament }>(`/api/v1/tournaments/${id}`, auth),
  create: (body: NewTournament) => apiRequest<{ tournament: Tournament }>('/api/v1/tournaments', send('POST', body)),
  update: (id: string, body: Partial<NewTournament> & { status?: string }) => apiRequest<{ tournament: Tournament }>(`/api/v1/tournaments/${id}`, send('PATCH', body)),
  fixtures: (id: string) => apiRequest<{ fixtures: FixtureView[] }>(`/api/v1/tournaments/${id}/fixtures`, auth),
  myMatches: () => apiRequest<MyMatches>('/api/v1/tournaments/me/matches', auth),

  addCourt: (id: string, name: string) => apiRequest<{ tournament: Tournament }>(`/api/v1/tournaments/${id}/courts`, send('POST', { name })),
  addStaff: (id: string, userId: string, role: Exclude<StaffRole, 'organizer'>) =>
    apiRequest<{ tournament: Tournament }>(`/api/v1/tournaments/${id}/staff`, send('POST', { userId, role })),
  removeStaff: (id: string, userId: string, role: StaffRole) => apiRequest<{ tournament: Tournament }>(`/api/v1/tournaments/${id}/staff/${userId}/${role}`, send('DELETE')),
  assignCourtScorer: (courtId: string, userId: string, replace = true) =>
    apiRequest<{ tournament: Tournament }>(`/api/v1/courts/${courtId}/scorers`, send('POST', { userId, replace })),
  removeCourtScorer: (courtId: string, userId: string) => apiRequest<{ tournament: Tournament }>(`/api/v1/courts/${courtId}/scorers/${userId}`, send('DELETE')),
  addEvent: (id: string, body: NewEvent) => apiRequest<{ event: EventDetail }>(`/api/v1/tournaments/${id}/events`, send('POST', body)),

  event: (id: string) => apiRequest<{ event: EventDetail }>(`/api/v1/tournament-events/${id}`, auth),
  updateEvent: (id: string, body: { status?: string; maxEntries?: number | null; drawConfig?: Record<string, unknown>; tiebreakers?: Tiebreaker[] }) =>
    apiRequest<{ event: EventDetail }>(`/api/v1/tournament-events/${id}`, send('PATCH', body)),
  addEntry: (id: string, players: ParticipantInput[], seed?: number) =>
    apiRequest<{ event: EventDetail }>(`/api/v1/tournament-events/${id}/entries`, send('POST', { players, ...(seed ? { seed } : {}) })),
  updateEntry: (entryId: string, body: { status?: string; seed?: number | null }) => apiRequest<{ event: EventDetail }>(`/api/v1/entries/${entryId}`, send('PATCH', body)),
  previewDraw: (id: string, randomSeed?: number) =>
    apiRequest<DrawPreview>(`/api/v1/tournament-events/${id}/draw`, send('POST', { preview: true, ...(randomSeed !== undefined ? { randomSeed } : {}) })),
  draw: (id: string, randomSeed: number) => apiRequest<{ event: EventDetail; randomSeed: number }>(`/api/v1/tournament-events/${id}/draw`, send('POST', { randomSeed })),
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

/** The public tournament page: live scores, brackets and standings, no login. */
export function publicTournamentUrl(slug: string): string {
  return `${env.apiUrl}/t/${slug}`;
}
