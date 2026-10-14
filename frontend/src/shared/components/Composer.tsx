import Feather from '@expo/vector-icons/Feather';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, spacing, useTheme } from '@/shared/theme';

interface ComposerProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  placeholder: string;
  sending?: boolean;
  maxLength?: number;
  /** Shown before the input (e.g. the player's avatar). */
  leading?: ReactNode;
}

/** Bottom bar with a pill input and a round orange send button (comments, chat). */
export function Composer({ value, onChangeText, onSend, placeholder, sending = false, maxLength, leading }: ComposerProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const canSend = value.trim().length > 0 && !sending;

  return (
    <View
      style={[
        styles.bar,
        { paddingBottom: Math.max(insets.bottom, spacing.sm), backgroundColor: colors.header, borderTopColor: colors.divider },
      ]}
    >
      {leading}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.primary}
        cursorColor={colors.primary}
        multiline
        maxLength={maxLength}
        accessibilityLabel={placeholder}
        style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder, color: colors.text }]}
      />
      <Pressable
        onPress={onSend}
        disabled={!canSend}
        accessibilityRole="button"
        accessibilityLabel="Send"
        accessibilityState={{ disabled: !canSend, busy: sending }}
        style={({ pressed }) => [
          styles.send,
          { backgroundColor: pressed ? colors.primaryPressed : colors.primary, shadowColor: colors.primary, shadowOpacity: colors.glow },
          !canSend && styles.disabled,
        ]}
      >
        {sending ? <ActivityIndicator color={colors.onPrimary} /> : <Feather name="send" size={19} color={colors.onPrimary} />}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm + 2,
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: spacing.lg,
    paddingTop: 11,
    paddingBottom: 11,
    fontSize: 15,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
  },
  disabled: { opacity: 0.45 },
});
