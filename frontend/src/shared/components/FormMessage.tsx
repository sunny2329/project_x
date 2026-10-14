import { StyleSheet, Text, View } from 'react-native';
import { radius, spacing, typography, useTheme } from '@/shared/theme';

interface FormMessageProps {
  message: string | null;
  tone?: 'error' | 'info';
}

/** Form-level feedback (server errors, "code sent" notices). Renders nothing without a message. */
export function FormMessage({ message, tone = 'error' }: FormMessageProps) {
  const { colors } = useTheme();
  if (!message) return null;
  const isError = tone === 'error';
  return (
    <View
      style={[styles.box, { backgroundColor: isError ? colors.errorSurface : colors.surface }]}
      accessibilityRole={isError ? 'alert' : 'text'}
      accessibilityLiveRegion="polite"
    >
      <Text style={[styles.text, { color: isError ? colors.error : colors.textMuted }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.field, paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  text: { ...typography.body, fontWeight: '500' },
});
