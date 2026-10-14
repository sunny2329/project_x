import Feather from '@expo/vector-icons/Feather';
import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@/shared/theme';

interface BackButtonProps {
  /** Where to go when there is no screen to go back to (e.g. opened from a deep link). */
  fallback?: Href;
}

/** Plain arrow, as on Strava's auth screens. */
export function BackButton({ fallback = '/welcome' }: BackButtonProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback))}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      style={({ pressed }) => [styles.button, pressed && { opacity: 0.6 }]}
    >
      <Feather name="arrow-left" size={24} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 40, height: 40, justifyContent: 'center' },
});
