import { Pressable, StyleSheet, Text, type TextStyle } from 'react-native';
import { typography, useTheme } from '@/shared/theme';

interface TextLinkProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  style?: TextStyle;
}

export function TextLink({ title, onPress, disabled = false, style }: TextLinkProps) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={10} accessibilityRole="link" accessibilityState={{ disabled }}>
      <Text style={[styles.link, { color: colors.link }, disabled && styles.disabled, style]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: typography.link,
  disabled: { opacity: 0.5 },
});
