import { useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { radius, sizes, spacing, useTheme } from '@/shared/theme';

export const OTP_LENGTH = 6;

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  hasError?: boolean;
  autoFocus?: boolean;
}

/**
 * Six display boxes over one hidden input, so paste and SMS autofill
 * (iOS oneTimeCode / Android sms-otp) fill every box at once.
 */
export function OtpInput({ value, onChange, hasError = false, autoFocus = true }: OtpInputProps) {
  const { colors } = useTheme();
  const inputRef = useRef<TextInput>(null);

  return (
    <Pressable onPress={() => inputRef.current?.focus()} accessibilityLabel="Verification code" accessibilityHint="Enter the 6-digit code">
      <View style={styles.row}>
        {Array.from({ length: OTP_LENGTH }, (_, index) => {
          const active = index === Math.min(value.length, OTP_LENGTH - 1);
          const borderColor = hasError ? colors.error : active ? colors.primary : colors.surfaceBorder;
          return (
            <View key={index} style={[styles.box, { backgroundColor: colors.surface, borderColor }]}>
              <Text style={[styles.digit, { color: colors.text }]}>{value[index] ?? ''}</Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, OTP_LENGTH))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={OTP_LENGTH}
        autoFocus={autoFocus}
        caretHidden
        style={styles.hiddenInput}
        testID="otp-input"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  box: {
    flex: 1,
    height: sizes.field + 4,
    borderRadius: radius.field,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: { fontSize: 22, fontWeight: '700' },
  hiddenInput: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});
