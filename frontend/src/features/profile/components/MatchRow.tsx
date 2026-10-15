import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { sportColor, sportIcon } from '@/features/match/format';
import { radius, spacing, typography, useTheme, type Palette } from '@/shared/theme';
import { formatRelativeTime } from '@/shared/utils/time';
import type { MatchHistoryItem, MatchOutcome } from '../types';

const OUTCOME_LABEL: Record<MatchOutcome, string> = { won: 'W', lost: 'L', draw: 'D', in_progress: 'LIVE', disputed: '?' };

function outcomeColors(outcome: MatchOutcome, colors: Palette): { fg: string; bg: string } {
  if (outcome === 'won') return { fg: colors.success, bg: colors.successSurface };
  if (outcome === 'lost') return { fg: colors.error, bg: colors.errorSurface };
  if (outcome === 'in_progress') return { fg: colors.onPrimary, bg: colors.primary };
  return { fg: colors.textMuted, bg: colors.secondaryButton };
}

/** One line of match history: sport icon, sport, opponents and score, when, result badge. Opens the match on tap. */
export function MatchRow({ match }: { match: MatchHistoryItem }) {
  const { colors } = useTheme();
  const outcome = outcomeColors(match.outcome, colors);
  const opponents = match.otherPlayers.length ? `vs ${match.otherPlayers.join(', ')}` : 'Solo match';
  const score = match.resultType === 'walkover' || match.resultType === 'no_show' ? 'W/O' : match.headline;
  const accent = sportColor(match.sport);

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/match/[id]', params: { id: match.matchId } })}
      accessibilityRole="button"
      accessibilityLabel={`${match.sport.name} ${opponents}, ${match.outcome.replace('_', ' ')}`}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={[styles.icon, { backgroundColor: `${accent}22` }]}>
        <MaterialCommunityIcons name={sportIcon(match.sport)} size={20} color={accent} />
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {match.sport.name}
          <Text style={[typography.caption, { color: colors.textMuted }]}> · {formatRelativeTime(match.playedAt)}</Text>
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
          {opponents}
          {score ? ` · ${score}` : ''}
        </Text>
      </View>
      <View style={[styles.badge, { backgroundColor: outcome.bg }]}>
        <Text style={[styles.badgeText, { color: outcome.fg }]}>{OUTCOME_LABEL[match.outcome]}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  icon: { width: 40, height: 40, borderRadius: radius.logo, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '700' },
  badge: { minWidth: 40, height: 26, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm },
  badgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
});
