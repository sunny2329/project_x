import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StyleSheet, Text, View } from 'react-native';
import { sportColor, sportIcon } from '@/features/match/format';
import type { PlayerSport } from '@/features/profile/types';
import { radius, spacing, typography, useTheme } from '@/shared/theme';

/** Discover tile: coloured top stripe, sport icon on a tinted square, name, rating and record. */
export function SportTile({ sport }: { sport: PlayerSport }) {
  const { colors } = useTheme();
  const accent = sportColor(sport.code);
  return (
    <View
      style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder, borderTopColor: accent }]}
      accessibilityLabel={`${sport.name}, rating ${Math.round(sport.rating)}, ${sport.matchesWon} wins, ${sport.matchesLost} losses`}
    >
      {sport.isPrimary ? <View style={[styles.primaryDot, { backgroundColor: colors.primary }]} /> : null}
      <View style={[styles.icon, { backgroundColor: `${accent}22` }]}>
        <MaterialCommunityIcons name={sportIcon(sport.code)} size={24} color={accent} />
      </View>
      <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
        {sport.name}
      </Text>
      <Text style={[typography.caption, { color: colors.textMuted }]}>
        {Math.round(sport.rating)} · {sport.matchesWon}W {sport.matchesLost}L
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexBasis: '30%',
    flexGrow: 1,
    maxWidth: '33%',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderTopWidth: 3,
  },
  primaryDot: { position: 'absolute', top: spacing.sm, right: spacing.sm, width: 6, height: 6, borderRadius: 3 },
  icon: { width: 48, height: 48, borderRadius: radius.logo, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 14, fontWeight: '700' },
});
