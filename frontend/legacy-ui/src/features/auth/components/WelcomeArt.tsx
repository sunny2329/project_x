import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Polygon, Polyline, Rect, Stop } from 'react-native-svg';
import { sportIcon } from '@/features/match/format';

/**
 * Artwork for the welcome carousel (designs: `pics/01 · Live scoring@2x.png` … `04 · Crew@2x.png`):
 * a court in perspective on a per-slide colour, and a light-mode phone mockup of one feature.
 * Colours are fixed, not themed: the welcome screen is dark in both themes. The people are made up.
 */
const INK = '#141414';
const MUTED = '#6E6E6E';
const LINE = '#EAEAE8';
const SURFACE = '#F4F4F2';
const ORANGE = '#FF5B14';
const RUST = '#C2410C';
const GREEN = '#15803D';
const PAGE = '#0B0B0B';

export type WelcomeArtKind = 'scoring' | 'feed' | 'ratings' | 'chat';

// ------------------------------------------------------------------------------------------
// Background: the court
// ------------------------------------------------------------------------------------------

const PALETTES: Record<WelcomeArtKind, { base: string; lit: string }> = {
  scoring: { base: '#1F3F66', lit: '#2F619A' },
  feed: { base: '#1C4636', lit: '#2A6B4D' },
  ratings: { base: '#8A3A1D', lit: '#B9562C' },
  chat: { base: '#1B1D2F', lit: '#2C2F4E' },
};

/** Drawn on a 390 x 600 canvas (the design's width) and scaled to cover the slide. */
const W = 390;
const H = 600;
const TOP = 150; // far baseline of the court
const BOTTOM = 560; // near baseline (below the fade)

/** x of the court's left edge at height y, for an edge `inset` (0..1) of the way to the centre. */
function edgeX(y: number, inset: number): number {
  const t = (y - TOP) / (BOTTOM - TOP);
  const halfWidth = 109 + t * (255 - 109); // half-width grows from far to near baseline
  return W / 2 - halfWidth * (1 - inset);
}

function crossLine(y: number, inset = 0) {
  return { x1: edgeX(y, inset), x2: W - edgeX(y, inset), y1: y, y2: y };
}

export function CourtBackground({ kind, width, height }: { kind: WelcomeArtKind; width: number; height: number }) {
  const { base, lit } = PALETTES[kind];
  const sideline = (inset: number) => [
    { x1: edgeX(TOP, inset), y1: TOP, x2: edgeX(BOTTOM, inset), y2: BOTTOM },
    { x1: W - edgeX(TOP, inset), y1: TOP, x2: W - edgeX(BOTTOM, inset), y2: BOTTOM },
  ];
  const litTop = 250;
  const litBottom = 400;

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMin slice" style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={base} />
          <Stop offset="1" stopColor={base} stopOpacity="0.85" />
        </LinearGradient>
        <LinearGradient id="lit" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={lit} stopOpacity="0.35" />
          <Stop offset="0.6" stopColor={lit} stopOpacity="1" />
          <Stop offset="1" stopColor={lit} stopOpacity="0.6" />
        </LinearGradient>
        <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0.45" stopColor={PAGE} stopOpacity="0" />
          <Stop offset="0.8" stopColor={PAGE} stopOpacity="0.92" />
          <Stop offset="1" stopColor={PAGE} stopOpacity="1" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width={W} height={H} fill="url(#sky)" />
      <Polygon
        points={`${edgeX(litTop, 0)},${litTop} ${W - edgeX(litTop, 0)},${litTop} ${W - edgeX(litBottom, 0)},${litBottom} ${edgeX(litBottom, 0)},${litBottom}`}
        fill="url(#lit)"
      />
      {[...sideline(0), ...sideline(0.12)].map((l, i) => (
        <Line key={`s${i}`} {...l} stroke="#FFFFFF" strokeOpacity={0.75} strokeWidth={2} />
      ))}
      <Line {...crossLine(litTop, 0.12)} stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={1.5} />
      <Line {...crossLine(312)} stroke="#FFFFFF" strokeOpacity={0.85} strokeWidth={3} />
      <Line {...crossLine(380)} stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={1.5} />
      {kind === 'chat' ? (
        <>
          <Circle cx={60} cy={40} r={5} fill="#FFF3D6" />
          <Circle cx={330} cy={40} r={5} fill="#FFF3D6" />
        </>
      ) : null}
      <Rect x="0" y="0" width={W} height={H} fill="url(#fade)" />
    </Svg>
  );
}

