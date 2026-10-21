import { useAuthStore } from '@/features/auth/store/auth.store';
import { profileApi } from '../api/profile.api';
import { useProfileStore } from '../store/profile.store';
import type { Profile } from '../types';

jest.mock('@/features/auth/social/google', () => ({ getGoogleIdToken: jest.fn(), signOutOfGoogle: jest.fn() }));
jest.mock('@/features/auth/social/apple', () => ({ getAppleCredential: jest.fn(), isAppleSignInAvailable: jest.fn() }));
jest.mock('../api/profile.api');
const api = jest.mocked(profileApi);

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    user: {
      id: 'u1',
      username: 'athlete',
      fullName: 'Test Athlete',
      email: 'athlete@example.com',
      phone: '+919876543210',
      emailVerified: false,
      phoneVerified: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    bio: null,
    sports: [],
    record: { played: 0, won: 0, lost: 0 },
    followers: 0,
    following: 0,
    ...overrides,
  };
}

beforeEach(() => {
  jest.resetAllMocks();
  useProfileStore.getState().reset();
});

describe('profile store', () => {
  it('loads the profile and match history together', async () => {
    api.me.mockResolvedValue({ profile: profile() });
    api.matches.mockResolvedValue({
      matches: [
        {
          matchId: 'm1',
          context: 'friendly',
          sport: { id: '1', slug: 'pickleball', name: 'Pickleball', iconKey: 'racquetball', accentColor: '#F97316' },
          playedAt: '2026-01-02T00:00:00.000Z',
          outcome: 'won',
          resultType: 'played',
          otherPlayers: ['Rival'],
          headline: '11-7',
          ratingChange: 12,
        },
      ],
    });

    await useProfileStore.getState().load();

    expect(useProfileStore.getState().profile?.user.username).toBe('athlete');
    expect(useProfileStore.getState().matches).toHaveLength(1);
  });

  it('keeps the signed-in user in step when the name changes', async () => {
    const renamed = profile({ user: { ...profile().user, fullName: 'New Name' } });
    api.update.mockResolvedValue({ profile: renamed });

    await useProfileStore.getState().saveDetails({ fullName: 'New Name' });

    expect(api.update).toHaveBeenCalledWith({ fullName: 'New Name' });
    expect(useProfileStore.getState().profile?.user.fullName).toBe('New Name');
    expect(useAuthStore.getState().user?.fullName).toBe('New Name');
  });

  it('saves sports with the primary one', async () => {
    api.updateSports.mockResolvedValue({ profile: profile() });
    await useProfileStore.getState().saveSports(['1', '2'], '2');
    expect(api.updateSports).toHaveBeenCalledWith(['1', '2'], '2');
  });

  it('reset clears everything', async () => {
    api.me.mockResolvedValue({ profile: profile() });
    api.matches.mockResolvedValue({ matches: [] });
    await useProfileStore.getState().load();
    useProfileStore.getState().reset();
    expect(useProfileStore.getState()).toMatchObject({ profile: null, matches: [], catalogue: [] });
  });
});
