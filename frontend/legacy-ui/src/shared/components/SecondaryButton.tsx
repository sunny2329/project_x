import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, sizes, spacing, typography, useTheme } from '@/shared/theme';

interface SecondaryButtonProps {
  title: string;
  icon: ReactNode;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}

/** Dark pill used for alternative sign-in methods (Google, Phone, Apple). */
export function SecondaryButton({ title, icon, onPress, loading = false, disabled = false }: SecondaryButtonProps) {
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
        { backgroundColor: pressed ? colors.secondaryButtonPressed : colors.secondaryButton },
        disabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <View style={styles.content}>
          {icon}
          <Text style={[styles.label, { color: colors.text }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { flex: 1, height: sizes.secondaryButton, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  label: typography.secondaryButton,
  disabled: { opacity: 0.5 },
});
