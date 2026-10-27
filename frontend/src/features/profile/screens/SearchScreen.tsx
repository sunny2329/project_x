import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { tournamentsApi } from '@/features/tournaments/api/tournaments.api';
import type { TournamentListItem } from '@/features/tournaments/types';
import { tournamentStatusLabel } from '@/features/tournaments/status';
import { useDebounced } from '@/shared/hooks/useCountdown';
import { useSearch } from '@/shared/hooks/useSearch';
import { useTheme } from '@/shared/theme';
import { Avatar, Button, Chip, Dot, EmptyState, Icon, IconButton, Label, Row, Screen, SearchField, T, Tap } from '@/shared/ui';
import { dateRange } from '@/shared/utils/format';
import { usersApi } from '../api/profile.api';
import type { UserSummary } from '../types';

type Tab = 'players' | 'tournaments';

/** Follow / Following with an instant switch, rolled back if the request fails. */
export function FollowButton({
  user,
  onChange,
  height = 36,
  followLabel = 'Follow',
}: {
  user: Pick<UserSummary, 'id' | 'isFollowing'>;
  onChange: (isFollowing: boolean, followers?: number) => void;
  height?: number;
  /** "Follow back" when they already follow me. */
  followLabel?: string;
}) {
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    const next = !user.isFollowing;
    onChange(next);
    try {
      const r = await (next ? usersApi.follow(user.id) : usersApi.unfollow(user.id));
      onChange(r.isFollowing, r.followers);
    } catch {
      onChange(!next);
    } finally {
      setBusy(false);
    }
  };
  return user.isFollowing ? (
    <Button label="Following" variant="outline" height={height} radius={12} size={14} weight={600} inline onPress={() => void toggle()} />
  ) : (
    <Button label={followLabel} height={height} radius={12} size={14} weight={700} inline onPress={() => void toggle()} />
  );
}

function TournamentRow({ t }: { t: TournamentListItem }) {
  const { colors } = useTheme();
  const meta = [dateRange(t.startsOn, t.endsOn), t.venue?.name, tournamentStatusLabel(t.status)].filter(Boolean).join(' · ');
  return (
    <Tap
      label={t.name}
      onPress={() => router.push({ pathname: '/tournament/[id]', params: { id: t.id } })}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, backgroundColor: colors.surface }}
    >
      <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.raised, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="trophy" size={22} color={colors.primary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T size={15} w={700} numberOfLines={1}>
          {t.name}
        </T>
        <T size={13} color={colors.muted} numberOfLines={1}>
          {meta}
        </T>
      </View>
      <Icon name="chevronRight" size={20} color={colors.muted} />
    </Tap>
  );
}

/** Find players (follow, open their profile) and tournaments. */
export default function SearchScreen() {
  const { colors } = useTheme();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<Tab>('players');
  const query = useDebounced(q.trim(), 300);
  const people = useSearch<UserSummary>(query, (text) => usersApi.search(text).then((r) => r.users));
  const events = useSearch<TournamentListItem>(query, (text) => tournamentsApi.list('all', text).then((r) => r.tournaments));
  // Follow taps change the list in place until the next search.
  const [follows, setFollows] = useState<Record<string, boolean>>({});
  const users = people.results.map((u) => (u.id in follows ? { ...u, isFollowing: follows[u.id]! } : u));
  const tournaments = events.results;
  const loading = people.loading || events.loading;

  const setFollow = (id: string, isFollowing: boolean) => setFollows((f) => ({ ...f, [id]: isFollowing }));

  return (
    <Screen gap={18} bottom={20}>
      <Row gap={10}>
        <IconButton icon="back" label="Back" onPress={() => router.back()} />
        <SearchField value={q} onChangeText={setQ} placeholder="Search players and tournaments" autoFocus />
      </Row>

      <Row gap={8}>
        <Chip label="Players" active={tab === 'players'} onPress={() => setTab('players')} />
        <Chip label="Tournaments" active={tab === 'tournaments'} onPress={() => setTab('tournaments')} />
      </Row>

      {loading && !users.length && !tournaments.length ? <ActivityIndicator color={colors.primary} /> : null}

      {tab === 'players' ? (
        <View>
          {users.map((u) => (
            <View key={u.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.raised }}>
              <Tap label={u.fullName} onPress={() => router.push({ pathname: '/user/[id]', params: { id: u.id } })} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Avatar name={u.fullName} id={u.id} photoUrl={u.photoUrl} size={48} />
                <View style={{ flex: 1, gap: 3 }}>
                  <T size={15} w={700} numberOfLines={1}>
                    {u.fullName}
                  </T>
                  <Row gap={6} style={{ flexWrap: 'wrap' }}>
                    <T size={13} color={colors.muted}>
                      @{u.username}
                      {u.ratings.length ? ' ·' : ''}
                    </T>
                    {u.ratings.slice(0, 3).map((r) => (
                      <Row key={r.sportId} gap={6}>
                        <Dot color={r.accentColor} size={7} />
                        <T size={13} color={colors.muted}>
                          {Math.round(r.rating)}
                        </T>
                      </Row>
                    ))}
                  </Row>
                </View>
              </Tap>
              <FollowButton user={u} onChange={(v) => setFollow(u.id, v)} />
            </View>
          ))}
          {query.length >= 2 && !loading && !users.length ? <EmptyState title="No players found" body={`Nobody matches “${query}”.`} /> : null}
        </View>
      ) : null}

      {tournaments.length && (tab === 'tournaments' || users.length) ? (
        <View style={{ gap: 10 }}>
          {tab === 'players' ? <Label>Tournaments matching “{query}”</Label> : null}
          {(tab === 'players' ? tournaments.slice(0, 3) : tournaments).map((t) => (
            <TournamentRow key={t.id} t={t} />
          ))}
        </View>
      ) : tab === 'tournaments' && query.length >= 2 && !loading ? (
        <EmptyState title="No tournaments found" body={`Nothing matches “${query}”.`} />
      ) : null}

      {query.length < 2 ? (
        <T size={14} color={colors.muted} center style={{ marginTop: 24 }}>
          Type at least two letters of a name or @username.
        </T>
      ) : null}
    </Screen>
  );
}
