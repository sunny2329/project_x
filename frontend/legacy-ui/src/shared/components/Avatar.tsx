import { StyleSheet, Text, View } from 'react-native';
import { toneFor, useTheme } from '@/shared/theme';

interface AvatarProps {
  name: string;
  size?: number;
  /** Orange ring around the avatar (the signed-in player, people with live activity). */
  ring?: boolean;
}

/** "Rahul Sharma" -> "RS"; one word -> its first two letters. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const letters = words.length === 1 ? words[0]!.slice(0, 2) : `${words[0]![0]}${words.at(-1)![0]}`;
  return letters.toUpperCase();
}

/** Initials on a per-name colour, optionally inside an orange ring. Stands in for profile photos until photo upload exists. */
export function Avatar({ name, size = 44, ring = false }: AvatarProps) {
  const { colors } = useTheme();
  const inner = ring ? size - 8 : size;
  const circle = (
    <View
      style={[styles.circle, { width: inner, height: inner, borderRadius: inner / 2, backgroundColor: toneFor(name) }]}
      accessibilityRole="image"
      accessibilityLabel={`${name}'s avatar`}
    >
      <Text style={[styles.initials, { fontSize: inner * 0.38 }]}>{initialsOf(name)}</Text>
    </View>
  );
  if (!ring) return circle;
  return (
    <View style={[styles.circle, styles.ring, { width: size, height: size, borderRadius: size / 2, borderColor: colors.primary }]}>
      {circle}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  ring: { borderWidth: 2 },
  initials: { color: '#FFFFFF', fontWeight: '700', letterSpacing: 0.5 },
});
