import { StyleSheet, Text, View } from 'react-native';
import { spacing, typography, useTheme } from '@/shared/theme';

export function OrDivider() {
  const { colors } = useTheme();
  return (
    <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.line, { backgroundColor: colors.divider }]} />
      <Text style={[styles.label, { color: colors.textMuted }]}>or</Text>
      <View style={[styles.line, { backgroundColor: colors.divider }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  line: { flex: 1, height: StyleSheet.hairlineWidth * 2 },
  label: { ...typography.body, fontSize: 15 },
});