// ------------------------------------------------------------------------------------------
// The phone mockup
// ------------------------------------------------------------------------------------------

export function WelcomeArt({ kind }: { kind: WelcomeArtKind }) {
  return (
    <View style={styles.bezel} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.screen, kind === 'feed' && { backgroundColor: SURFACE }]}>
        {kind === 'scoring' ? <ScoringArt /> : kind === 'feed' ? <FeedArt /> : kind === 'ratings' ? <RatingsArt /> : <ChatArt />}
      </View>
    </View>
  );
}

function Header({ left, center, right }: { left?: ReactNode; center?: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerSide}>{left}</View>
      {center ? <View style={styles.headerCenter}>{center}</View> : null}
      <View style={[styles.headerSide, styles.headerRight]}>{right}</View>
    </View>
  );
}

const TINTS = {
  grey: { bg: '#F0F0EE', fg: INK },
  green: { bg: '#E2EFE6', fg: '#24613F' },
  peach: { bg: '#FDEAE2', fg: RUST },
};

function Initials({ text, tint = 'grey', size = 28, ring = false }: { text: string; tint?: keyof typeof TINTS; size?: number; ring?: boolean }) {
  return (
    <View
      style={[
        styles.initials,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: TINTS[tint].bg },
        ring && styles.initialsRing,
      ]}
    >
      <Text style={[styles.initialsText, { color: TINTS[tint].fg, fontSize: size * 0.38 }]}>{text}</Text>
    </View>
  );
}

