import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { TextLink } from '@/shared/components';
import { typography, useTheme } from '@/shared/theme';

const COOLDOWN_SECONDS = 30;

interface ResendCodeProps {
  onResend: () => Promise<boolean>;
}

/** "Resend code" link with a cooldown so users don't burn through SMS limits. */
export function ResendCode({ onResend }: ResendCodeProps) {
  const { colors } = useTheme();
  const [secondsLeft, setSecondsLeft] = useState(COOLDOWN_SECONDS);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  async function handleResend() {
    setSending(true);
    const sent = await onResend();
    setSending(false);
    if (sent) setSecondsLeft(COOLDOWN_SECONDS);
  }

  return (
    <View style={styles.row}>
      {secondsLeft > 0 ? (
        <Text style={[styles.text, { color: colors.textMuted }]}>Resend code in {secondsLeft}s</Text>
      ) : (
        <TextLink title="Resend code" onPress={handleResend} disabled={sending} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center' },
  text: { ...typography.body, fontSize: 13 },
});
