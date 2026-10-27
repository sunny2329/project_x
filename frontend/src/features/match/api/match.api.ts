import { apiRequest } from '@/shared/api/client';
import { env } from '@/shared/config/env';
import type { MatchCard, MatchDetails, MatchView, NewMatch, PlayerOption, PlayerRef, PluginEvent, SportSummary } from '../types';

type MatchResponse = { match: MatchView };
const auth = { authenticated: true } as const;
const post = (body?: unknown) => ({ method: 'POST' as const, body, authenticated: true });
/** Starting and ending a match write results, stats, ratings and the feed post: allow longer. */
const slowPost = (body?: unknown) => ({ ...post(body), timeoutMs: 90_000 });

/** One function per backend endpoint; see wiki.md "Match API". */
export const matchApi = {
  sports: () => apiRequest<{ sports: SportSummary[] }>('/api/v1/sports', auth),
  live: () => apiRequest<{ matches: MatchCard[] }>('/api/v1/matches/live', auth),
  pendingConfirmations: () => apiRequest<{ matches: MatchCard[] }>('/api/v1/matches/pending-confirmations', auth),
  create: (match: NewMatch) => apiRequest<MatchResponse>('/api/v1/matches', slowPost(match)),
  get: (id: string) => apiRequest<MatchResponse>(`/api/v1/matches/${id}`, auth),
  details: (id: string) => apiRequest<{ details: MatchDetails }>(`/api/v1/matches/${id}/details`, auth),

  /** `version` is the version the scorer is looking at; `clientEventId` makes a retry harmless. */
  score: (id: string, event: PluginEvent, version: number, clientEventId: string) =>
    apiRequest<MatchResponse>(`/api/v1/matches/${id}/events`, post({ event, version, clientEventId })),
  undo: (id: string, version: number) => apiRequest<MatchResponse>(`/api/v1/matches/${id}/undo`, post({ version })),
  complete: (id: string, version: number) => apiRequest<MatchResponse>(`/api/v1/matches/${id}/complete`, slowPost({ version })),
  retire: (id: string, version: number, retiredSideIndex: number) =>
    apiRequest<MatchResponse>(`/api/v1/matches/${id}/retire`, slowPost({ version, retiredSideIndex })),
  abandon: (id: string) => apiRequest<MatchResponse>(`/api/v1/matches/${id}/abandon`, slowPost()),
  /** Before the first point only. Null winner = neither side turned up. */
  walkover: (id: string, winnerSideIndex: number | null, reason: 'walkover' | 'no_show') =>
    apiRequest<MatchResponse>(`/api/v1/matches/${id}/walkover`, slowPost({ winnerSideIndex, reason })),
  addScorer: (id: string, userId: string) => apiRequest<MatchResponse>(`/api/v1/matches/${id}/scorers`, post({ userId })),
  confirm: (id: string, decision: 'confirmed' | 'disputed', comment?: string) =>
    apiRequest<MatchResponse>(`/api/v1/matches/${id}/confirm`, post({ decision, ...(comment ? { comment } : {}) })),

  searchPlayers: (query: string, sport?: string) =>
    apiRequest<{ players: PlayerOption[] }>(`/api/v1/players?q=${encodeURIComponent(query)}${sport ? `&sport=${encodeURIComponent(sport)}` : ''}`, auth),
  recentGuests: () => apiRequest<{ players: PlayerRef[] }>('/api/v1/players/guests', auth),
  me: () => apiRequest<{ player: PlayerRef }>('/api/v1/players/me', auth),
  claimGuests: () => apiRequest<{ claimed: number }>('/api/v1/players/claim', post()),
};

/** The read-only live scoreboard link anyone can open without the app. */
export function shareUrl(match: Pick<MatchView, 'shareToken'>): string {
  return `${env.apiUrl}/s/${match.shareToken}`;
}
