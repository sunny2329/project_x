import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { errorMessage } from '@/shared/hooks/useResource';
import { sportText, useTheme } from '@/shared/theme';
import { Avatar, Button, Chip, D, EmptyState, IconButton, Label, Loading, Notice, Row, Screen, Sparkline, T, Tap, TextButton } from '@/shared/ui';
import { shortDay } from '@/shared/utils/format';
import { FormTile } from '../components/ProfileBits';
import { useProfileStore } from '../store/profile.store';
import type { MatchHistoryItem } from '../types';

/** "with Kabir vs Arjun & Meera" / "vs Arjun T". */
function versusLine(m: MatchHistoryItem): string {
  const vs = m.opponents.length ? `vs ${m.opponents.join(' & ')}` : '';
  return [m.partners.length ? `with ${m.partners.join(' & ')}` : '', vs].filter(Boolean).join(' ') || m.sport.name;
}

/** My profile tab: ratings per sport with the trend, record, recent matches. */
export default function ProfileScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const user = useAuthStore((s) => s.user);
  const profile = useProfileStore((s) => s.profile);
  const matches = useProfileStore((s) => s.matches);
  const [sportId, setSportId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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

  const sports = [...profile.sports].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || b.matchesPlayed - a.matchesPlayed);
  const sport = sports.find((s) => s.id === sportId) ?? sports[0] ?? null;
  const trend = sport ? (profile.ratingTrends.find((t) => t.sportId === sport.id)?.points ?? []) : [];
  const since = sport ? Math.round(sport.rating - 1000) : 0;
  const recent = matches.filter((m) => !sport || m.sport.id === sport.id).slice(0, 4);
  const winRate = sport && sport.matchesPlayed ? Math.round((sport.matchesWon / sport.matchesPlayed) * 100) : 0;

  return (
    <Screen
      gap={16}
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
    >
      <Row gap={8} style={{ justifyContent: 'flex-end' }}>
        <Button label="Edit profile" variant="surface" height={40} radius={12} size={14} inline px={14} onPress={() => router.push('/profile/edit')} />
        <IconButton icon="sliders" label="Settings" size={40} radius={12} onPress={() => router.push('/settings')} />
      </Row>

      <Row gap={16}>
        <Avatar name={profile.user.fullName} id={profile.user.id} photoUrl={profile.photoUrl} size={76} display ring={sport?.accentColor ?? colors.primary} />
        <View style={{ flex: 1, gap: 2 }}>
          <D size={34} lh={34} upper numberOfLines={2}>
            {profile.user.fullName}
          </D>
          <T size={14} color={colors.muted}>
            @{user?.username ?? profile.user.username}
            {profile.city ? ` · ${profile.city}` : ''}
          </T>
          <T size={14} color={colors.soft}>
            <T size={14} w={700}>
              {profile.followers}
            </T>{' '}
            followers ·{' '}
            <T size={14} w={700}>
              {profile.following}
            </T>{' '}
            following
          </T>
        </View>
      </Row>
      {profile.bio ? (
        <T size={14} color={colors.soft}>
          {profile.bio}
        </T>
      ) : null}

      {sports.length ? (
        <>
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            {sports.map((s) => (
              <Chip key={s.id} label={s.name} dot={s.accentColor} active={s.id === sport?.id} activeColor={s.accentColor} onPress={() => setSportId(s.id)} />
            ))}
          </Row>

          {sport ? (
            <View style={{ padding: 16, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, gap: 10 }}>
              <View>
                <Label>Rating</Label>
                <Row gap={8} style={{ alignItems: 'baseline' }}>
                  <D size={52} lh={50}>
                    {Math.round(sport.rating)}
                  </D>
                  {sport.ratedMatches ? (
                    <T size={14} w={800} color={since >= 0 ? colors.good : colors.bad}>
                      {since >= 0 ? `+${since}` : since} since joining
                    </T>
                  ) : (
                    <T size={14} color={colors.muted}>
                      Starting rating
                    </T>
                  )}
                </Row>
              </View>
              {trend.length >= 2 ? <Sparkline points={trend} width={width - 72} height={70} color={sportText(colors, sport.slug)} /> : null}
              <View style={{ flexDirection: 'row', gap: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: colors.raised }}>
                {[
                  [sport.matchesPlayed, 'Played'],
                  [sport.matchesWon, 'Won'],
                  [sport.matchesLost, 'Lost'],
                  [`${winRate}%`, 'Win rate'],
                ].map(([v, l]) => (
                  <View key={l} style={{ flex: 1 }}>
                    <D size={26}>{v}</D>
                    <T size={12} color={colors.muted}>
                      {l}
                    </T>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </>
      ) : (
        <EmptyState title="No sports yet" body="Pick what you play to get a rating for each sport." action={<Button label="Pick sports" inline height={44} onPress={() => router.push('/profile/edit')} />} />
      )}

      <Row between>
        <Label>Recent matches</Label>
        <TextButton label="See all" onPress={() => router.push('/profile/matches')} style={{ paddingVertical: 8 }} />
      </Row>
      {recent.length ? (
        recent.map((m) => <RecentRow key={m.matchId} m={m} />)
      ) : (
        <T size={14} color={colors.muted}>
          No matches yet. Tap + to score one.
        </T>
      )}
    </Screen>
  );
}

function RecentRow({ m }: { m: MatchHistoryItem }) {
  const { colors } = useTheme();
  return (
    <Tap
      label={versusLine(m)}
      onPress={() => router.push({ pathname: '/match/[id]/result', params: { id: m.matchId } })}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: colors.surface }}
    >
      {m.outcome === 'won' || m.outcome === 'lost' ? <FormTile result={m.outcome === 'won' ? 'W' : 'L'} size={32} /> : <View style={{ width: 32 }} />}
      <View style={{ flex: 1 }}>
        <T size={14} w={600} numberOfLines={1}>
          {versusLine(m)}
        </T>
        <T size={12} color={colors.muted}>
          {shortDay(m.playedAt)}
          {m.format ? ` · ${m.format}` : ''}
        </T>
      </View>
      {m.headline ? (
        <D size={17} w={800}>
          {m.headline.replace(/,\s*/g, ' ')}
        </D>
      ) : null}
    </Tap>
  );
}
