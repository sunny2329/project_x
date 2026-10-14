import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { LiveMatchCard } from '@/features/match/components/LiveMatchCard';
import { useLiveMatches } from '@/features/match/hooks/useLiveMatches';
import { MatchRow } from '@/features/profile/components/MatchRow';
import { useProfileStore } from '@/features/profile/store/profile.store';
import { Card, EmptyState, FormMessage, Screen, SectionHeader, TopBar } from '@/shared/components';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { spacing } from '@/shared/theme';
import { SportTile } from './components/SportTile';

const RECENT_MATCHES = 3;

/** Discover: my sports with rating and record, live matches, recent matches. */
export default function SportsScreen() {
  const profile = useProfileStore((s) => s.profile);
  const matches = useProfileStore((s) => s.matches);
  const loadProfile = useProfileStore((s) => s.load);
  const live = useLiveMatches();
  const refreshLive = live.refresh;
  const { submitting: refreshing, formError: error, submit } = useSubmit();

  const refresh = useCallback(() => {
    void submit(async () => {
      await Promise.all([loadProfile(), refreshLive()]);
    });
  }, [submit, loadProfile, refreshLive]);

  // Refresh whenever the tab comes back into view (e.g. after saving a match result).
  useFocusEffect(refresh);

  const sports = profile?.sports ?? [];

  return (
    <Screen edges={['top']} header={<TopBar title="Discover" back={false} />} onRefresh={refresh} refreshing={refreshing}>
      <View style={styles.top}>
        <FormMessage message={error} />
      </View>

      <View style={styles.section}>
        <SectionHeader title="Your sports" icon="target" action={{ label: 'Edit', onPress: () => router.push('/edit-profile') }} />
        {sports.length ? (
          <View style={styles.grid}>
            {sports.map((sport) => (
              <SportTile key={sport.id} sport={sport} />
            ))}
          </View>
        ) : (
          <Card>
            <EmptyState
              icon="target"
              title="Pick your sports"
              message="Add the sports you play to track your rating and stats in each."
              action={{ label: 'Add sports', onPress: () => router.push('/edit-profile') }}
            />
          </Card>
        )}
      </View>

      {live.matches.length ? (
        <View style={styles.section}>
          <SectionHeader title="Live now" icon="radio" action={{ label: 'See all', onPress: () => router.navigate('/matches') }} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.strip}>
            {live.matches.map((match) => (
              <View key={match.id} style={styles.liveCard}>
                <LiveMatchCard match={match} />
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHeader
          title="Recent matches"
          icon="trending-up"
          action={matches.length > RECENT_MATCHES ? { label: 'More', onPress: () => router.navigate('/matches') } : undefined}
        />
        <Card style={styles.list}>
          {matches.length ? (
            matches.slice(0, RECENT_MATCHES).map((match) => <MatchRow key={match.matchId} match={match} />)
          ) : (
            <EmptyState
              icon="activity"
              title="No matches yet"
              message="Matches you play show up here with the result."
              action={{ label: 'Start a match', onPress: () => router.navigate('/play') }}
            />
          )}
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { paddingTop: spacing.lg },
  section: { marginBottom: spacing.xl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm + 2 },
  bleed: { marginHorizontal: -spacing.screen },
  strip: { gap: spacing.md, paddingHorizontal: spacing.screen },
  liveCard: { width: 290 },
  list: { paddingVertical: spacing.xs },
});
