import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MatchRow } from '@/features/profile/components/MatchRow';
import { useProfileStore } from '@/features/profile/store/profile.store';
import { Card, ChoiceChips, EmptyState, FormMessage, LiveBadge, Screen, SectionHeader, TopBar } from '@/shared/components';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { spacing, useTheme } from '@/shared/theme';
import { LiveMatchCard } from '../components/LiveMatchCard';
import { useLiveMatches } from '../hooks/useLiveMatches';

const ALL = 'ALL';

/** Live matches (mine and of players I follow) and my match history, filterable by sport. */
export default function MatchesScreen() {
  const { colors } = useTheme();
  const matches = useProfileStore((s) => s.matches);
  const loadProfile = useProfileStore((s) => s.load);
  const live = useLiveMatches();
  const refreshLive = live.refresh;
  const { submitting: refreshing, formError: error, submit } = useSubmit();
  const [sport, setSport] = useState<string>(ALL);

  const refresh = useCallback(() => {
    void submit(async () => {
      await Promise.all([loadProfile(), refreshLive()]);
    });
  }, [submit, loadProfile, refreshLive]);

  useFocusEffect(refresh);

  // Only the sports that actually appear, in order of first appearance.
  const sportNames = new Map<string, string>();
  for (const m of live.matches) sportNames.set(m.sport.code, m.sport.name);
  for (const m of matches) sportNames.set(m.sport.code, m.sport.name);
  const filters = [{ label: 'All', value: ALL }, ...[...sportNames].map(([code, name]) => ({ label: name, value: code }))];

  const liveShown = live.matches.filter((m) => sport === ALL || m.sport.code === sport);
  const history = matches.filter((m) => m.outcome !== 'in_progress' && (sport === ALL || m.sport.code === sport));

  return (
    <Screen edges={['top']} header={<TopBar title="Matches" back={false} />} onRefresh={refresh} refreshing={refreshing}>
      <View style={styles.filters}>
        <ChoiceChips accessibilityLabel="Sport" options={filters} value={sport} onChange={setSport} />
      </View>
      <FormMessage message={error} />

      {liveShown.length ? (
        <View style={styles.section}>
          <View style={styles.liveTitle}>
            <LiveBadge />
            <Text style={[styles.liveText, { color: colors.text }]}>Live now</Text>
          </View>
          <View style={styles.list}>
            {liveShown.map((match) => (
              <LiveMatchCard key={match.id} match={match} />
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHeader title="Your matches" />
        <Card style={styles.history}>
          {history.length ? (
            history.map((match) => <MatchRow key={match.matchId} match={match} />)
          ) : (
            <EmptyState
              icon="activity"
              title="No matches yet"
              message="Every match you score is saved here with its result."
              action={{ label: 'Start a match', onPress: () => router.navigate('/play') }}
            />
          )}
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { paddingTop: spacing.lg, marginBottom: spacing.lg },
  section: { marginBottom: spacing.xl },
  liveTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  liveText: { fontSize: 15, fontWeight: '700' },
  list: { gap: spacing.md },
  history: { paddingVertical: spacing.xs },
});
