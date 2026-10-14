import { apiRequest } from '@/shared/api/client';
import type { MatchHistoryItem, Profile, ProfileChanges, Sport } from '../types';

/** One function per backend endpoint; see wiki.md "Profile API". */
export const profileApi = {
  sports: () => apiRequest<{ sports: Sport[] }>('/api/v1/sports', { authenticated: true }),

  me: () => apiRequest<{ profile: Profile }>('/api/v1/profile/me', { authenticated: true }),

  update: (changes: ProfileChanges) =>
    apiRequest<{ profile: Profile }>('/api/v1/profile/me', { method: 'PATCH', body: changes, authenticated: true }),

  updateSports: (sportIds: string[], primarySportId: string | null) =>
    apiRequest<{ profile: Profile }>('/api/v1/profile/me/sports', {
      method: 'PUT',
      body: { sportIds, primarySportId },
      authenticated: true,
    }),

  matches: (limit = 20) =>
    apiRequest<{ matches: MatchHistoryItem[] }>(`/api/v1/profile/me/matches?limit=${limit}`, { authenticated: true }),
};
