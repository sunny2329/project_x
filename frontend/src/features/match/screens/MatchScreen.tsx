import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, Share, StyleSheet, Text, View } from 'react-native';
import { useProfileStore } from '@/features/profile/store/profile.store';
import { Avatar, Card, FormMessage, LiveBadge, OutlineButton, PrimaryButton, Screen, SectionHeader, TextLink, TopBar } from '@/shared/components';
import { spacing, typography, useTheme } from '@/shared/theme';
import { shareUrl } from '../api/match.api';
import { Scoreboard } from '../components/Scoreboard';
import { ScoringControls } from '../components/ScoringControls';
import { resultText, sportIcon, statusLabel } from '../format';
import { useMatch } from '../hooks/useMatch';
import type { MatchView } from '../types';

/** A single match: live scoring for its scorers, a live view for everyone else, and the result. */
export default function MatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const state = useMatch(id);
  const reloadProfile = useProfileStore((s) => s.load);
  const { match } = state;

  if (!match) {
    return (
      <Screen header={<TopBar title="Match" back="/matches" />}>
        <View style={styles.top}>{state.error ? <FormMessage message={state.error} /> : <ActivityIndicator color={colors.primary} />}</View>
      </Screen>
    );
  }

  const scoring = match.canScore && !match.score.complete;
  const awaitingSave = match.canScore && match.score.complete;
  const canUndo = match.canScore && match.version > 0 && !state.busy;
  const decided = ['completed', 'walkover', 'retired', 'disputed'].includes(match.status);

  async function saveResult() {
    // The profile (ratings, record, history) changes once the result is saved.
    if (await state.complete()) void reloadProfile().catch(() => undefined);
  }

  function confirmRetire() {
    Alert.alert('Who retired?', 'The score so far stands and the other side wins.', [
      ...match!.sides.map((side) => ({ text: side.name, onPress: () => void state.retire(side.index) })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  }

  function confirmAbandon() {
    Alert.alert('Abandon this match?', 'It is removed from the live list and nothing is added to anyone’s stats.', [
      { text: 'Keep playing', style: 'cancel' },
      { text: 'Abandon', style: 'destructive', onPress: () => void state.abandon() },
    ]);
  }

  function share() {
    const title = match!.sides.map((s) => s.name).join(' v ');
    const line = decided ? `${resultText(match!)} ${match!.score.headline}` : 'Follow the live score';
    void Share.share({ message: `${title} · ${match!.sport.name}\n${line}\n${shareUrl(match!)}` });
  }

  return (
    <Screen
      header={
        <TopBar
          back="/matches"
          titleContent={
            <View style={styles.titleRow}>
              {match.status === 'live' ? <LiveBadge /> : <LiveBadge muted label={statusLabel(match.status)} />}
              <View style={styles.titleBlock}>
                <View style={styles.titleLine}>
                  <MaterialCommunityIcons name={sportIcon(match.sport)} size={16} color={match.sport.accentColor} />
                  <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                    {match.sport.name}
                  </Text>
                </View>
                <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
                  {[match.format.name, match.ruleset.name, match.court?.name].filter(Boolean).join(' · ')}
                </Text>
              </View>
            </View>
          }
        />
      }
      onRefresh={() => void state.reload()}
      refreshing={false}
    >
      <View style={styles.top} />
      {match.tournament ? (
        <TextLink
          title={`${match.tournament.name} · ${match.tournament.eventName}${match.tournament.roundName ? ` · ${match.tournament.roundName}` : ''}`}
          onPress={() => router.push({ pathname: '/tournaments/event/[id]', params: { id: match.tournament!.eventId } })}
        />
      ) : null}

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
            Save the result to update everyone’s stats and ratings. Undo if the last point was a mistake.
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
            <OutlineButton title="Retired" onPress={confirmRetire} disabled={state.busy || match.version === 0} />
          </View>
          {match.context === 'friendly' ? (
            <View style={styles.flex}>
              <OutlineButton title="Abandon" onPress={confirmAbandon} disabled={state.busy} destructive />
            </View>
          ) : null}
        </View>
      ) : null}

      {match.status === 'live' && !match.canScore ? (
        <Text style={[typography.caption, styles.center, styles.section, { color: colors.textMuted }]}>
          {match.score.complete ? 'Waiting for the scorer to save the result.' : 'Live · the score updates automatically.'}
        </Text>
      ) : null}

      {match.confirmation.status !== 'not_required' ? <ConfirmationCard match={match} busy={state.busy} onDecide={(d) => void state.confirm(d)} /> : null}
      {decided ? <ResultCard match={match} /> : null}
      {match.status === 'abandoned' ? <FormMessage tone="info" message="This match was abandoned. It doesn’t count towards anyone’s stats." /> : null}

      <View style={styles.section}>
        <OutlineButton title={match.status === 'live' ? 'Share live score' : 'Share result'} onPress={share} />
      </View>

      <View style={styles.section}>
        <SectionHeader title="Players" />
        <Card style={styles.players}>
          {match.sides.map((side) => (
            <View key={side.index} style={styles.sideBlock}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>{side.name}</Text>
              {side.players.map((player) => (
                <View key={player.playerId} style={styles.player}>
                  <Avatar name={player.displayName} size={28} />
                  <Text style={[typography.body, { color: colors.text }]}>
                    {player.displayName}
                    {player.isGuest ? <Text style={{ color: colors.textMuted }}> · guest</Text> : null}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </Card>
      </View>
    </Screen>
  );
}

/** Opponent confirmation of a result entered afterwards. */
function ConfirmationCard({ match, busy, onDecide }: { match: MatchView; busy: boolean; onDecide: (d: 'confirmed' | 'disputed') => void }) {
  const { colors } = useTheme();
  const { confirmation } = match;
  const text =
    confirmation.status === 'pending'
      ? confirmation.canConfirm
        ? 'This result was entered after the match. Confirm it so it counts towards ratings, or dispute it.'
        : 'Waiting for an opponent to confirm this result. It counts towards ratings once confirmed.'
      : confirmation.status === 'confirmed'
        ? 'Confirmed by the opponent.'
        : 'Disputed by the opponent. It doesn’t count towards stats or ratings.';
  return (
    <Card style={[styles.section, styles.result]}>
      <Text style={[typography.body, styles.center, { color: colors.textMuted }]}>{text}</Text>
      {confirmation.status === 'pending' && confirmation.canConfirm ? (
        <View style={styles.row}>
          <View style={styles.flex}>
            <PrimaryButton title="Confirm" onPress={() => onDecide('confirmed')} loading={busy} showChevron={false} />
          </View>
          <View style={styles.flex}>
            <OutlineButton title="Dispute" onPress={() => onDecide('disputed')} disabled={busy} destructive />
          </View>
        </View>
      ) : null}
    </Card>
  );
}

/** The saved result and each player's rating change. */
function ResultCard({ match }: { match: MatchView }) {
  const { colors } = useTheme();
  const players = match.sides.flatMap((side) => side.players);
  return (
    <Card style={[styles.section, styles.result]}>
      <Text style={[styles.resultTitle, { color: colors.text }]}>{resultText(match)}</Text>
      <Text style={[typography.body, styles.center, { color: colors.textMuted }]}>{match.score.headline}</Text>
      {match.ratingChanges.length ? (
        <View style={styles.ratings}>
          {match.ratingChanges.map((change) => {
            const player = players.find((p) => p.playerId === change.playerId);
            const delta = Math.round((change.after - change.before) * 10) / 10;
            return (
              <View key={change.playerId} style={styles.ratingRow}>
                <Text style={[typography.body, styles.flex, { color: colors.text }]} numberOfLines={1}>
                  {player?.displayName ?? 'Player'}
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
      ) : (
        <Text style={[typography.caption, styles.center, { color: colors.textMuted }]}>
          {match.resultType === 'walkover' || match.resultType === 'no_show' ? 'Walkovers don’t change ratings.' : 'Ratings change only when every player has an account.'}
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { paddingTop: spacing.lg },
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
