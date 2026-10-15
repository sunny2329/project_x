import { apiRequest } from '@/shared/api/client';
import { env } from '@/shared/config/env';
import type { MatchCard, MatchView, NewMatch, PlayerOption, PlayerRef, PluginEvent, SportSummary } from '../types';

type MatchResponse = { match: MatchView };
const auth = { authenticated: true } as const;
const post = (body?: unknown) => ({ method: 'POST' as const, body, authenticated: true });

/** One function per backend endpoint; see wiki.md "Match API". */
export const matchApi = {
  sports: () => apiRequest<{ sports: SportSummary[] }>('/api/v1/sports', auth),
  live: () => apiRequest<{ matches: MatchCard[] }>('/api/v1/matches/live', auth),
  pendingConfirmations: () => apiRequest<{ matches: MatchCard[] }>('/api/v1/matches/pending-confirmations', auth),
  create: (match: NewMatch) => apiRequest<MatchResponse>('/api/v1/matches', post(match)),
  get: (id: string) => apiRequest<MatchResponse>(`/api/v1/matches/${id}`, auth),

  /** `version` is the version the scorer is looking at; `clientEventId` makes a retry harmless. */
  score: (id: string, event: PluginEvent, version: number, clientEventId: string) =>
    apiRequest<MatchResponse>(`/api/v1/matches/${id}/events`, post({ event, version, clientEventId })),
  undo: (id: string, version: number) => apiRequest<MatchResponse>(`/api/v1/matches/${id}/undo`, post({ version })),
  complete: (id: string, version: number) => apiRequest<MatchResponse>(`/api/v1/matches/${id}/complete`, post({ version })),
  retire: (id: string, version: number, retiredSideIndex: number) =>
    apiRequest<MatchResponse>(`/api/v1/matches/${id}/retire`, post({ version, retiredSideIndex })),
  abandon: (id: string) => apiRequest<MatchResponse>(`/api/v1/matches/${id}/abandon`, post()),
  confirm: (id: string, decision: 'confirmed' | 'disputed', comment?: string) =>
    apiRequest<MatchResponse>(`/api/v1/matches/${id}/confirm`, post({ decision, ...(comment ? { comment } : {}) })),

  searchPlayers: (query: string) => apiRequest<{ players: PlayerOption[] }>(`/api/v1/players?q=${encodeURIComponent(query)}`, auth),
  recentGuests: () => apiRequest<{ players: PlayerRef[] }>('/api/v1/players/guests', auth),
  me: () => apiRequest<{ player: PlayerRef }>('/api/v1/players/me', auth),
  claimGuests: () => apiRequest<{ claimed: number }>('/api/v1/players/claim', post()),
};

/** The read-only live scoreboard link anyone can open without the app. */
export function shareUrl(match: Pick<MatchView, 'shareToken'>): string {
  return `${env.apiUrl}/s/${match.shareToken}`;
}
