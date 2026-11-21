import { router, useFocusEffect, useScrollToTop } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { matchApi } from '@/features/match/api/match.api';
import { notificationsApi } from '@/features/notifications/api/notifications.api';
import type { MatchCard, MatchView } from '@/features/match/types';
import { useResource } from '@/shared/hooks/useResource';
import { ALERT, useTheme } from '@/shared/theme';
import { Button, D, EmptyState, Icon, IconButton, Notice, T, Tap, TextButton } from '@/shared/ui';
import { firstName, plural } from '@/shared/utils/format';
import { profileApi } from '@/features/profile/api/profile.api';
import { tournamentsApi } from '@/features/tournaments/api/tournaments.api';
import { LiveNowCard, ResultRow, StartMatchHero, TournamentRow } from '../components/HomeBits';
import { PostCard } from '../components/PostCards';
import { greeting, nextFixtureFor, tournamentLine } from '../home';
import { useFeed } from '../hooks/useFeed';
import type { FeedPost } from '../types';

/** "Arjun says you lost 9-11 at pickleball" for the first result waiting on me. */
function confirmLine(match: MatchView, myId: string | undefined): string {
  const creator = match.sides.flatMap((s) => s.players).find((p) => p.userId === match.createdByUserId);
  const mine = match.sides.find((s) => s.players.some((p) => p.userId === myId));
  const outcome = mine?.outcome === 'won' ? 'won' : mine?.outcome === 'lost' ? 'lost' : 'played';
  const score = mine && mine.index === 1 ? match.score.headline.replace(/(\d+)-(\d+)/g, '$2-$1') : match.score.headline;
  return `${creator ? firstName(creator.displayName) : 'Someone'} says you ${outcome} ${score} at ${match.sport.name.toLowerCase()}`;
}

/** Home (design v2): greeting, start-a-match hero, a result to confirm, live now, my tournaments, recent results, then the feed. */
export default function HomeScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const me = useAuthStore((s) => s.user);
  const feed = useFeed();
  const [live, setLive] = useState<MatchCard[]>([]);
  const [pending, setPending] = useState<{ count: number; first: MatchView } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // Tapping Home while already on Home scrolls the feed back to the top.
  const listRef = useRef<FlatList<FeedPost>>(null);
  useScrollToTop(listRef);
  // The bell's badge: checked on focus and every 30 s while Home is on screen.
  const unread = useResource(() => notificationsApi.unread(), [], { poll: 30_000 });
  const unreadCount = unread.data?.count ?? 0;
  const catalogue = useResource(() => profileApi.sports(), []);
  const heroSports = (catalogue.data?.sports ?? []).map((sp) => ({ slug: sp.slug, name: sp.name }));
  const tournaments = useResource(() => Promise.all([tournamentsApi.list('mine'), tournamentsApi.myMatches()]), []);
  const myTournaments = (tournaments.data?.[0].tournaments ?? []).filter((t) => t.status !== 'completed' && t.status !== 'cancelled').slice(0, 3);
  const myFixtures = tournaments.data ? [...tournaments.data[1].playing, ...tournaments.data[1].upcoming] : [];
  const history = useResource(() => profileApi.matches(6), []);
  const recent = (history.data?.matches ?? []).filter((m) => m.outcome === 'won' || m.outcome === 'lost' || m.outcome === 'draw').slice(0, 3);

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
    await Promise.all([feed.refresh(), loadExtras(), unread.reload(), tournaments.reload(), history.reload()]);
    setRefreshing(false);
  };

  const section = (title: string, right?: React.ReactNode) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 20 }}>
      <D size={20} w={600} accessibilityRole="header">
        {title}
      </D>
      {right}
    </View>
  );

  const header = (
    <View style={{ gap: 18, paddingBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, gap: 12 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <T size={13} color={colors.muted}>
            {greeting()}
          </T>
          <D size={30} lh={30} numberOfLines={1}>
            {me?.fullName ?? 'ProjectX'}
          </D>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <IconButton icon="search" label="Search players" onPress={() => router.push('/search')} />
          <IconButton icon="chat" label="Chats" onPress={() => router.push('/chats')} />
          <IconButton
            icon="bell"
            label={unreadCount ? `Notifications, ${unreadCount} new` : 'Notifications'}
            onPress={() => router.push('/notifications')}
            badge={
              unreadCount ? (
                <View
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    minWidth: 18,
                    height: 18,
                    paddingHorizontal: 4,
                    borderRadius: 9,
                    borderWidth: 2,
                    borderColor: colors.card,
                    backgroundColor: ALERT,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <T size={10} w={800} color={colors.ink}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </T>
                </View>
              ) : undefined
            }
          />
        </View>
      </View>

      <View style={{ paddingHorizontal: 20 }}>
        <StartMatchHero sports={heroSports} />
      </View>

      {pending ? (
        <View style={{ paddingHorizontal: 20 }}>
          <Tap
            label="Confirm a result"
            onPress={() => router.push({ pathname: '/match/[id]/confirm', params: { id: pending.first.id } })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 18, backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.primary }}
          >
            <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="check" size={18} color={colors.onPrimary} strokeWidth={2.4} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <T size={14} w={700} color={colors.accentText}>
                {pending.count > 1 ? `Confirm ${pending.count} results` : 'Confirm a result'}
              </T>
              <T size={13} color={colors.fg} numberOfLines={2}>
                {confirmLine(pending.first, me?.id)}
              </T>
            </View>
            <Icon name="chevronRight" size={20} color={colors.accentText} />
          </Tap>
        </View>
      ) : null}

      {live.length ? (
        <View style={{ gap: 10 }}>
          {section(
            'Live now',
            <T size={13} color={colors.muted}>
              {plural(live.length, 'match', 'matches')}
            </T>,
          )}
          <View style={{ gap: 10, paddingHorizontal: 20 }}>
            {live.slice(0, 3).map((m) => (
              <LiveNowCard key={m.id} match={m} />
            ))}
          </View>
        </View>
      ) : null}

      {myTournaments.length ? (
        <View style={{ gap: 10 }}>
          {section('Your tournaments', <TextButton label="All events" onPress={() => router.push('/tournaments')} style={{ paddingVertical: 4 }} />)}
          <View style={{ gap: 10, paddingHorizontal: 20 }}>
            {myTournaments.map((t) => (
              <TournamentRow key={t.id} tournament={t} line={tournamentLine(t, nextFixtureFor(t, myFixtures))} />
            ))}
          </View>
        </View>
      ) : null}

      {recent.length ? (
        <View style={{ gap: 8 }}>
          {section('Recent results', <TextButton label="See all" onPress={() => router.push('/profile/matches')} style={{ paddingVertical: 4 }} />)}
          <View style={{ paddingHorizontal: 20 }}>
            {recent.map((m, i) => (
              <ResultRow key={m.matchId} match={m} last={i === recent.length - 1} />
            ))}
          </View>
        </View>
      ) : null}

      {section(
        'Feed',
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <IconButton icon="pen" label="New post" size={40} radius={20} onPress={() => router.push('/post/new')} />
        </View>,
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + 10 }}>
      <FlatList
        ref={listRef}
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
        ListFooterComponent={feed.loadingMore ? <ActivityIndicator color={colors.muted} style={{ marginVertical: 16 }} /> : undefined}
        onEndReached={() => void feed.loadMore()}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void pull()} tintColor={colors.muted} />}
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
