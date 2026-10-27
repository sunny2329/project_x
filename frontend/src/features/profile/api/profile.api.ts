import { apiRequest } from '@/shared/api/client';
import type { ClaimableMatch, FollowList, FollowListPage, MatchHistoryItem, Profile, ProfileChanges, PublicProfile, Sport, UserSummary } from '../types';

const auth = { authenticated: true } as const;

/** One function per backend endpoint (profile, users, players/claim). */
export const profileApi = {
  sports: () => apiRequest<{ sports: Sport[] }>('/api/v1/sports', auth),

  me: () => apiRequest<{ profile: Profile }>('/api/v1/profile/me', auth),

  update: (changes: ProfileChanges) => apiRequest<{ profile: Profile }>('/api/v1/profile/me', { method: 'PATCH', body: changes, ...auth }),

  updateSports: (sportIds: string[], primarySportId: string | null) =>
    apiRequest<{ profile: Profile }>('/api/v1/profile/me/sports', { method: 'PUT', body: { sportIds, primarySportId }, ...auth }),

  matches: (limit = 20, sport?: string) =>
    apiRequest<{ matches: MatchHistoryItem[]; counts: Record<string, number> }>(
      `/api/v1/profile/me/matches?limit=${limit}${sport ? `&sport=${encodeURIComponent(sport)}` : ''}`,
      auth,
    ),

  claimable: () => apiRequest<{ matches: ClaimableMatch[] }>('/api/v1/players/claimable', auth),

  claim: (playerIds: string[]) => apiRequest<{ claimed: number }>('/api/v1/players/claim', { method: 'POST', body: { playerIds }, ...auth }),
};

export const usersApi = {
  search: (q: string, limit = 15) => apiRequest<{ users: UserSummary[] }>(`/api/v1/users/search?q=${encodeURIComponent(q)}&limit=${limit}`, auth),
  get: (id: string) => apiRequest<{ user: PublicProfile }>(`/api/v1/users/${id}`, auth),
  matches: (id: string, limit = 10) => apiRequest<{ matches: MatchHistoryItem[] }>(`/api/v1/users/${id}/matches?limit=${limit}`, auth),
  follow: (id: string) => apiRequest<{ isFollowing: boolean; followers: number }>(`/api/v1/users/${id}/follow`, { method: 'PUT', ...auth }),
  unfollow: (id: string) => apiRequest<{ isFollowing: boolean; followers: number }>(`/api/v1/users/${id}/follow`, { method: 'DELETE', ...auth }),
  follows: (id: string, list: FollowList, options: { q?: string; cursor?: string | null } = {}) => {
    const params = new URLSearchParams();
    if (options.q) params.set('q', options.q);
    if (options.cursor) params.set('cursor', options.cursor);
    const query = params.toString();
    return apiRequest<FollowListPage>(`/api/v1/users/${id}/${list}${query ? `?${query}` : ''}`, auth);
  },
  /** Removes someone from my followers. */
  removeFollower: (id: string) =>
    apiRequest<{ removed: true; followers: number; following: number }>(`/api/v1/users/me/followers/${id}`, { method: 'DELETE', ...auth }),
};