function ScoringArt() {
  const rows = [
    { initials: 'AS', name: 'Aarav S.', games: 1, points: 9, leads: true },
    { initials: 'RM', name: 'Rohan M.', games: 0, points: 6, leads: false },
  ];
  return (
    <>
      <Header left={<Text style={styles.headerMuted}>Close</Text>} center={<Text style={styles.headerTitle}>Live match</Text>} right={<MaterialCommunityIcons name="dots-horizontal" size={18} color={INK} />} />
      <View style={styles.body}>
        <View style={styles.rowBetween}>
          <View style={styles.row}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
          <Text style={styles.meta}>Pickleball · Game 2</Text>
        </View>
        <View>
          {rows.map((row, index) => (
            <View key={row.name} style={[styles.scoreRow, index === 0 && styles.divided]}>
              <Initials text={row.initials} />
              <Text style={[styles.player, styles.flex]}>{row.name}</Text>
              <Text style={styles.games}>{row.games}</Text>
              <Text style={[styles.points, row.leads && { color: RUST }]}>{row.points}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.prompt}>Who won the point?</Text>
        <View style={styles.row}>
          <View style={[styles.pill, styles.flex, { backgroundColor: ORANGE }]}>
            <Text style={[styles.pillText, { color: INK }]}>+1 Aarav</Text>
          </View>
          <View style={[styles.pill, styles.flex, { backgroundColor: INK }]}>
            <Text style={[styles.pillText, { color: '#FFFFFF' }]}>+1 Rohan</Text>
          </View>
        </View>
        <Text style={styles.caps}>GAMES</Text>
        {[
          ['Game 1', '11–7 · Aarav'],
          ['Game 2', '9–6 · live'],
        ].map(([label, value]) => (
          <View key={label} style={styles.gameRow}>
            <Text style={styles.gameLabel}>{label}</Text>
            <Text style={styles.gameValue}>{value}</Text>
          </View>
        ))}
      </View>
    </>
  );
}

function FeedArt() {
  return (
    <>
      <Header left={<Text style={styles.headerTitleLeft}>Home</Text>} right={<MaterialCommunityIcons name="bell-outline" size={17} color={INK} />} />
      <View style={styles.body}>
        <View style={styles.card}>
          <View style={styles.row}>
            <Initials text="PN" tint="green" />
            <View>
              <Text style={styles.player}>Priya Nair</Text>
              <Text style={styles.meta}>Today, 6:34 AM · Badminton</Text>
            </View>
          </View>
          <Text style={styles.activity}>Morning Badminton</Text>
          <View style={styles.stats}>
            {[
              ['Score', '2–1'],
              ['Time', '41m'],
              ['Games', '3'],
            ].map(([label, value]) => (
              <View key={label} style={styles.flex}>
                <Text style={styles.meta}>{label}</Text>
                <Text style={styles.statValue}>{value}</Text>
              </View>
            ))}
          </View>
          <View style={[styles.row, styles.likes]}>
            <MaterialCommunityIcons name="thumb-up-outline" size={13} color={RUST} />
            <Text style={styles.meta}>
              <Text style={styles.metaStrong}>Arjun</Text> and 11 others
            </Text>
          </View>
        </View>
        <View style={styles.card}>
          <View style={styles.row}>
            <Initials text="KL" tint="peach" />
            <View>
              <Text style={styles.player}>Kabir L.</Text>
              <Text style={styles.meta}>Yesterday · Pickleball</Text>
            </View>
          </View>
          <Text style={styles.activity}>Evening Doubles</Text>
        </View>
      </View>
    </>
  );
}

const TREND = [0, 6, 4, 18, 15, 30, 27, 44, 54];

function Sparkline({ width, height }: { width: number; height: number }) {
  const max = Math.max(...TREND);
  const points = TREND.map((v, i) => `${(i / (TREND.length - 1)) * width},${height - 2 - (v / max) * (height - 4)}`).join(' ');
  return (
    <Svg width={width} height={height}>
      <Polyline points={points} fill="none" stroke={RUST} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

function RatingsArt() {
  const sports = [
    { name: 'Pickleball', iconKey: 'racquetball', selected: true },
    { name: 'Badminton', iconKey: 'badminton', selected: false },
    { name: 'Tennis', iconKey: 'tennis', selected: false },
  ];
  return (
    <>
      <Header left={<Text style={styles.headerTitleLeft}>You</Text>} right={<Text style={styles.headerMuted}>This week</Text>} />
      <View style={styles.body}>
        <View style={styles.rowBetween}>
          {sports.map((sport) => (
            <View key={sport.name} style={styles.sport}>
              <View style={[styles.sportCircle, sport.selected && styles.sportSelected]}>
                <MaterialCommunityIcons name={sportIcon(sport)} size={18} color={sport.selected ? RUST : INK} />
              </View>
              <Text style={[styles.sportName, sport.selected && styles.sportNameSelected]}>{sport.name}</Text>
            </View>
          ))}
        </View>
        <View style={styles.ratingCard}>
          <Text style={styles.caps}>PICKLEBALL RATING</Text>
          <View style={[styles.row, styles.ratingLine]}>
            <Text style={styles.rating}>1064</Text>
            <View style={styles.chip}>
              <Text style={styles.chipText}>+16</Text>
            </View>
          </View>
          <Sparkline width={176} height={36} />
        </View>
        <View>
          {[
            { name: 'Badminton', rating: 1012, change: '+8' },
            { name: 'Tennis', rating: 998, change: '−4' },
          ].map((row, index) => (
            <View key={row.name} style={[styles.listRow, index === 0 && styles.divided]}>
              <Text style={styles.gameLabel}>{row.name}</Text>
              <Text style={styles.gameValue}>
                {row.rating} <Text style={{ color: row.change.startsWith('+') ? GREEN : MUTED }}>{row.change}</Text>
              </Text>
            </View>
          ))}
        </View>
      </View>
    </>
  );
}

function ChatArt() {
  return (
    <>
      <Header
        left={<Text style={styles.headerTitleLeft}>Sunday Smashers</Text>}
        right={
          <View style={styles.row}>
            <Initials text="AS" size={22} ring />
            <View style={styles.overlap}>
              <Initials text="PN" tint="green" size={22} ring />
            </View>
            <View style={styles.overlap}>
              <Initials text="RM" tint="peach" size={22} ring />
            </View>
          </View>
        }
      />
      <View style={styles.body}>
        <View style={[styles.bubble, styles.theirs]}>
          <Text style={styles.bubbleText}>Doubles at 7 tonight?</Text>
        </View>
        <View style={[styles.bubble, styles.mine]}>
          <Text style={styles.bubbleText}>I’m in. Booking court 2</Text>
        </View>
        <View style={styles.gameCard}>
          <Text style={styles.caps}>GAME</Text>
          <Text style={styles.activity}>Doubles · Tonight 7:00</Text>
          <Text style={styles.meta}>Court 2 · 3 of 4 in</Text>
          <View style={styles.slots}>
            {[true, true, true, false].map((taken, i) => (
              <View key={i} style={[styles.slot, { backgroundColor: taken ? RUST : LINE }]} />
            ))}
          </View>
          <View style={[styles.pill, { backgroundColor: INK }]}>
            <Text style={[styles.pillText, { color: '#FFFFFF' }]}>Join game</Text>
          </View>
        </View>
        <View style={[styles.bubble, styles.theirs]}>
          <Text style={styles.bubbleText}>Bring the new balls</Text>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  bezel: {
    flex: 1,
    width: 244,
    padding: 6,
    borderRadius: 34,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  screen: { flex: 1, borderRadius: 28, backgroundColor: '#FFFFFF', overflow: 'hidden' },
  header: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  headerSide: { flex: 1, flexDirection: 'row' },
  headerRight: { justifyContent: 'flex-end' },
  headerCenter: { flex: 1.4, alignItems: 'center' },
  headerTitle: { fontSize: 13, fontWeight: '600', color: INK },
  headerTitleLeft: { fontSize: 14, fontWeight: '700', color: INK },
  headerMuted: { fontSize: 12, color: MUTED },
  body: { padding: 14, gap: 10 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  divided: { borderBottomWidth: 1, borderBottomColor: LINE },

  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#E2551B', marginRight: -3 },
  liveText: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, color: '#E2551B' },
  meta: { fontSize: 10.5, color: MUTED },
  metaStrong: { fontWeight: '700', color: INK },
  player: { fontSize: 12.5, fontWeight: '500', color: INK },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  games: { fontSize: 11, color: MUTED, width: 24, textAlign: 'center' },
  points: { fontSize: 30, fontWeight: '600', color: INK, width: 34, textAlign: 'right' },
  prompt: { fontSize: 11.5, color: MUTED, textAlign: 'center' },
  pill: { height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  pillText: { fontSize: 12.5, fontWeight: '600' },
  caps: { fontSize: 9.5, fontWeight: '600', letterSpacing: 1.2, color: MUTED },
  gameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: SURFACE, borderRadius: 10, paddingHorizontal: 10, height: 32 },
  gameLabel: { fontSize: 12, color: INK },
  gameValue: { fontSize: 12, fontWeight: '700', color: INK },

  initials: { alignItems: 'center', justifyContent: 'center' },
  initialsRing: { borderWidth: 1.5, borderColor: '#FFFFFF' },
  initialsText: { fontWeight: '700' },
  overlap: { marginLeft: -14 },

  card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, gap: 8 },
  activity: { fontSize: 14.5, fontWeight: '600', color: INK },
  stats: { flexDirection: 'row' },
  statValue: { fontSize: 16, fontWeight: '600', color: INK, marginTop: 2 },
  likes: { borderTopWidth: 1, borderTopColor: LINE, paddingTop: 8, gap: 6 },

  sport: { alignItems: 'center', gap: 5 },
  sportCircle: { width: 46, height: 46, borderRadius: 23, backgroundColor: SURFACE, alignItems: 'center', justifyContent: 'center' },
  sportSelected: { backgroundColor: '#FFF1EA', borderWidth: 1.5, borderColor: RUST },
  sportName: { fontSize: 10.5, color: '#3A3A3A' },
  sportNameSelected: { color: RUST, fontWeight: '600' },
  ratingCard: { backgroundColor: SURFACE, borderRadius: 12, padding: 12, gap: 6 },
  ratingLine: { gap: 8 },
  rating: { fontSize: 30, fontWeight: '700', color: INK, letterSpacing: -0.5 },
  chip: { backgroundColor: '#E3F2E7', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  chipText: { fontSize: 11, fontWeight: '600', color: GREEN },
  listRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9 },

  bubble: { maxWidth: '82%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  theirs: { alignSelf: 'flex-start', backgroundColor: '#F0F0EE' },
  mine: { alignSelf: 'flex-end', backgroundColor: ORANGE },
  bubbleText: { fontSize: 11.5, color: INK },
  gameCard: { borderWidth: 1, borderColor: LINE, borderRadius: 14, padding: 12, gap: 5 },
  slots: { flexDirection: 'row', gap: 4, marginVertical: 4 },
  slot: { flex: 1, height: 3, borderRadius: 2 },
});
