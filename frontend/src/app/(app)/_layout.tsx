import { Stack } from 'expo-router';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useTheme } from '@/shared/theme';

/** Right after sign-up only the onboarding screens are reachable ("What do you play?", claim). */
export default function AppLayout() {
  const { colors } = useTheme();
  const onboarding = useAuthStore((s) => s.onboarding);
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Protected guard={onboarding}>
        <Stack.Screen name="onboarding/sports" />
        <Stack.Screen name="onboarding/claim" />
        <Stack.Screen name="onboarding/details" />
      </Stack.Protected>
      <Stack.Protected guard={!onboarding}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
    </Stack>
  );
}
