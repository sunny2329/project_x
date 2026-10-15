import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { sportIcon } from '@/features/match/format';
import { Avatar } from '@/shared/components';
import { spacing } from '@/shared/theme';

/**
 * Illustrations for the welcome carousel: a light-mode "phone screen" card showing one feature,
 * like the app mockup on Strava's onboarding. Colours are fixed (not themed) because the art sits
 * on the orange hero in both themes. The people in them are made-up examples.
 */
const INK = '#242428';
const MUTED = '#6D6D78';
const LINE = '#E8E8EC';
const ORANGE = '#FC5200';

export type WelcomeArtKind = 'scoring' | 'feed' | 'ratings' | 'chat';

export function WelcomeArt({ kind }: { kind: WelcomeArtKind }) {
  return (
    <View style={styles.phone} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.notch} />
      {kind === 'scoring' ? <ScoringArt /> : kind === 'feed' ? <FeedArt /> : kind === 'ratings' ? <RatingsArt /> : <ChatArt />}
    </View>
  );
}

function ScreenTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.screenTitle}>{children}</Text>;
}

function ScoringArt() {
  const rows = [
    { name: 'Aarav S.', games: 1, points: 9 },
    { name: 'Rohan M.', games: 0, points: 6 },
  ];
  return (
    <View style={styles.body}>
      <View style={styles.rowBetween}>
        <View style={styles.live}>
          <Text style={styles.liveText}>LIVE</Text>
        </View>
        <Text style={styles.muted}>Pickleball · Game 2</Text>
      </View>
      {rows.map((row, index) => (
        <View key={row.name} style={[styles.scoreRow, index === 0 && styles.divided]}>
          <Avatar name={row.name} size={30} />
          <Text style={[styles.name, styles.flex]}>{row.name}</Text>
          <Text style={styles.games}>{row.games}</Text>
          <Text style={[styles.points, index === 0 && { color: ORANGE }]}>{row.points}</Text>
        </View>
      ))}
      <View style={styles.buttons}>
        <View style={[styles.scoreButton, { backgroundColor: ORANGE }]}>
          <Text style={styles.scoreButtonText}>+1 Aarav</Text>
        </View>
        <View style={[styles.scoreButton, { backgroundColor: INK }]}>
          <Text style={styles.scoreButtonText}>+1 Rohan</Text>
        </View>
      </View>
    </View>
  );
}

function FeedArt() {
  return (
    <View style={styles.body}>
      <ScreenTitle>Home</ScreenTitle>
      <View style={styles.rowStart}>
        <Avatar name="Priya Nair" size={30} />
        <View>
          <Text style={styles.name}>Priya Nair</Text>
          <Text style={styles.muted}>Today at 6:34 AM · Badminton</Text>
        </View>
      </View>
      <Text style={styles.activityTitle}>Morning Badminton</Text>
      <View style={styles.stats}>
        {[
          ['Score', '2–1'],
          ['Time', '41m'],
          ['Games', '3'],
        ].map(([label, value]) => (
          <View key={label}>
            <Text style={styles.muted}>{label}</Text>
            <Text style={styles.statValue}>{value}</Text>
          </View>
        ))}
      </View>
      <View style={[styles.rowStart, styles.divided, styles.likes]}>
        <MaterialCommunityIcons name="thumb-up" size={14} color={ORANGE} />
        <Text style={styles.muted}>Arjun and 11 others liked this</Text>
      </View>
    </View>
  );
}

function RatingsArt() {
  const sports = [
    { code: 'pickleball', iconKey: 'racquetball', name: 'Pickleball', rating: 1064, change: '+16' },
    { code: 'badminton', iconKey: 'badminton', name: 'Badminton', rating: 1012, change: '+8' },
    { code: 'tennis', iconKey: 'tennis', name: 'Tennis', rating: 998, change: '−4' },
  ];
  return (
    <View style={styles.body}>
      <ScreenTitle>You</ScreenTitle>
      {sports.map((sport, index) => (
        <View key={sport.code} style={[styles.scoreRow, index > 0 && styles.dividedTop]}>
          <View style={styles.sportIcon}>
            <MaterialCommunityIcons name={sportIcon(sport)} size={16} color={ORANGE} />
          </View>
          <Text style={[styles.name, styles.flex]}>{sport.name}</Text>
          <Text style={styles.rating}>{sport.rating}</Text>
          <Text style={[styles.change, { color: sport.change.startsWith('+') ? '#16A34A' : MUTED }]}>{sport.change}</Text>
        </View>
      ))}
    </View>
  );
}

function ChatArt() {
  const messages = [
    { mine: false, text: 'Doubles at 7 tonight?' },
    { mine: true, text: "I'm in. Booking court 2" },
    { mine: false, text: 'Bring the new balls 🏓' },
  ];
  return (
    <View style={styles.body}>
      <ScreenTitle>Sunday Smashers</ScreenTitle>
      {messages.map((message) => (
        <View key={message.text} style={[styles.bubble, message.mine ? styles.mine : styles.theirs]}>
          <Text style={[styles.bubbleText, message.mine && { color: '#FFFFFF' }]}>{message.text}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  phone: {
    width: 236,
    minHeight: 250,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    padding: spacing.md,
    paddingTop: spacing.sm,
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  notch: { alignSelf: 'center', width: 54, height: 5, borderRadius: 3, backgroundColor: LINE, marginBottom: spacing.md },
  body: { gap: spacing.sm + 2 },
  flex: { flex: 1 },
  screenTitle: { fontSize: 15, fontWeight: '800', color: INK },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowStart: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  live: { backgroundColor: '#E5383B', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  liveText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  muted: { fontSize: 10.5, color: MUTED },
  name: { fontSize: 12.5, fontWeight: '700', color: INK },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  divided: { borderBottomWidth: 1, borderBottomColor: LINE },
  dividedTop: { borderTopWidth: 1, borderTopColor: LINE },
  games: { fontSize: 13, fontWeight: '600', color: MUTED, width: 18, textAlign: 'center' },
  points: { fontSize: 22, fontWeight: '800', color: INK, width: 32, textAlign: 'right' },
  buttons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  scoreButton: { flex: 1, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  scoreButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  activityTitle: { fontSize: 16, fontWeight: '800', color: INK },
  stats: { flexDirection: 'row', gap: spacing.xl },
  statValue: { fontSize: 15, fontWeight: '600', color: INK },
  likes: { borderBottomWidth: 0, borderTopWidth: 1, borderTopColor: LINE, paddingTop: spacing.sm },
  sportIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#FFEFE6', alignItems: 'center', justifyContent: 'center' },
  rating: { fontSize: 15, fontWeight: '800', color: INK },
  change: { fontSize: 11, fontWeight: '700', width: 26, textAlign: 'right' },
  bubble: { maxWidth: '82%', borderRadius: 14, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  theirs: { alignSelf: 'flex-start', backgroundColor: '#F0F0F5' },
  mine: { alignSelf: 'flex-end', backgroundColor: ORANGE },
  bubbleText: { fontSize: 12, color: INK },
});
