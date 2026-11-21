import { router } from 'expo-router';
import { useWindowDimensions, View } from 'react-native';
import { useTheme } from '@/shared/theme';
import { Badge, Button, D, Dot, Row, Screen, T, Wordmark } from '@/shared/ui';


/** First screen when signed out: a live-score card, the pitch, Get started / Log in. */
export default function WelcomeScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const scale = Math.min(1, (width - 48) / 342);

  return (
    <Screen px={24} gap={24} top={20} bottom={20}>
      <Row between>
        <Wordmark size={24} />
      </Row>

      <View style={{ height: 236 * scale }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={{ position: 'absolute', left: 22 * scale, top: 14 * scale, width: 300 * scale, height: 200 * scale, borderRadius: 22, backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.line, transform: [{ rotate: '-5deg' }] }} />
        <View
          style={{
            width: 342 * scale,
            padding: 18 * scale,
            borderRadius: 22,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.line,
            gap: 12 * scale,
            shadowColor: '#000',
            shadowOpacity: 0.12,
            shadowRadius: 30,
            shadowOffset: { width: 0, height: 24 },
            elevation: 12,
          }}
        >
          <Row between>
            <Row gap={8}>
              <Dot color={colors.primary} />
              <T size={12} color={colors.muted}>
                Badminton · Doubles · Court 2
              </T>
            </Row>
            <Badge label="LIVE" tone="live" />
          </Row>
          {[
            { name: 'Riya & Kabir', games: '1', points: '20', strong: true },
            { name: 'Arjun & Meera', games: '1', points: '18', strong: false },
          ].map((r) => (
            <Row key={r.name} gap={12}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: r.strong ? colors.primary : 'transparent' }} />
              <T size={16} w={600} flex color={r.strong ? colors.fg : colors.soft}>
                {r.name}
              </T>
              <D size={20} w={700} color={colors.muted} style={{ width: 24, textAlign: 'center' }}>
                {r.games}
              </D>
              <D size={44} lh={44} color={r.strong ? colors.fg : colors.soft} style={{ width: 56, textAlign: 'right' }}>
                {r.points}
              </D>
            </Row>
          ))}
          <Row between style={{ borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12 }}>
            <D size={22} w={800} ls={0.06} color={colors.accentText}>
              MATCH POINT
            </D>
            <T size={12} color={colors.muted}>
              21-17, 18-21
            </T>
          </Row>
        </View>
      </View>

      <View style={{ gap: 12 }}>
        <D size={58 * scale} lh={54 * scale} upper ls={0.005} accessibilityRole="header">
          Tap who won the point.{' '}
          <D size={58 * scale} lh={54 * scale} upper color={colors.accentText}>
            We do the rest.
          </D>
        </D>
        <T size={16} lh={24} color={colors.muted}>
          Scores, serves, brackets, standings and ratings for badminton, table tennis, pickleball, padel, tennis and box cricket.
        </T>
      </View>

      <View style={{ marginTop: 'auto', gap: 12 }}>
        <Button label="Get started" onPress={() => router.push('/signup')} weight={700} />
        <Button label="I already have an account" variant="outline" weight={600} onPress={() => router.push('/login')} />
      </View>
    </Screen>
  );
}
