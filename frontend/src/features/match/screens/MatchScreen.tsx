import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { useProfileStore } from '@/features/profile/store/profile.store';
import { Avatar, Card, FormMessage, LiveBadge, OutlineButton, PrimaryButton, Screen, SectionHeader, TopBar } from '@/shared/components';
import { spacing, typography, useTheme } from '@/shared/theme';
import { Scoreboard } from '../components/Scoreboard';
import { ScoringControls } from '../components/ScoringControls';
import { resultText, rulesSummary, sportIcon } from '../format';
import { useMatch } from '../hooks/useMatch';
import type { MatchDetail } from '../types';

/** A single match: live scoring for its creator, a live view for everyone else, and the final result. */
export default function MatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const state = useMatch(id);
  const reloadProfile = useProfileStore((s) => s.load);
  const { match } = state;

  if (!match) {
    return (
      <Screen header={<TopBar title="Match" back="/matches" />}>
        <View style={styles.loading}>
          {state.error ? <FormMessage message={state.error} /> : <ActivityIndicator color={colors.primary} />}
        </View>
      </Screen>
    );
  }

  const scoring = match.canScore && !match.score.finished;
  const awaitingSave = match.canScore && match.score.finished;
  const canUndo = match.canScore && match.version > 0 && !state.busy;

  async function saveResult() {
    // The profile (ratings, record, history) changes once the result is saved.
    if (await state.finish()) void reloadProfile().catch(() => undefined);
  }

  function confirmAbandon() {
    Alert.alert('Abandon this match?', 'It will be removed from the live list and nothing is added to anyone’s stats.', [
      { text: 'Keep playing', style: 'cancel' },
      { text: 'Abandon', style: 'destructive', onPress: () => void state.abandon() },
    ]);
  }

  return (
    <Screen
      header={
        <TopBar
          back="/matches"
          titleContent={
            <View style={styles.titleRow}>
              <StatusPill match={match} />
              <View style={styles.titleBlock}>
                <View style={styles.titleLine}>
                  <MaterialCommunityIcons name={sportIcon(match.sport.code)} size={16} color={colors.primary} />
                  <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                    {match.sport.name}
                  </Text>
                </View>
                <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
                  {match.format.name} · {rulesSummary(match.config)}
                </Text>
              </View>
            </View>
          }
        />
      }
      onRefresh={() => void state.reload()}
      refreshing={false}
    >
      <View style={styles.loading} />

      <FormMessage message={state.error} />
      <View style={styles.section}>
        <Scoreboard match={match} />
      </View>

      {scoring ? (
        <View style={styles.section}>
          <ScoringControls match={match} busy={state.busy} onEvent={(event) => void state.score(event)} />
        </View>
      ) : null}

      {awaitingSave ? (
        <Card style={[styles.section, styles.result]}>
          <Text style={[styles.resultTitle, { color: colors.text }]}>{resultText(match)}</Text>
          <Text style={[typography.body, styles.center, { color: colors.textMuted }]}>
            Save the result to update everyone’s stats and ratings. Undo if the last entry was a mistake.
          </Text>
          <PrimaryButton title="Save result" onPress={() => void saveResult()} loading={state.busy} showChevron={false} />
        </Card>
      ) : null}

      {match.canScore ? (
        <View style={[styles.section, styles.row]}>
          <View style={styles.flex}>
            <OutlineButton title="Undo" onPress={() => void state.undo()} disabled={!canUndo} />
          </View>
          <View style={styles.flex}>
            <OutlineButton title="Abandon" onPress={confirmAbandon} disabled={state.busy} destructive />
          </View>
        </View>
      ) : null}

      {match.status === 'live' && !match.canScore ? (
        <Text style={[typography.caption, styles.center, styles.section, { color: colors.textMuted }]}>
          {match.score.finished ? 'Waiting for the scorer to save the result.' : 'Live · the score updates automatically.'}
        </Text>
      ) : null}

      {match.status === 'completed' ? <ResultCard match={match} /> : null}
      {match.status === 'abandoned' ? (
        <FormMessage tone="info" message="This match was abandoned. It doesn’t count towards anyone’s stats." />
      ) : null}

      <View style={styles.section}>
        <SectionHeader title="Players" />
        <Card style={styles.players}>
          {match.sides.map((side) => (
            <View key={side.no} style={styles.sideBlock}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>{side.name}</Text>
              {side.players.map((player) => (
                <View key={player.participantId} style={styles.player}>
                  <Avatar name={player.fullName} size={28} />
                  <Text style={[typography.body, { color: colors.text }]}>{player.fullName}</Text>
                </View>
              ))}
            </View>
          ))}
        </Card>
      </View>
    </Screen>
  );
}

function StatusPill({ match }: { match: MatchDetail }) {
  if (match.status === 'live') return <LiveBadge />;
  return <LiveBadge muted label={match.status === 'completed' ? 'FT' : 'ABANDONED'} />;
}

/** The saved result and each player's rating change. */
function ResultCard({ match }: { match: MatchDetail }) {
  const { colors } = useTheme();
  const players = match.sides.flatMap((side) => side.players);
  return (
    <Card style={[styles.section, styles.result]}>
      <Text style={[styles.resultTitle, { color: colors.text }]}>{resultText(match)}</Text>
      <Text style={[typography.body, styles.center, { color: colors.textMuted }]}>{match.score.summary}</Text>
      {match.ratingChanges.length ? (
        <View style={styles.ratings}>
          {match.ratingChanges.map((change) => {
            const player = players.find((p) => p.userId === change.userId);
            const delta = Math.round((change.after - change.before) * 10) / 10;
            return (
              <View key={change.userId} style={styles.ratingRow}>
                <Text style={[typography.body, styles.flex, { color: colors.text }]} numberOfLines={1}>
                  {player?.fullName ?? 'Player'}
                </Text>
                <Text style={[typography.body, { color: colors.textMuted }]}>{Math.round(change.after)}</Text>
                <Text style={[styles.delta, { color: delta >= 0 ? colors.success : colors.error }]}>
                  {delta >= 0 ? '+' : ''}
                  {delta}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  loading: { paddingTop: spacing.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  titleBlock: { flex: 1, gap: 1 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  title: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  section: { marginBottom: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  result: { gap: spacing.md, alignItems: 'stretch' },
  resultTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  ratings: { gap: spacing.sm },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  delta: { minWidth: 52, textAlign: 'right', fontWeight: '800' },
  players: { gap: spacing.lg },
  sideBlock: { gap: spacing.sm },
  player: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
