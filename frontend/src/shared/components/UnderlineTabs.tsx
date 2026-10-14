import { Pressable, StyleSheet, Text, View } from 'react-native';
import { spacing, useTheme } from '@/shared/theme';

interface UnderlineTabsProps<T extends string> {
  tabs: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
}

/** Evenly spaced text tabs with an orange underline on the selected one (Strava's Progress / Activities row). */
export function UnderlineTabs<T extends string>({ tabs, value, onChange }: UnderlineTabsProps<T>) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: colors.divider }]} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const selected = tab.value === value;
        return (
          <Pressable
            key={tab.value}
            onPress={() => onChange(tab.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={styles.tab}
          >
            <Text style={[styles.label, { color: selected ? colors.text : colors.textMuted }]}>{tab.label}</Text>
            <View style={[styles.underline, { backgroundColor: selected ? colors.primary : 'transparent' }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: 'center', paddingTop: spacing.md },
  label: { fontSize: 15, fontWeight: '700', marginBottom: spacing.md },
  underline: { height: 3, width: '60%', borderTopLeftRadius: 3, borderTopRightRadius: 3 },
});
