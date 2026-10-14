import { apiRequest } from '@/shared/api/client';
import type { MatchCard, MatchDetail, NewMatch, PlayerSummary, ScoreEvent, SportSetup } from '../types';

type MatchResponse = { match: MatchDetail };

/** One function per backend endpoint; see wiki.md "Match API". */
export const matchApi = {
  setup: () => apiRequest<{ sports: SportSetup[] }>('/api/v1/matches/setup', { authenticated: true }),

  live: () => apiRequest<{ matches: MatchCard[] }>('/api/v1/matches/live', { authenticated: true }),

  create: (match: NewMatch) => apiRequest<MatchResponse>('/api/v1/matches', { method: 'POST', body: match, authenticated: true }),

  get: (id: string) => apiRequest<MatchResponse>(`/api/v1/matches/${id}`, { authenticated: true }),

  /** `version` is the match version the scorer is looking at; a stale one is rejected (STALE_MATCH). */
  score: (id: string, event: ScoreEvent, version: number) =>
    apiRequest<MatchResponse>(`/api/v1/matches/${id}/events`, { method: 'POST', body: { ...event, version }, authenticated: true }),

  undo: (id: string, version: number) =>
    apiRequest<MatchResponse>(`/api/v1/matches/${id}/undo`, { method: 'POST', body: { version }, authenticated: true }),

  finish: (id: string, version: number) =>
    apiRequest<MatchResponse>(`/api/v1/matches/${id}/finish`, { method: 'POST', body: { version }, authenticated: true }),

  abandon: (id: string) => apiRequest<MatchResponse>(`/api/v1/matches/${id}/abandon`, { method: 'POST', authenticated: true }),

  searchPlayers: (query: string) =>
    apiRequest<{ players: PlayerSummary[] }>(`/api/v1/players?q=${encodeURIComponent(query)}`, { authenticated: true }),
};
