import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
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
    if (!ready) return;
    void SplashScreen.hideAsync();
    // Web: from here on the app shows its own errors; public/index.html's startup-error screen stands down.
    if (Platform.OS === 'web') (globalThis as { __appStarted?: boolean }).__appStarted = true;
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

  if (!ready) {
    // Phones keep the native splash screen up; the browser has none, so show the same loading
    // screen as public/index.html instead of an empty black page.
    return Platform.OS === 'web' ? (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, backgroundColor: '#0B0B0B' }}>
        <ActivityIndicator color="#8A847D" />
        <Text style={{ color: '#8A847D', fontSize: 14, fontWeight: '600' }}>Loading ProjectX…</Text>
      </View>
    ) : null;
  }
  const signedIn = status === 'authenticated';

  return (
    <SafeAreaProvider>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        {/* Without redirectTo, signing out falls back to "/" (the guarded home tab) and lands on the sitemap. */}
        <Stack.Protected guard={signedIn} redirectTo="/welcome">
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
      </Stack>
    </SafeAreaProvider>
  );
}
