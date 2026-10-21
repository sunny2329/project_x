import { StyleSheet, Text, View } from 'react-native';
import { radius, spacing, typography, useTheme } from '@/shared/theme';

export function winRate(won: number, played: number): string {
  return played === 0 ? '–' : `${Math.round((won / played) * 100)}%`;
}

interface StatTile {
  label: string;
  value: string;
  hint?: string;
}

interface StatsGridProps {
  /** The headline block: e.g. rating for a sport, win % overall. */
  headline: { label: string; value: string; caption: string; badge?: string };
  tiles: StatTile[];
}

/** Headline card plus a 3-column grid of stat tiles (first value in orange), from the profile design. */
export function StatsGrid({ headline, tiles }: StatsGridProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={[styles.headline, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
        <View style={styles.headlineText}>
          <Text style={[typography.overline, { color: colors.textMuted }]}>{headline.label}</Text>
          <Text style={[styles.headlineValue, { color: colors.text }]}>{headline.value}</Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>{headline.caption}</Text>
        </View>
        {headline.badge ? (
          <View style={[styles.badge, { backgroundColor: colors.primarySoft }]}>
            <Text style={[styles.badgeText, { color: colors.primary }]}>{headline.badge}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.grid}>
        {tiles.map((tile, index) => (
          <View key={tile.label} style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
            <Text style={[typography.overline, { color: colors.textMuted }]} numberOfLines={1}>
              {tile.label}
            </Text>
            <Text style={[styles.tileValue, { color: index === 0 ? colors.primary : colors.text }]}>{tile.value}</Text>
            {tile.hint ? <Text style={[typography.caption, { color: colors.textMuted }]}>{tile.hint}</Text> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm + 2 },
  headline: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  headlineText: { flex: 1, gap: 2 },
  headlineValue: { fontSize: 34, fontWeight: '800', letterSpacing: -0.5 },
  badge: { borderRadius: radius.pill, paddingHorizontal: spacing.sm + 2, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm + 2 },
  tile: {
    flexBasis: '30%',
    flexGrow: 1,
    padding: spacing.md,
    gap: spacing.xs,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  tileValue: { fontSize: 22, fontWeight: '800' },
});
