import Feather from '@expo/vector-icons/Feather';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { chatApi } from '@/features/chat/api/chat.api';
import { LiveMatchCard } from '@/features/match/components/LiveMatchCard';
import { useLiveMatches } from '@/features/match/hooks/useLiveMatches';
import { profileApi } from '@/features/profile/api/profile.api';
import { AppHeader, EmptyState, IconButton, Screen, TextLink } from '@/shared/components';
import { radius, spacing, typography, useTheme } from '@/shared/theme';
import { PostCard } from '../components/PostCard';
import { StreakCard } from '../components/StreakCard';
import { useFeed } from '../hooks/useFeed';
import { weekStreak } from '../streak';

/**
 * Home, laid out like Strava's: "Home" app bar, streak card, live matches (mine and of players I
 * follow), then activity cards from me and the people I follow, and a floating + for a new post.
 */
export default function FeedScreen() {
  const { colors } = useTheme();
  const feed = useFeed();
  const live = useLiveMatches();
  const refreshFeed = feed.refresh;
  const refreshLive = live.refresh;
  const [refreshing, setRefreshing] = useState(false);
  const [unread, setUnread] = useState(0);
  /** null until the match history has loaded (or when it failed): the card stays hidden. */
  const [streak, setStreak] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    const unreadCount = chatApi.unread().then(
      ({ count }) => setUnread(count),
      () => undefined,
    );
    const history = profileApi.matches(50).then(
      ({ matches }) => setStreak(weekStreak(matches.filter((m) => m.outcome !== 'in_progress').map((m) => m.playedAt))),
      () => undefined,
    );
    await Promise.all([refreshFeed(), refreshLive(), unreadCount, history]);
  }, [refreshFeed, refreshLive]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  async function pullToRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  const header = (
    <AppHeader
      title="Home"
      actions={<IconButton icon="message-square" label="Messages" badge={unread} onPress={() => router.push('/messages')} />}
    />
  );

  return (
    <View style={styles.flex}>
      <Screen edges={['top']} header={header} padded={false} onRefresh={() => void pullToRefresh()} refreshing={refreshing}>
        <View style={styles.sections}>
          {streak !== null ? <StreakCard weeks={streak} /> : null}

          {live.matches.length ? (
            <View style={[styles.live, { backgroundColor: colors.surface }]}>
              <Text style={[typography.sectionTitle, styles.liveTitle, { color: colors.text }]}>Live now</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
                {live.matches.map((match) => (
                  <LiveMatchCard key={match.id} match={match} compact />
                ))}
              </ScrollView>
            </View>
          ) : null}

          {feed.posts.length ? (
            <>
              {feed.posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
              {feed.nextCursor ? (
                <View style={styles.more}>
                  <TextLink title={feed.loadingMore ? 'Loading…' : 'Load more'} onPress={feed.loadMore} disabled={feed.loadingMore} />
                </View>
              ) : null}
            </>
          ) : !feed.loaded ? (
            <ActivityIndicator style={styles.loading} color={colors.primary} />
          ) : feed.error ? (
            <EmptyState
              tone="error"
              icon="alert-triangle"
              title="Something went wrong"
              message="We couldn’t load this right now. Check your connection and try again."
              action={{ label: 'Try again', onPress: () => void pullToRefresh() }}
            />
          ) : (
            <EmptyState
              icon="users"
              title="Your feed is quiet"
              message="Share a moment, or save a match: your posts and results, and those of players you follow, show up here."
              action={{ label: 'Write a post', icon: 'edit-3', onPress: () => router.push('/create-post') }}
            />
          )}
        </View>
      </Screen>

      <Pressable
        onPress={() => router.push('/create-post')}
        accessibilityRole="button"
        accessibilityLabel="New post"
        style={({ pressed }) => [styles.fab, { backgroundColor: pressed ? colors.primaryPressed : colors.primary }]}
      >
        <Feather name="plus" size={30} color={colors.onPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sections: { gap: spacing.sm, paddingTop: spacing.sm, paddingBottom: 72 },
  live: { paddingTop: spacing.lg },
  liveTitle: { paddingHorizontal: spacing.screen },
  strip: { gap: spacing.md, padding: spacing.screen },
  more: { alignItems: 'center', paddingVertical: spacing.lg },
  loading: { marginTop: spacing.xxl },
  fab: {
    position: 'absolute',
    right: spacing.screen,
    bottom: spacing.screen,
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
