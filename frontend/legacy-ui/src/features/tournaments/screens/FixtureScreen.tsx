import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { parseScores } from '@/features/match/format';
import type { MatchView } from '@/features/match/types';
import { Card, ChoiceChips, FormMessage, OutlineButton, PrimaryButton, Screen, SectionHeader, TextField, TopBar } from '@/shared/components';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { spacing, typography, useTheme } from '@/shared/theme';
import { tournamentsApi } from '../api/tournaments.api';
import { FixtureCard } from '../components/FixtureCard';
import type { FixtureView, Tournament } from '../types';

/** Match day for one fixture (staff): court and time, start live scoring, walkover, or enter the result. */
export default function FixtureScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const [fixture, setFixture] = useState<FixtureView | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [scoreText, setScoreText] = useState('');
  const [time, setTime] = useState('');
  const load = useSubmit();
  const submitLoad = load.submit;
  const action = useSubmit();

  const refresh = useCallback(() => {
    void submitLoad(async () => {
      const { fixture: next } = await tournamentsApi.fixture(id);
      setFixture(next);
      const { event } = await tournamentsApi.event(next.eventId);
      setTournament((await tournamentsApi.get(event.tournament.id)).tournament);
    });
  }, [submitLoad, id]);
  useFocusEffect(refresh);

  if (!fixture) {
    return (
      <Screen header={<TopBar title="Fixture" />}>
        <View style={styles.top}>
          <FormMessage message={load.formError} />
        </View>
      </Screen>
    );
  }
  const f = fixture;
  const [a, b] = f.entries;
  const ready = f.status === 'ready' && a && b;

  async function openMatch(work: () => Promise<{ match: MatchView }>) {
    let matchId: string | null = null;
    const ok = await action.submit(async () => {
      matchId = (await work()).match.id;
    });
    if (ok && matchId) router.replace({ pathname: '/match/[id]', params: { id: matchId } });
  }

  function walkover() {
    if (!a || !b) return;
    Alert.alert('Who didn’t play?', 'The other entry goes through. Walkovers don’t change ratings.', [
      { text: `${a.name} didn’t show`, onPress: () => void openMatch(() => tournamentsApi.walkover(f.id, b.id, 'no_show')) },
      { text: `${b.name} didn’t show`, onPress: () => void openMatch(() => tournamentsApi.walkover(f.id, a.id, 'no_show')) },
      { text: 'Neither', style: 'destructive', onPress: () => void openMatch(() => tournamentsApi.walkover(f.id, null, 'walkover')) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  const scores = parseScores(scoreText);
  const iso = time.trim() ? new Date(time.trim().replace(' ', 'T')) : null;

  return (
    <Screen header={<TopBar title={f.roundName ?? 'Fixture'} />} onRefresh={refresh} refreshing={load.submitting}>
      <View style={styles.top} />
      <View style={styles.section}>
        <FixtureCard fixture={f} />
      </View>
      <FormMessage message={action.formError ?? Object.values(action.serverFieldErrors)[0] ?? null} />

      {tournament?.courts.length ? (
        <View style={styles.section}>
          <SectionHeader title="Court & time" />
          <Card style={styles.list}>
            <ChoiceChips
              accessibilityLabel="Court"
              options={[{ label: 'No court', value: '' }, ...tournament.courts.map((c) => ({ label: c.name, value: c.id }))]}
              value={f.court?.id ?? ''}
              onChange={(courtId) => void action.submit(async () => setFixture((await tournamentsApi.schedule(f.id, { courtId: courtId || null })).fixture))}
            />
            <TextField icon="clock" placeholder="Time, e.g. 2026-11-02 10:30" value={time} onChangeText={setTime} autoCorrect={false} />
            <OutlineButton
              title="Set time"
              disabled={!iso || Number.isNaN(iso.getTime())}
              onPress={() => void action.submit(async () => setFixture((await tournamentsApi.schedule(f.id, { scheduledAt: iso!.toISOString() })).fixture))}
            />
          </Card>
        </View>
      ) : null}

      {ready ? (
        <View style={styles.section}>
          <SectionHeader title="Play" />
          <View style={styles.list}>
            <PrimaryButton title="Start live scoring" onPress={() => void openMatch(() => tournamentsApi.start(f.id))} loading={action.submitting} />
            <OutlineButton title="Walkover / no-show" onPress={walkover} disabled={action.submitting} />
          </View>
          <Card style={[styles.list, styles.manual]}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              Or enter the result ({a!.name} first), e.g. 21-15, 18-21, 21-19
            </Text>
            <TextField icon="edit-3" placeholder="Score" value={scoreText} onChangeText={setScoreText} autoCorrect={false} />
            <OutlineButton title="Save result" disabled={!scores || action.submitting} onPress={() => void openMatch(() => tournamentsApi.result(f.id, scores!))} />
          </Card>
        </View>
      ) : (
        <Text style={[typography.caption, { color: colors.textMuted }]}>This match can start once both entries are known.</Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { paddingTop: spacing.lg },
  section: { marginBottom: spacing.xl },
  list: { gap: spacing.md },
  manual: { marginTop: spacing.lg },
});
