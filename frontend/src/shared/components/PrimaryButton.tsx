import Feather from '@expo/vector-icons/Feather';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, sizes, spacing, typography, useTheme } from '@/shared/theme';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  showChevron?: boolean;
}

/** The flat orange pill call-to-action. Dimmed while disabled, as in Strava's auth screens. */
export function PrimaryButton({ title, onPress, loading = false, disabled = false, showChevron = false }: PrimaryButtonProps) {
  const { colors } = useTheme();
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: pressed ? colors.primaryPressed : colors.primary, shadowColor: colors.primary, shadowOpacity: colors.glow },
        disabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.onPrimary} />
      ) : (
        <View style={styles.content}>
          <Text style={[styles.label, { color: colors.onPrimary }]}>{title}</Text>
          {showChevron ? <Feather name="chevron-right" size={18} color={colors.onPrimary} /> : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: sizes.primaryButton,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: typography.button,
  disabled: { opacity: 0.45 },
});
