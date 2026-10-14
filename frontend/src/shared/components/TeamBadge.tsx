import { StyleSheet, Text, View } from 'react-native';
import { toneFor } from '@/shared/theme';
import { initialsOf } from './Avatar';

interface TeamBadgeProps {
  name: string;
  size?: number;
}

/** Rounded-square initials badge for a side / team ("RS", "TX"). */
export function TeamBadge({ name, size = 30 }: TeamBadgeProps) {
  return (
    <View
      style={[styles.badge, { width: size, height: size, borderRadius: size * 0.28, backgroundColor: toneFor(name) }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={[styles.text, { fontSize: size * 0.36 }]}>{initialsOf(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: 'center', justifyContent: 'center' },
  text: { color: '#FFFFFF', fontWeight: '800' },
});
