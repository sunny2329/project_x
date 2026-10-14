import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, sizes, spacing, typography, useTheme } from '@/shared/theme';

interface OutlineButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  /** Red text and border, for actions like abandoning a match. */
  destructive?: boolean;
  /** Shown before the title, e.g. a provider logo on "Continue with Google". */
  icon?: ReactNode;
}

/** Full-width bordered pill for secondary actions next to a PrimaryButton. */
export function OutlineButton({ title, onPress, loading = false, disabled = false, destructive = false, icon }: OutlineButtonProps) {
  const { colors } = useTheme();
  const inactive = disabled || loading;
  const tint = destructive ? colors.error : colors.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        {
          borderColor: destructive ? colors.error : colors.surfaceBorder,
          backgroundColor: pressed ? colors.secondaryButtonPressed : 'transparent',
        },
        disabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={tint} />
      ) : (
        <View style={styles.content}>
          {icon}
          <Text style={[typography.secondaryButton, { color: tint }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { height: sizes.secondaryButton, borderRadius: radius.pill, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  disabled: { opacity: 0.5 },
});
