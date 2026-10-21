import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, useTheme } from '@/shared/theme';

interface IconButtonProps {
  icon: ComponentProps<typeof Feather>['name'];
  label: string;
  onPress: () => void;
  color?: string;
  /** Orange count bubble on the icon (hidden at 0). */
  badge?: number;
}

/** A bare 40pt icon target for app bars. */
export function IconButton({ icon, label, onPress, color, badge = 0 }: IconButtonProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={badge > 0 ? `${label}, ${badge} unread` : label}
      style={({ pressed }) => [styles.button, pressed && { backgroundColor: colors.secondaryButtonPressed }]}
    >
      <Feather name={icon} size={22} color={color ?? colors.text} />
      {badge > 0 ? (
        <View style={[styles.badge, { backgroundColor: colors.primary, borderColor: colors.header }]}>
          <Text style={[styles.badgeText, { color: colors.onPrimary }]}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 2,
    right: 1,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 10, fontWeight: '800' },
});
