import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LiveBadge, TeamBadge } from '@/shared/components';
import { radius, spacing, typography, useTheme } from '@/shared/theme';
import { sideScore } from '../format';
import type { MatchCard } from '../types';

interface LiveMatchCardProps {
  match: MatchCard;
  /** Small fixed-width card for the Home strip. */
  compact?: boolean;
}

/** A live match: LIVE badge, both sides with badge + score, and what a tap does. Opens the match. */
export function LiveMatchCard({ match, compact = false }: LiveMatchCardProps) {
  const { colors } = useTheme();
  const battingSide = match.score.cricket?.battingSide;
  const action = match.mine ? 'Resume scoring' : 'Watch live';

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/match/[id]', params: { id: match.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${match.sport.name}, ${match.sides.map((s) => s.name).join(' versus ')}. ${action}`}
      style={({ pressed }) => [
        compact ? styles.compact : styles.full,
        {
          backgroundColor: colors.surface,
          borderColor: compact ? colors.surfaceBorder : colors.primary,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {compact ? null : <View style={[styles.accent, { backgroundColor: colors.primary }]} />}
      <View style={styles.header}>
        {compact ? (
          <LiveBadge />
        ) : (
          <Text style={[typography.caption, styles.league, { color: colors.textMuted }]} numberOfLines={1}>
            {match.sport.name} · {match.score.currentPeriod.label}
          </Text>
        )}
        {compact ? (
          <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
            {match.score.currentPeriod.label}
          </Text>
        ) : (
          <LiveBadge />
        )}
      </View>

      {match.sides.map((side) => {
        const score = sideScore(match.score, side.no);
        const leading = match.score.kind === 'timed_goals' && match.score.headline[side.no - 1]! > match.score.headline[2 - side.no]!;
        return (
          <View key={side.no} style={styles.side}>
            <TeamBadge name={side.name} size={compact ? 24 : 32} />
            <Text style={[compact ? styles.nameCompact : styles.name, { color: colors.text }]} numberOfLines={1}>
              {side.name}
              {battingSide === side.no ? <Text style={{ color: colors.primary }}> •</Text> : null}
            </Text>
            <Text style={[compact ? styles.scoreCompact : styles.score, { color: leading ? colors.primary : colors.text }]}>
              {score.main}
              {!compact && score.sub ? <Text style={[typography.caption, { color: colors.textMuted }]}> ({score.sub})</Text> : null}
            </Text>
          </View>
        );
      })}

      {compact ? null : (
        <View style={[styles.footer, { borderTopColor: colors.divider }]}>
          <Text style={[typography.link, { color: colors.link }]}>{action}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  compact: {
    width: 176,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: spacing.md,
    gap: spacing.sm,
  },
  full: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing.lg,
    paddingLeft: spacing.lg + 2,
    gap: spacing.md,
    overflow: 'hidden',
  },
  accent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  league: { flex: 1, fontWeight: '700' },
  side: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  name: { flex: 1, fontSize: 16, fontWeight: '700' },
  nameCompact: { flex: 1, fontSize: 14, fontWeight: '700' },
  score: { fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] },
  scoreCompact: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.md },
});
