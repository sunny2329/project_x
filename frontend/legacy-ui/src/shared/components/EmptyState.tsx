import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, spacing, typography, useTheme } from '@/shared/theme';

interface EmptyStateProps {
  icon: ComponentProps<typeof Feather>['name'];
  title: string;
  message: string;
  action?: { label: string; onPress: () => void; icon?: ComponentProps<typeof Feather>['name'] };
  /** Red icon and a neutral "try again" button, for load failures. */
  tone?: 'default' | 'error';
}

/** Centred icon-in-a-circle, title, message and an optional pill button (empty and error states from the designs). */
export function EmptyState({ icon, title, message, action, tone = 'default' }: EmptyStateProps) {
  const { colors } = useTheme();
  const error = tone === 'error';
  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.circle,
          error
            ? { backgroundColor: colors.errorSurface, borderColor: colors.error }
            : { backgroundColor: colors.secondaryButton, borderColor: colors.surfaceBorder },
        ]}
      >
        <Feather name={icon} size={26} color={error ? colors.error : colors.icon} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text>
      {action ? (
        <Pressable
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          style={({ pressed }) => [
            styles.button,
            error
              ? { backgroundColor: pressed ? colors.secondaryButtonPressed : colors.secondaryButton, borderColor: colors.surfaceBorder }
              : {
                  backgroundColor: pressed ? colors.primaryPressed : colors.primary,
                  borderColor: 'transparent',
                  shadowColor: colors.primary,
                  shadowOpacity: colors.glow,
                },
          ]}
        >
          <Feather name={action.icon ?? (error ? 'refresh-cw' : 'plus')} size={16} color={error ? colors.text : colors.onPrimary} />
          <Text style={[styles.buttonText, { color: error ? colors.text : colors.onPrimary }]}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.xl, gap: spacing.sm },
  circle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  message: { ...typography.body, textAlign: 'center', lineHeight: 20 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    height: 46,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
  },
  buttonText: { fontSize: 15, fontWeight: '700' },
});
