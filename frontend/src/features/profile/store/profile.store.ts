import { create } from 'zustand';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { profileApi } from '../api/profile.api';
import type { MatchHistoryItem, Profile, ProfileChanges, Sport } from '../types';

interface ProfileState {
  profile: Profile | null;
  /** Newest first. Home shows the first few, Profile shows them all. */
  matches: MatchHistoryItem[];
  /** All sports in the catalogue (`mst_sport`), for the sport picker. */
  catalogue: Sport[];

  /** Fetches the profile and match history. */
  load(): Promise<void>;
  loadCatalogue(): Promise<void>;
  saveDetails(changes: ProfileChanges): Promise<void>;
  saveSports(sportIds: string[], primarySportId: string | null): Promise<void>;
  /** Clears everything; called on sign-out so the next account never sees stale data. */
  reset(): void;
}

const MATCH_HISTORY_LIMIT = 20;

export const useProfileStore = create<ProfileState>()((set) => {
  /** Keeps the auth store's user (shown before the profile loads) in step with edits. */
  function applyProfile(profile: Profile) {
    set({ profile });
    useAuthStore.setState({ user: profile.user });
  }

  return {
    profile: null,
    matches: [],
    catalogue: [],

    async load() {
      const [{ profile }, { matches }] = await Promise.all([profileApi.me(), profileApi.matches(MATCH_HISTORY_LIMIT)]);
      applyProfile(profile);
      set({ matches });
    },

    async loadCatalogue() {
      const { sports } = await profileApi.sports();
      set({ catalogue: sports });
    },

    async saveDetails(changes) {
      const { profile } = await profileApi.update(changes);
      applyProfile(profile);
    },

    async saveSports(sportIds, primarySportId) {
      const { profile } = await profileApi.updateSports(sportIds, primarySportId);
      applyProfile(profile);
    },

    reset() {
      set({ profile: null, matches: [], catalogue: [] });
    },
  };
});
