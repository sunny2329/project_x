import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { errorMessage, useResource } from '@/shared/hooks/useResource';
import { LIVE, useTheme } from '@/shared/theme';
import { Avatar, EmptyState, Header, Icon, type IconName, Loading, Notice, T, Tap } from '@/shared/ui';
import { formatRelativeTime } from '@/shared/utils/time';
import { notificationsApi } from '../api/notifications.api';
import type { AppNotification } from '../types';

const KIND_ICON: Record<AppNotification['type'], IconName> = { like: 'heart', comment: 'chat', post: 'pen', follow: 'personAdd' };

function open(n: AppNotification) {
  if (n.postId) router.push({ pathname: '/post/[id]', params: { id: n.postId } });
  else router.push({ pathname: '/user/[id]', params: { id: n.actor.id } });
}

function NotificationRow({ n }: { n: AppNotification }) {
  const { colors } = useTheme();
  return (
    <Tap
      label={n.title}
      onPress={() => open(n)}
      style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, paddingHorizontal: 20, backgroundColor: n.isRead ? undefined : colors.surface }}
    >
      <View>
        <Avatar name={n.actor.fullName} id={n.actor.id} photoUrl={n.actor.photoUrl} size={44} />
        <View
          style={{
            position: 'absolute',
            right: -4,
            bottom: -4,
            width: 22,
            height: 22,
            borderRadius: 11,
            borderWidth: 2,
            borderColor: n.isRead ? colors.bg : colors.surface,
            backgroundColor: n.type === 'like' ? LIVE : colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={KIND_ICON[n.type]} size={11} color={n.type === 'like' ? colors.ink : colors.onPrimary} strokeWidth={2.6} />
        </View>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <T size={14} w={n.isRead ? 400 : 700} numberOfLines={2}>
          {n.title}
        </T>
        {n.message ? (
          <T size={14} color={colors.muted} numberOfLines={2}>
            {n.message}
          </T>
        ) : null}
        <T size={12} color={colors.muted}>
          {formatRelativeTime(n.createdAt)}
        </T>
      </View>
      {n.isRead ? null : <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: LIVE, marginTop: 6 }} />}
    </Tap>
  );
}

/**
 * The bell on Home: likes and comments on my posts, new posts from people I follow, new followers.
 * Opening it clears the badge; rows that were unread stay highlighted until the next visit.
 */
export default function NotificationsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [more, setMore] = useState<{ items: AppNotification[]; cursor: string | null } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const { data, error, loading, refreshing, refresh } = useResource(async () => {
    const page = await notificationsApi.list();
    if (page.unreadCount) void notificationsApi.readAll().catch(() => undefined);
    setMore(null);
    return page;
  }, []);

  const items = [...(data?.notifications ?? []), ...(more?.items ?? [])];
  const cursor = more ? more.cursor : (data?.nextCursor ?? null);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await notificationsApi.list(cursor);
      setMore((prev) => ({ items: [...(prev?.items ?? []), ...page.notifications], cursor: page.nextCursor }));
      setMoreError(null);
    } catch (e) {
      setMoreError(errorMessage(e));
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + 10 }}>
      <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
        <Header title="Notifications" />
      </View>
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        renderItem={({ item }) => <NotificationRow n={item} />}
        ListHeaderComponent={
          error ? (
            <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
              <Notice tone="error" icon="alert" text={error} />
            </View>
          ) : undefined
        }
        ListEmptyComponent={error ? undefined : <EmptyState title="No notifications yet" body="Likes, comments, new followers and posts from people you follow show up here." />}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator color={colors.muted} style={{ marginVertical: 16 }} />
          ) : moreError ? (
            <View style={{ paddingHorizontal: 20, paddingVertical: 8 }}>
              <Notice tone="error" icon="alert" text={moreError} />
            </View>
          ) : undefined
        }
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.muted} />}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 8) + 24 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
