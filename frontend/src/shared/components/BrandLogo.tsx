import { StyleSheet, Text, View } from 'react-native';
import { radius, spacing, typography, useTheme } from '@/shared/theme';

interface BrandLogoProps {
  /** Tile edge in points; the wordmark scales with it. */
  size?: number;
}

/** Orange "X" tile + "ProjectX" wordmark. */
export function BrandLogo({ size = 50 }: BrandLogoProps) {
  const { colors } = useTheme();
  const compact = size < 44;
  return (
    <View style={[styles.row, { gap: compact ? spacing.sm + 2 : spacing.md }]} accessibilityRole="header" accessibilityLabel="ProjectX">
      <View
        style={[
          styles.tile,
          {
            width: size,
            height: size,
            borderRadius: compact ? radius.logo - 2 : radius.logo,
            backgroundColor: colors.primary,
            shadowColor: colors.primary,
            shadowOpacity: colors.glow,
          },
        ]}
      >
        <Text style={[styles.letter, { color: colors.onPrimary, fontSize: size * 0.48 }]}>X</Text>
      </View>
      <Text style={[compact ? typography.headerWordmark : typography.wordmark, { color: colors.text }]}>
        Project<Text style={{ color: colors.primary }}>X</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  tile: { alignItems: 'center', justifyContent: 'center', shadowOffset: { width: 0, height: 4 }, shadowRadius: 12 },
  letter: { fontWeight: '800' },
});
