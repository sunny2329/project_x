import type { ParticipantInput } from '@/features/match/types';
import { apiRequest } from '@/shared/api/client';
import type { NewTeam, TeamDetail, TeamRole, TeamSummary } from '../types';

const auth = { authenticated: true } as const;
const send = (method: 'POST' | 'PATCH' | 'DELETE', body?: unknown) => ({ method, body, authenticated: true });
type TeamResponse = { team: TeamDetail };

/** One function per backend endpoint (backend/src/modules/teams/teams.routes.ts). */
export const teamsApi = {
  /** Teams `userId` is in (mine when left out), optionally one sport only. */
  list: (options: { userId?: string; sport?: string } = {}) => {
    const query = new URLSearchParams(Object.entries(options).filter((e): e is [string, string] => !!e[1])).toString();
    return apiRequest<{ teams: TeamSummary[] }>(`/api/v1/teams${query ? `?${query}` : ''}`, auth);
  },
  get: (id: string) => apiRequest<TeamResponse>(`/api/v1/teams/${id}`, auth),
  create: (team: NewTeam) => apiRequest<TeamResponse>('/api/v1/teams', send('POST', team)),
  rename: (id: string, name: string) => apiRequest<TeamResponse>(`/api/v1/teams/${id}`, send('PATCH', { name })),
  remove: (id: string) => apiRequest<{ deleted: true }>(`/api/v1/teams/${id}`, send('DELETE')),
  addMembers: (id: string, members: ParticipantInput[]) => apiRequest<TeamResponse>(`/api/v1/teams/${id}/members`, send('POST', { members })),
  /** Removing someone (captains), or leaving with my own player id. `team` is null once I'm out or it's gone. */
  removeMember: (id: string, playerId: string) => apiRequest<{ team: TeamDetail | null }>(`/api/v1/teams/${id}/members/${playerId}`, send('DELETE')),
  setRole: (id: string, playerId: string, role: TeamRole) => apiRequest<TeamResponse>(`/api/v1/teams/${id}/members/${playerId}`, send('PATCH', { role })),
};
