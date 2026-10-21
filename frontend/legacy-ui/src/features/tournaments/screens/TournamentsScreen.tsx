import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { IconName } from '@/features/match/format';
import { Card, EmptyState, FormMessage, PrimaryButton, Screen, SectionHeader, TextField, TopBar } from '@/shared/components';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { spacing, typography, useTheme } from '@/shared/theme';
import { tournamentsApi } from '../api/tournaments.api';
import { FixtureCard } from '../components/FixtureCard';
import { statusText, type FixtureView, type TournamentListItem } from '../types';

/** Tournaments I run or help with, open public ones, matches I can score now, and "create". */
export default function TournamentsScreen() {
  const { colors } = useTheme();
  const [tournaments, setTournaments] = useState<TournamentListItem[]>([]);
  const [fixtures, setFixtures] = useState<FixtureView[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [venue, setVenue] = useState('');
  const [startsOn, setStartsOn] = useState('');
  const load = useSubmit();
  const submitLoad = load.submit;
  const create = useSubmit();

  const refresh = useCallback(() => {
    void submitLoad(async () => {
      const [list, mine] = await Promise.all([tournamentsApi.list(), tournamentsApi.myFixtures()]);
      setTournaments(list.tournaments);
      setFixtures(mine.fixtures);
    });
  }, [submitLoad]);
  useFocusEffect(refresh);

  async function createTournament() {
    let id: string | null = null;
    const ok = await create.submit(async () => {
      const { tournament } = await tournamentsApi.create({
        name: name.trim(),
        ...(venue.trim() ? { venueName: venue.trim() } : {}),
        ...(/^\d{4}-\d{2}-\d{2}$/.test(startsOn.trim()) ? { startsOn: startsOn.trim() } : {}),
      });
      id = tournament.id;
    });
    if (ok && id) {
      setCreating(false);
      setName('');
      setVenue('');
      setStartsOn('');
      router.push({ pathname: '/tournaments/[id]', params: { id } });
    }
  }

  return (
    <Screen header={<TopBar title="Tournaments" />} onRefresh={refresh} refreshing={load.submitting}>
      <View style={styles.top} />
      <FormMessage message={load.formError} />

      {fixtures.length ? (
        <View style={styles.section}>
          <SectionHeader title="Ready for you to score" />
          <View style={styles.list}>
            {fixtures.map((f) => (
              <FixtureCard
                key={f.id}
                fixture={f}
                onPress={() =>
                  f.match ? router.push({ pathname: '/match/[id]', params: { id: f.match.id } }) : router.push({ pathname: '/tournaments/fixture/[id]', params: { id: f.id } })
                }
              />
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        {creating ? (
          <Card style={styles.form}>
            <TextField icon="award" placeholder="Tournament name" value={name} onChangeText={setName} maxLength={120} autoFocus error={create.serverFieldErrors.name} />
            <TextField icon="map-pin" placeholder="Venue (optional)" value={venue} onChangeText={setVenue} maxLength={120} />
            <TextField icon="calendar" placeholder="Start date YYYY-MM-DD (optional)" value={startsOn} onChangeText={setStartsOn} autoCorrect={false} />
            <FormMessage message={create.formError} />
            <PrimaryButton title="Create tournament" onPress={() => void createTournament()} loading={create.submitting} disabled={name.trim().length < 3} />
          </Card>
        ) : (
          <PrimaryButton title="New tournament" onPress={() => setCreating(true)} />
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Tournaments" />
        {tournaments.length ? (
          <View style={styles.list}>
            {tournaments.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => router.push({ pathname: '/tournaments/[id]', params: { id: t.id } })}
                accessibilityRole="button"
                style={({ pressed }) => [styles.item, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder, opacity: pressed ? 0.85 : 1 }]}
              >
                <View style={styles.icons}>
                  {t.sports.slice(0, 3).map((s) => (
                    <MaterialCommunityIcons key={s.slug} name={s.iconKey as IconName} size={18} color={colors.primary} />
                  ))}
                </View>
                <View style={styles.flex}>
                  <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>
                    {t.name}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
                    {[statusText(t.status), t.startsOn, t.venue?.name, t.isOrganizer ? 'Organizer' : null].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <Card>
            <EmptyState icon="award" title="No tournaments yet" message="Create one for your club, office or venue: categories, draws, fixtures and live scores." />
          </Card>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { paddingTop: spacing.lg },
  section: { marginBottom: spacing.xl },
  list: { gap: spacing.md },
  form: { gap: spacing.md },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderRadius: 16, padding: spacing.lg },
  icons: { flexDirection: 'row', gap: 2, minWidth: 40 },
  itemTitle: { fontSize: 16, fontWeight: '700' },
  flex: { flex: 1 },
});
