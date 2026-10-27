import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useDebounced } from '@/shared/hooks/useCountdown';
import { errorMessage, useResource } from '@/shared/hooks/useResource';
import { useTheme } from '@/shared/theme';
import { Avatar, Button, EmptyState, Header, Notice, Row, SearchField, Segmented, Sheet, T, Tap, TextButton } from '@/shared/ui';
import { usersApi } from '../api/profile.api';
import type { FollowList, FollowListUser } from '../types';
import { FollowButton } from './SearchScreen';

function openProfile(u: FollowListUser, me: string | undefined) {
  if (u.id === me) router.navigate('/profile');
  else router.push({ pathname: '/user/[id]', params: { id: u.id } });
}

/**
 * Instagram-style followers / following for any profile. On my own followers I can remove someone
 * (with a confirm) or follow them back; everywhere else each row has Follow / Following.
 */
export default function FollowListScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string; tab?: string; username?: string; followers?: string; following?: string }>();
  const me = useAuthStore((s) => s.user?.id);
  const mine = params.id === me;
  const [tab, setTab] = useState<FollowList>(params.tab === 'following' ? 'following' : 'followers');
  const [q, setQ] = useState('');
  const query = useDebounced(q.trim(), 300);
  // Counts from the profile that opened this, adjusted as I follow, unfollow and remove here.
  const [counts, setCounts] = useState({ followers: Number(params.followers) || 0, following: Number(params.following) || 0 });
  const [follows, setFollows] = useState<Record<string, boolean>>({});
  const [removed, setRemoved] = useState<Record<string, true>>({});
  const [confirm, setConfirm] = useState<FollowListUser | null>(null);
  const [removing, setRemoving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [more, setMore] = useState<{ key: string; items: FollowListUser[]; cursor: string | null } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const key = `${tab}|${query}`;
  const { data, error, loading, refreshing, refresh } = useResource(async () => {
    const page = await usersApi.follows(params.id, tab, { q: query });
    return { key, page };
  }, [params.id, tab, query]);
  // Ignore a page that belongs to the previous tab or search while the new one loads.
  const current = data?.key === key ? data.page : null;
  const extra = more?.key === key ? more : null;
  const items = [...(current?.users ?? []), ...(extra?.items ?? [])]
    .filter((u) => !removed[u.id])
    .map((u) => (u.id in follows ? { ...u, isFollowing: follows[u.id]! } : u));
  const cursor = extra ? extra.cursor : (current?.nextCursor ?? null);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await usersApi.follows(params.id, tab, { q: query, cursor });
      setMore({ key, items: [...(extra?.items ?? []), ...page.users], cursor: page.nextCursor });
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setLoadingMore(false);
    }
  };

  const setFollow = (u: FollowListUser, isFollowing: boolean) => {
    if (u.isFollowing === isFollowing) return;
    setFollows((f) => ({ ...f, [u.id]: isFollowing }));
    if (mine) setCounts((c) => ({ ...c, following: Math.max(0, c.following + (isFollowing ? 1 : -1)) }));
  };

  const remove = async (u: FollowListUser) => {
    setRemoving(true);
    try {
      const r = await usersApi.removeFollower(u.id);
      setRemoved((m) => ({ ...m, [u.id]: true }));
      setCounts({ followers: r.followers, following: r.following });
      setConfirm(null);
      setActionError(null);
    } catch (e) {
      setActionError(errorMessage(e));
      setConfirm(null);
    } finally {
      setRemoving(false);
    }
  };

  const renderRow = ({ item: u }: { item: FollowListUser }) => {
    const isMe = u.id === me;
    const canRemove = mine && tab === 'followers';
    return (
      <Tap label={u.fullName} onPress={() => openProfile(u, me)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 20 }}>
        <Avatar name={u.fullName} id={u.id} photoUrl={u.photoUrl} size={48} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Row gap={6}>
            <T size={15} w={700} numberOfLines={1} style={{ flexShrink: 1 }}>
              {u.fullName}
            </T>
            {canRemove && !u.isFollowing ? <TextButton label="· Follow" size={14} weight={700} color={colors.primary} onPress={() => void usersApi.follow(u.id).then(() => setFollow(u, true), (e: unknown) => setActionError(errorMessage(e)))} /> : null}
          </Row>
          <T size={13} color={colors.muted} numberOfLines={1}>
            @{u.username}
            {isMe ? ' · You' : u.followsMe && !canRemove ? ' · Follows you' : ''}
          </T>
        </View>
        {isMe ? null : canRemove ? (
          <Button label="Remove" variant="surface" height={34} radius={10} size={14} weight={600} inline px={14} onPress={() => setConfirm(u)} />
        ) : (
          <FollowButton user={u} height={34} followLabel={u.followsMe ? 'Follow back' : 'Follow'} onChange={(isFollowing) => setFollow(u, isFollowing)} />
        )}
      </Tap>
    );
  };

  const emptyTitle = query ? 'No one found' : tab === 'followers' ? 'No followers yet' : mine ? 'You’re not following anyone' : 'Not following anyone yet';
  const emptyBody = query ? `Nobody here matches “${query}”.` : tab === 'followers' && mine ? 'When people follow you, they show up here.' : mine ? 'Find players to follow from Search.' : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + 10 }}>
      <View style={{ paddingHorizontal: 20, gap: 12, paddingBottom: 8 }}>
        <Header title={params.username ? `@${params.username}` : mine ? 'Your follows' : 'Follows'} />
        <Segmented
          options={[
            { value: 'followers', label: `${counts.followers} followers` },
            { value: 'following', label: `${counts.following} following` },
          ]}
          value={tab}
          onChange={(v) => {
            setTab(v);
            setActionError(null);
          }}
        />
        <Row>
          <SearchField value={q} onChangeText={setQ} placeholder="Search" height={44} />
        </Row>
        {error || actionError ? <Notice tone="error" icon="alert" text={(actionError ?? error)!} /> : null}
      </View>
      {loading || !current ? (
        <ActivityIndicator color={colors.muted} style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(u) => u.id}
          renderItem={renderRow}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<EmptyState title={emptyTitle} body={emptyBody} />}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.muted} style={{ marginVertical: 16 }} /> : undefined}
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setMore(null);
                setFollows({});
                setRemoved({});
                refresh();
              }}
              tintColor={colors.muted}
            />
          }
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 8) + 24 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Sheet visible={!!confirm} onClose={() => (removing ? undefined : setConfirm(null))}>
        {confirm ? (
          <View style={{ alignItems: 'center', gap: 10 }}>
            <Avatar name={confirm.fullName} id={confirm.id} photoUrl={confirm.photoUrl} size={72} />
            <T size={18} w={700} center>
              Remove follower?
            </T>
            <T size={14} lh={20} color={colors.muted} center>
              We won’t tell @{confirm.username} they were removed from your followers.
            </T>
            <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 6 }}>
              <Button label="Remove" variant="danger" weight={700} height={50} loading={removing} onPress={() => void remove(confirm)} />
              <Button label="Cancel" variant="surface" weight={600} height={50} disabled={removing} onPress={() => setConfirm(null)} />
            </View>
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}
