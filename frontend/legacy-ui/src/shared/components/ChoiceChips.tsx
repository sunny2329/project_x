import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, spacing, useTheme } from '@/shared/theme';

interface ChoiceChipsProps<T extends string | number> {
  options: { label: string; value: T }[];
  value: T | undefined;
  onChange: (value: T) => void;
  /** Read by screen readers before each option, e.g. "Overs". */
  accessibilityLabel?: string;
}

/** A row of pill options with one selected (a compact segmented control). */
export function ChoiceChips<T extends string | number>({ options, value, onChange, accessibilityLabel }: ChoiceChipsProps<T>) {
  const { colors } = useTheme();
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={accessibilityLabel ? `${accessibilityLabel} ${option.label}` : option.label}
            style={[
              styles.chip,
              {
                backgroundColor: selected ? colors.primary : colors.surface,
                borderColor: selected ? colors.primary : colors.surfaceBorder,
              },
            ]}
          >
            <Text style={[styles.label, { color: selected ? colors.onPrimary : colors.text }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minWidth: 44,
    height: 36,
    paddingHorizontal: spacing.md + 2,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 14, fontWeight: '700' },
});
