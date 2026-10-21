import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { clearSportsCache } from '@/features/match/hooks/useSports';
import { useProfileStore } from '@/features/profile/store/profile.store';
import { useScoringPrefs } from '@/shared/prefs/scoring-prefs.store';
import { FONT_ASSETS, useTheme, useThemeStore } from '@/shared/theme';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const status = useAuthStore((s) => s.status);
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const { scheme, colors } = useTheme();
  const [fontsLoaded, fontError] = useFonts(FONT_ASSETS);
  const ready = status !== 'checking' && (fontsLoaded || !!fontError);

  useEffect(() => {
    void bootstrap();
    void useThemeStore.getState().restore();
    void useScoringPrefs.getState().restore();
  }, [bootstrap]);

  useEffect(() => {
    // Keep the splash screen up until the session is restored and the fonts are in.
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  useEffect(() => {
    // Signing out must not leave the previous account's data in memory.
    if (status === 'unauthenticated') {
      useProfileStore.getState().reset();
      clearSportsCache();
    }
  }, [status]);

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.bg);
  }, [colors.bg]);

  if (!ready) return null;
  const signedIn = status === 'authenticated';

  return (
    <SafeAreaProvider>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
      </Stack>
    </SafeAreaProvider>
  );
}
