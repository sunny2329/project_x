import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LiveBadge, TeamBadge } from '@/shared/components';
import { radius, spacing, typography, useTheme } from '@/shared/theme';
import { sportIcon } from '../format';
import type { MatchCard } from '../types';

interface LiveMatchCardProps {
  match: MatchCard;
  /** Small fixed-width card for the Home strip. */
  compact?: boolean;
  /** Footer action text; defaults to "Resume scoring" / "Watch live". */
  action?: string;
}

/** A match card: sport, both sides with games won and the running score, and what a tap does. */
export function LiveMatchCard({ match, compact = false, action }: LiveMatchCardProps) {
  const { colors } = useTheme();
  const label = action ?? (match.mine ? 'Resume scoring' : 'Watch live');
  const live = match.status === 'live';

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/match/[id]', params: { id: match.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${match.sport.name}, ${match.sides.map((s) => s.name).join(' versus ')}. ${label}`}
      style={({ pressed }) => [
        compact ? styles.compact : styles.full,
        { backgroundColor: colors.surface, borderColor: compact || !live ? colors.surfaceBorder : colors.primary, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      {compact || !live ? null : <View style={[styles.accent, { backgroundColor: colors.primary }]} />}
      <View style={styles.header}>
        <MaterialCommunityIcons name={sportIcon(match.sport)} size={14} color={match.sport.accentColor} />
        <Text style={[typography.caption, styles.league, { color: colors.textMuted }]} numberOfLines={1}>
          {match.sport.name}
          {match.score.callout && live ? ` · ${match.score.callout}` : ''}
        </Text>
        {live ? <LiveBadge /> : null}
      </View>

      {match.sides.map((side) => {
        const s = match.score.sides[side.index];
        return (
          <View key={side.index} style={styles.side}>
            <TeamBadge name={side.name} size={compact ? 24 : 32} />
            <Text style={[compact ? styles.nameCompact : styles.name, { color: colors.text }]} numberOfLines={1}>
              {side.name}
              {live && s?.serving ? <Text style={{ color: colors.primary }}> •</Text> : null}
            </Text>
            <Text style={[compact ? styles.scoreCompact : styles.score, { color: colors.text }]}>{s?.primary ?? '0'}</Text>
            {live && s?.current !== null && s?.current !== undefined ? (
              <Text style={[compact ? styles.scoreCompact : styles.score, styles.current, { color: colors.primary }]}>{s.current}</Text>
            ) : null}
          </View>
        );
      })}

      {compact ? null : (
        <View style={[styles.footer, { borderTopColor: colors.divider }]}>
          <Text style={[typography.link, { color: colors.link }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  compact: { width: 176, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth * 2, padding: spacing.md, gap: spacing.sm },
  full: { borderRadius: radius.card, borderWidth: 1, padding: spacing.lg, paddingLeft: spacing.lg + 2, gap: spacing.md, overflow: 'hidden' },
  accent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  league: { flex: 1, fontWeight: '700' },
  side: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  name: { flex: 1, fontSize: 16, fontWeight: '700' },
  nameCompact: { flex: 1, fontSize: 14, fontWeight: '700' },
  score: { fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] },
  scoreCompact: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  current: { minWidth: 30, textAlign: 'right' },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.md },
});
