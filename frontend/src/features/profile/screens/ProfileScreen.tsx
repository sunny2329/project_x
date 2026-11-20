import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Share, View } from 'react-native';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { TeamRow } from '@/features/teams/components/TeamBits';
import { teamsApi } from '@/features/teams/api/teams.api';
import { errorMessage, useResource } from '@/shared/hooks/useResource';
import { useTheme } from '@/shared/theme';
import { Button, EmptyState, Loading, Notice, Screen, T, TextButton } from '@/shared/ui';
import { profileApi } from '../api/profile.api';
import { MatchHistoryRow } from '../components/ProfileBits';
import { ProfileHero, SectionTitle, SportInsightsBlock } from '../components/ProfileV2';
import { useProfileStore } from '../store/profile.store';

/** My profile tab (design v2): hero, ratings by sport, rating & performance, then teams and recent matches. */
export default function ProfileScreen() {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const profile = useProfileStore((s) => s.profile);
  const matches = useProfileStore((s) => s.matches);
  const [slug, setSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const teams = useResource(() => teamsApi.list(), []);

  const sports = profile ? [...profile.sports].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || b.matchesPlayed - a.matchesPlayed) : [];
  const picked = sports.find((s) => s.slug === slug) ?? sports[0] ?? null;
  const insights = useResource(() => profileApi.insights(picked!.slug), [picked?.slug], { enabled: !!picked });

  const load = useCallback(async () => {
    try {
      await useProfileStore.getState().load();
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!profile) {
    return error ? (
      <Screen>
        <Notice tone="error" icon="alert" text={error} />
      </Screen>
    ) : (
      <Loading />
    );
  }

  const username = user?.username ?? profile.user.username;
  const follows = (tab: 'followers' | 'following') =>
    router.push({ pathname: '/follows/[id]', params: { id: profile.user.id, tab, username, followers: String(profile.followers), following: String(profile.following) } });

  return (
    <Screen
      edgeToEdge
      px={0}
      gap={0}
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await Promise.all([load(), teams.reload(), insights.reload()]);
        setRefreshing(false);
      }}
    >
      <ProfileHero
        title="Profile"
        actions={[
          { icon: 'upload', label: 'Share profile card', onPress: () => void Share.share({ message: `${profile.user.fullName} (@${username}) on ProjectX` }) },
          { icon: 'gear', label: 'Settings', onPress: () => router.push('/settings') },
        ]}
        user={{ id: profile.user.id, fullName: profile.user.fullName, username, photoUrl: profile.photoUrl, city: profile.city, handedness: profile.handedness }}
        followers={profile.followers}
        following={profile.following}
        onFollowers={() => follows('followers')}
        onFollowing={() => follows('following')}
        record={profile.record}
        streak={profile.streak}
        titles={profile.titles}
      />

      <View style={{ paddingHorizontal: 20, paddingTop: 20, gap: 22 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {profile.bio ? (
            <T size={14} color={colors.soft} flex>
              {profile.bio}
            </T>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          <TextButton label="Edit profile" onPress={() => router.push('/profile/edit')} style={{ paddingVertical: 8 }} />
        </View>

        {sports.length ? (
          <SportInsightsBlock
            sports={sports}
            picked={picked}
            onPick={setSlug}
            insights={insights.data?.insights ?? null}
            loading={insights.loading}
            error={insights.error}
            isMe
          />
        ) : (
          <EmptyState title="No sports yet" body="Pick what you play to get a rating for each sport." action={<Button label="Pick sports" inline height={44} onPress={() => router.push('/profile/edit')} />} />
        )}

        <View style={{ gap: 8 }}>
          <SectionTitle title="Teams" right={<TextButton label={teams.data?.teams.length ? 'See all' : 'New team'} onPress={() => router.push(teams.data?.teams.length ? '/teams' : '/teams/new')} style={{ paddingVertical: 8 }} />} />
          {teams.data?.teams.length ? (
            teams.data.teams.slice(0, 3).map((t) => <TeamRow key={t.id} team={t} />)
          ) : teams.data ? (
            <T size={14} color={colors.muted}>
              No teams yet. Save your partner or squad to pick them fast when you start a match.
            </T>
          ) : null}
        </View>

        <View style={{ gap: 8 }}>
          <SectionTitle title="Recent matches" right={<TextButton label="See all" onPress={() => router.push('/profile/matches')} style={{ paddingVertical: 8 }} />} />
          {matches.length ? (
            matches.slice(0, 4).map((m) => <MatchHistoryRow key={m.matchId} match={m} />)
          ) : (
            <T size={14} color={colors.muted}>
              No matches yet. Tap Play to score one.
            </T>
          )}
        </View>
      </View>
    </Screen>
  );
}
