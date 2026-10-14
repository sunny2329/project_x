import { StyleSheet, Text, View } from 'react-native';
import { TextLink } from '@/shared/components';
import { spacing, typography, useTheme } from '@/shared/theme';

interface FooterPromptProps {
  prompt: string;
  action: string;
  onPress: () => void;
}

/** "New here? Create account" style footer line. */
export function FooterPrompt({ prompt, action, onPress }: FooterPromptProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.prompt, { color: colors.textMuted }]}>{prompt}</Text>
      <TextLink title={action} onPress={onPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  prompt: { ...typography.body, fontSize: 13 },
});
