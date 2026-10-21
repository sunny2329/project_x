import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CourtBackground, WelcomeArt, type WelcomeArtKind } from '../components/WelcomeArt';

const SLIDES: { art: WelcomeArtKind; title: string }[] = [
  { art: 'scoring', title: 'Score every point, live.' },
  { art: 'feed', title: 'Get motivation from your people.' },
  { art: 'ratings', title: 'Track your rating in every sport.' },
  { art: 'chat', title: 'Plan the next game with your crew.' },
];

/** Fixed, not themed: the welcome screen is dark in both themes (designs in `pics/0x · …@2x.png`). */
const PAGE = '#0B0B0B';
const ORANGE = '#FF5B14';
const INK = '#141414';

/** Dots + "Join for free" + "Log in", which stay put while the slides move behind them. */
const CONTROLS_HEIGHT = 6 + 28 + 56 + 12 + 44;

/**
 * First screen when signed out: swipeable slides (court background, wordmark, a phone mockup of
 * one feature, a one-line pitch), page dots, then "Join for free" and "Log in".
 */
export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const controlsSpace = CONTROLS_HEIGHT + insets.bottom + 16;

  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    if (next !== page) setPage(next);
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={32}
        style={StyleSheet.absoluteFill}
      >
        {SLIDES.map((slide) => (
          <View key={slide.art} style={{ width, height }}>
            <CourtBackground kind={slide.art} width={width} height={Math.round(height * 0.7)} />
            <Text style={[styles.wordmark, { marginTop: insets.top + 14 }]} accessibilityRole="header" accessibilityLabel="ProjectX">
              PROJECT<Text style={styles.wordmarkX}>X</Text>
            </Text>
            <View style={styles.art}>
              <WelcomeArt kind={slide.art} />
            </View>
            <View style={[styles.titleBox, { marginBottom: controlsSpace }]}>
              <Text style={styles.title}>{slide.title}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.controls, { paddingBottom: insets.bottom + 16 }]} pointerEvents="box-none">
        <View style={styles.dots} accessibilityLabel={`Slide ${page + 1} of ${SLIDES.length}`}>
          {SLIDES.map((slide, index) => (
            <View key={slide.art} style={index === page ? styles.dotActive : styles.dot} />
          ))}
        </View>
        <Pressable
          onPress={() => router.push('/sign-up')}
          accessibilityRole="button"
          accessibilityLabel="Join for free"
          style={({ pressed }) => [styles.join, pressed && styles.pressed]}
        >
          <Text style={styles.joinText}>Join for free</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/sign-in')}
          accessibilityRole="button"
          accessibilityLabel="Log in"
          hitSlop={8}
          style={({ pressed }) => [styles.login, pressed && styles.pressed]}
        >
          <Text style={styles.loginText}>Log in</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PAGE },
  wordmark: {
    alignSelf: 'center',
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: 1,
  },
  wordmarkX: { color: ORANGE },
  art: { flex: 1, alignItems: 'center', marginTop: 24, marginBottom: 36 },
  titleBox: { minHeight: 70, justifyContent: 'flex-end', paddingHorizontal: 28 },
  title: {
    color: '#F5F5F5',
    fontSize: 27,
    fontWeight: '600',
    lineHeight: 33,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  controls: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 24 },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, height: 6, marginBottom: 28 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#3A3A3A' },
  dotActive: { width: 22, height: 6, borderRadius: 3, backgroundColor: ORANGE },
  join: { height: 56, borderRadius: 28, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
  joinText: { color: INK, fontSize: 17, fontWeight: '600' },
  login: { height: 44, marginTop: 12, alignItems: 'center', justifyContent: 'center' },
  loginText: { color: ORANGE, fontSize: 17, fontWeight: '600' },
  pressed: { opacity: 0.8 },
});
