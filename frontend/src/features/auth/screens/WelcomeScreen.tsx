import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton, TextLink } from '@/shared/components';
import { spacing, useTheme } from '@/shared/theme';
import { WelcomeArt, type WelcomeArtKind } from '../components/WelcomeArt';

const SLIDES: { art: WelcomeArtKind; title: string }[] = [
  { art: 'scoring', title: 'Score every point, live.' },
  { art: 'feed', title: 'Get motivation from your people.' },
  { art: 'ratings', title: 'Track your rating in every sport.' },
  { art: 'chat', title: 'Plan the next game with your crew.' },
];

/** Hero colours are fixed: the orange panel stands in for Strava's hero photo in both themes. */
const HERO = '#FC5200';
const HERO_SHAPE = 'rgba(255,255,255,0.09)';

/**
 * First screen when signed out, after Strava's onboarding: a swipeable hero (wordmark + app mockup),
 * a one-line pitch per slide with page dots, then "Join for free" and "Log In".
 */
export default function WelcomeScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const heroHeight = Math.max(360, Math.round(height * 0.52));

  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    if (next !== page) setPage(next);
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.header }]}>
      <StatusBar style="light" />
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={32}
        style={styles.pager}
      >
        {SLIDES.map((slide) => (
          <View key={slide.art} style={{ width }}>
            <View style={[styles.hero, { height: heroHeight, paddingTop: insets.top + spacing.lg, backgroundColor: HERO }]}>
              <View style={[styles.shape, styles.shapeLarge]} />
              <View style={[styles.shape, styles.shapeSmall]} />
              <Text style={styles.wordmark} accessibilityRole="header" accessibilityLabel="ProjectX">
                PROJECTX
              </Text>
              <View style={styles.art}>
                <WelcomeArt kind={slide.art} />
              </View>
            </View>
            <Text style={[styles.title, { color: colors.text }]}>{slide.title}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.dots} accessibilityLabel={`Slide ${page + 1} of ${SLIDES.length}`}>
          {SLIDES.map((slide, index) => (
            <View key={slide.art} style={[styles.dot, { backgroundColor: index === page ? colors.primary : colors.icon }]} />
          ))}
        </View>
        <PrimaryButton title="Join for free" onPress={() => router.push('/sign-up')} />
        <View style={styles.login}>
          <TextLink title="Log In" onPress={() => router.push('/sign-in')} style={styles.loginText} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  pager: { flexGrow: 1 },
  hero: { alignItems: 'center', overflow: 'hidden' },
  shape: { position: 'absolute', backgroundColor: HERO_SHAPE, borderRadius: 999 },
  shapeLarge: { width: 420, height: 420, top: -120, right: -180 },
  shapeSmall: { width: 260, height: 260, bottom: -90, left: -110 },
  wordmark: { color: '#FFFFFF', fontSize: 30, fontWeight: '900', letterSpacing: 2, fontStyle: 'italic' },
  art: { flex: 1, justifyContent: 'center', paddingBottom: spacing.lg },
  title: {
    fontSize: 26,
    fontWeight: '500',
    lineHeight: 33,
    textAlign: 'center',
    paddingHorizontal: spacing.xxl,
    marginTop: spacing.xl,
  },
  bottom: { paddingHorizontal: spacing.screen + 4, gap: spacing.lg },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.md },
  dot: { width: 8, height: 8, borderRadius: 4 },
  login: { alignItems: 'center', paddingVertical: spacing.sm },
  loginText: { fontSize: 17 },
});
