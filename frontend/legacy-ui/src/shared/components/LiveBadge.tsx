import { StyleSheet, Text, View } from 'react-native';
import { radius, spacing, useTheme } from '@/shared/theme';

interface LiveBadgeProps {
  label?: string;
  /** Grey instead of orange, for FT / ABANDONED and the like. */
  muted?: boolean;
}

/** Orange "● LIVE" pill. */
export function LiveBadge({ label = 'LIVE', muted = false }: LiveBadgeProps) {
  const { colors } = useTheme();
  const fg = muted ? colors.textMuted : colors.onPrimary;
  return (
    <View style={[styles.pill, { backgroundColor: muted ? colors.secondaryButton : colors.primary }]}>
      {muted ? null : <View style={[styles.dot, { backgroundColor: fg }]} />}
      <Text style={[styles.text, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
});
