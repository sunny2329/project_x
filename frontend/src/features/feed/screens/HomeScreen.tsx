import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { LiveMatchCard } from '@/features/match/components/MatchCards';
import { matchApi } from '@/features/match/api/match.api';
import type { MatchCard, MatchView } from '@/features/match/types';
import { LIVE, useTheme } from '@/shared/theme';
import { Button, EmptyState, Icon, IconButton, Notice, T, Tap, Wordmark } from '@/shared/ui';
import { firstName, plural } from '@/shared/utils/format';
import { PostCard } from '../components/PostCards';
import { useFeed } from '../hooks/useFeed';

/** "Arjun says you lost 9-11 at pickleball" for the first result waiting on me. */
function confirmLine(match: MatchView, myId: string | undefined): string {
  const creator = match.sides.flatMap((s) => s.players).find((p) => p.userId === match.createdByUserId);
  const mine = match.sides.find((s) => s.players.some((p) => p.userId === myId));
  const outcome = mine?.outcome === 'won' ? 'won' : mine?.outcome === 'lost' ? 'lost' : 'played';
  const score = mine && mine.index === 1 ? match.score.headline.replace(/(\d+)-(\d+)/g, '$2-$1') : match.score.headline;
  return `${creator ? firstName(creator.displayName) : 'Someone'} says you ${outcome} ${score} at ${match.sport.name.toLowerCase()}`;
}

/** Home: live-now strip, a result to confirm, then the feed (results and posts of people I follow). */
export default function HomeScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const me = useAuthStore((s) => s.user);
  const feed = useFeed();
  const [live, setLive] = useState<MatchCard[]>([]);
  const [pending, setPending] = useState<{ count: number; first: MatchView } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadExtras = useCallback(async () => {
    const [liveRes, pendingRes] = await Promise.allSettled([matchApi.live(), matchApi.pendingConfirmations()]);
    if (liveRes.status === 'fulfilled') setLive(liveRes.value.matches);
    if (pendingRes.status === 'fulfilled') {
      const first = pendingRes.value.matches[0];
      if (!first) setPending(null);
      else {
        const detail = await matchApi.get(first.id).catch(() => null);
        setPending(detail ? { count: pendingRes.value.matches.length, first: detail.match } : null);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void feed.refresh();
      void loadExtras();
      // Live scores move; refresh the strip while Home is on screen.
      const timer = setInterval(() => void matchApi.live().then((r) => setLive(r.matches), () => undefined), 15_000);
      return () => clearInterval(timer);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadExtras]),
  );

  const pull = async () => {
    setRefreshing(true);
    await Promise.all([feed.refresh(), loadExtras()]);
    setRefreshing(false);
  };

  const header = (
    <View style={{ gap: 18, paddingBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 }}>
        <Wordmark size={28} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <IconButton icon="search" label="Search" onPress={() => router.push('/search')} />
          <IconButton icon="pen" label="New post" onPress={() => router.push('/post/new')} />
        </View>
      </View>

      {live.length ? (
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: 'rgba(255,84,104,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: LIVE }} />
              </View>
              <T size={13} w={700} ls={0.08} upper>
                Live now
              </T>
            </View>
            <T size={13} color={colors.muted}>
              {plural(live.length, 'match', 'matches')}
            </T>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 20 }}>
            {live.map((m) => (
              <LiveMatchCard key={m.id} match={m} />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {pending ? (
        <View style={{ paddingHorizontal: 20 }}>
          <Tap
            label="Confirm a result"
            onPress={() => router.push({ pathname: '/match/[id]/confirm', params: { id: pending.first.id } })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16, backgroundColor: colors.primary }}
          >
            <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="check" size={18} color={colors.fg} strokeWidth={2.4} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <T size={14} w={700} color={colors.onPrimary}>
                {pending.count > 1 ? `Confirm ${pending.count} results` : 'Confirm a result'}
              </T>
              <T size={13} color={colors.onBrightMuted} numberOfLines={2}>
                {confirmLine(pending.first, me?.id)}
              </T>
            </View>
            <Icon name="chevronRight" size={20} color={colors.onPrimary} />
          </Tap>
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + 10 }}>
      <FlatList
        data={feed.posts}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
            <PostCard post={item} />
          </View>
        )}
        ListEmptyComponent={
          !feed.loaded ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
          ) : feed.error ? (
            <View style={{ paddingHorizontal: 20 }}>
              <Notice tone="error" icon="alert" text={feed.error} />
            </View>
          ) : (
            <EmptyState
              title="Nothing here yet"
              body="Score a match or follow players to fill your feed."
              action={<Button label="Find players" variant="outline" inline height={44} onPress={() => router.push('/search')} style={{ marginTop: 8 }} />}
            />
          )
        }
        ListFooterComponent={feed.loadingMore ? <ActivityIndicator color={colors.muted} style={{ marginVertical: 16 }} /> : null}
        onEndReached={() => void feed.loadMore()}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void pull()} tintColor={colors.muted} />}
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
