import { Stack } from 'expo-router';
import { useTheme } from '@/shared/theme';

export const unstable_settings = { initialRouteName: 'welcome' };

export default function AuthLayout() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="welcome" />
    </Stack>
  );
}
