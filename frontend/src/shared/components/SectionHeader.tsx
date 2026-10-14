import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { spacing, typography, useTheme } from '@/shared/theme';

interface SectionHeaderProps {
  title: string;
  /** Small orange icon before the title ("Your sports", "Trending"). */
  icon?: ComponentProps<typeof Feather>['name'];
  action?: { label: string; onPress: () => void };
}

export function SectionHeader({ title, icon, action }: SectionHeaderProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.titleRow}>
        {icon ? <Feather name={icon} size={17} color={colors.primary} /> : null}
        <Text style={[typography.sectionTitle, { color: colors.text }]} accessibilityRole="header">
          {title}
        </Text>
      </View>
      {action ? (
        <Pressable onPress={action.onPress} hitSlop={8} accessibilityRole="button" style={styles.action}>
          <Text style={[typography.link, { color: colors.primary }]}>{action.label}</Text>
          <Feather name="chevron-right" size={15} color={colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  action: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
