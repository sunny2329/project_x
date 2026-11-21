/*
 * Design v2 player profile ("Player profile" in Project X App Design.html), shared by my
 * profile tab and another player's page: orange hero, ratings by sport (never mixed), and the
 * per-sport rating, trend and performance sections from GET .../sports/:slug/insights.
 */
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CONFIDENCE_LABEL, overallRating, PLACEMENT_MATCHES, START_RATING, tierFor } from '@/shared/rating';
import { ConfidenceLine, Diamond, RatingPill, RatingRing, TierChip, TierLadder } from '@/shared/rating/Rating';
import { useTheme } from '@/shared/theme';
import { Button, D, ExpandableAvatar, Icon, IconButton, initials, Notice, Sheet, T, Tap, type IconName } from '@/shared/ui';
import { activityGrid, activitySummary, BAND_LABEL, pct, percentileLine, performanceTiles, trendGeometry } from '../insights';
import type { InsightPerson, PlayerSport, SportInsights, Streak, TrendRange } from '../types';

const RANGES: TrendRange[] = ['1M', '3M', '1Y'];
const CHART_W = 318;

function HeroButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Tap
      label={label}
      onPress={onPress}
      style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.heroChip, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name={icon} size={18} color={colors.onHero} />
    </Tap>
  );
}

export interface HeroProps {
  title: string;
  /** Back button for another player's page. */
  onBack?: () => void;
  actions: { icon: IconName; label: string; onPress: () => void }[];
  user: { id: string; fullName: string; username: string; photoUrl: string | null; city: string | null; handedness: 'left' | 'right' | null; bio?: string | null };
  followers: number;
  following: number;
  onFollowers: () => void;
  onFollowing: () => void;
  record: { played: number; won: number; lost: number };
  streak: Streak | null;
  titles: number;
  /** Under the tiles: Follow / Message buttons on another player's page. */
  children?: ReactNode;
}

/** The orange block: title bar, avatar + name, follow counts and four stat tiles. */
export function ProfileHero({ title, onBack, actions, user, followers, following, onFollowers, onFollowing, record, streak, titles, children }: HeroProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const sub = [`@${user.username}`, user.city, user.handedness ? (user.handedness === 'left' ? 'Left-handed' : 'Right-handed') : null].filter(Boolean).join(' · ');
  const decided = record.won + record.lost;
  const tiles = [
    { value: String(record.played), label: 'Matches' },
    { value: decided ? `${Math.round((record.won / decided) * 100)}%` : '—', label: 'Win rate' },
    { value: streak ? `${streak.kind}${streak.count}` : '—', label: 'Streak' },
    { value: String(titles), label: titles === 1 ? 'Title' : 'Titles' },
  ];
  return (
    <View
      style={{
        backgroundColor: colors.hero,
        paddingTop: insets.top + 14,
        paddingHorizontal: 20,
        paddingBottom: 20,
        gap: 16,
        borderBottomLeftRadius: 28,
        borderBottomRightRadius: 28,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {onBack ? <HeroButton icon="back" label="Back" onPress={onBack} /> : null}
          <D size={22} ls={0.02} upper color={colors.onHero} accessibilityRole="header">
            {title}
          </D>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {actions.map((a) => (
            <HeroButton key={a.label} {...a} />
          ))}
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ width: 68, height: 68, borderRadius: 34, borderWidth: 3, borderColor: colors.heroMuted, overflow: 'hidden', backgroundColor: colors.onHero, alignItems: 'center', justifyContent: 'center' }}>
          {user.photoUrl ? (
            <ExpandableAvatar name={user.fullName} id={user.id} photoUrl={user.photoUrl} size={62} caption={`@${user.username}`} />
          ) : (
            <D size={26} color={colors.primary}>
              {initials(user.fullName)}
            </D>
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <D size={30} lh={30} color={colors.onHero} numberOfLines={2}>
            {user.fullName}
          </D>
          <T size={13} color={colors.heroMuted} numberOfLines={1}>
            {sub}
          </T>
          {user.bio?.trim() ? (
            <T size={13} lh={18} color={colors.onHero} numberOfLines={3}>
              {user.bio.trim()}
            </T>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Tap label={`${followers} followers`} onPress={onFollowers} style={{ paddingVertical: 2 }}>
              <T size={12} color={colors.heroMuted}>
                <T size={12} w={700} color={colors.onHero}>
                  {followers}
                </T>{' '}
                {followers === 1 ? 'follower' : 'followers'}
              </T>
            </Tap>
            <T size={12} color={colors.heroMuted}>
              {' · '}
            </T>
            <Tap label={`${following} following`} onPress={onFollowing} style={{ paddingVertical: 2 }}>
              <T size={12} color={colors.heroMuted}>
                <T size={12} w={700} color={colors.onHero}>
                  {following}
                </T>{' '}
                following
              </T>
            </Tap>
          </View>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        {tiles.map((t) => (
          <View key={t.label} style={{ flex: 1, minWidth: 0, backgroundColor: colors.heroChip, borderRadius: 14, padding: 10, gap: 3 }}>
            <D size={24} lh={24} color={colors.onHero} numberOfLines={1} adjustsFontSizeToFit>
              {t.value}
            </D>
            <T size={11} color={colors.heroMuted} numberOfLines={1}>
              {t.label}
            </T>
          </View>
        ))}
      </View>
      {children}
    </View>
  );
}

export function SectionTitle({ title, right }: { title: string; right?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
      <D size={22} w={600} accessibilityRole="header">
        {title}
      </D>
      {typeof right === 'string' ? (
        <T size={12} color={colors.muted}>
          {right}
        </T>
      ) : (
        right
      )}
    </View>
  );
}

/** "Ratings by sport": one chip per sport with its pill; the picked one in orange. */
export function SportChips({ sports, picked, onPick }: { sports: PlayerSport[]; picked: string | null; onPick: (slug: string) => void }) {
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingBottom: 4 }}>
      {sports.map((s) => {
        const on = s.slug === picked;
        return (
          <Tap
            key={s.id}
            label={`${s.name} rating`}
            onPress={() => onPick(s.slug)}
            style={{
              minWidth: 100,
              minHeight: 44,
              gap: 6,
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 16,
              backgroundColor: on ? colors.primary : colors.card,
              borderWidth: 1,
              borderColor: on ? colors.primary : colors.line,
            }}
          >
            <T size={12} w={500} color={on ? colors.onPrimary : colors.fg}>
              {s.name}
            </T>
            <RatingPill rating={s.rating} ratedMatches={s.ratedMatches} delta={s.delta30} onAccent={on} />
          </Tap>
        );
      })}
    </ScrollView>
  );
}

function Card({ children, gap = 12, padding = 16, radius = 18 }: { children: ReactNode; gap?: number; padding?: number; radius?: number }) {
  const { colors } = useTheme();
  return <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius, padding, gap }}>{children}</View>;
}

/** The big card: ring, tier, 30-day change, percentile, confidence, then the trend chart. */
export function RatingCard({ insights: i, sportName, isMe, onStartMatch }: { insights: SportInsights; sportName: string; isMe: boolean; onStartMatch: () => void }) {
  const { colors } = useTheme();
  const [range, setRange] = useState<TrendRange>('3M');
  const tier = i.tier;
  const placed = 3 - i.placementsLeft;
  const values = i.trend[range];
  // Drawn in the design's 318x96 box and stretched to the card width (preserveAspectRatio none).
  const geo = trendGeometry(values, CHART_W, 96);
  const ringLabel = i.provisional
    ? `${sportName} placement, ${placed} of 3 matches played`
    : `${sportName} rating ${i.rating}, ${Math.round((tier?.progress ?? 0) * 100)}% of the way through ${tier?.name ?? ''}`;
  return (
    <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 22, padding: 16, gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <RatingRing
          progress={i.provisional ? placed / 3 : (tier?.progress ?? 0)}
          center={i.provisional ? `${placed}/3` : String(i.rating)}
          label={i.provisional ? 'Placement' : 'Rating'}
          accessibilityLabel={ringLabel}
        />
        <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
          <TierChip name={i.provisional ? 'Provisional' : tier!.name} provisional={i.provisional} />
          {i.provisional ? (
            <T size={13} lh={18} color={colors.muted}>
              {isMe
                ? `Play ${i.placementsLeft} more rated ${i.placementsLeft === 1 ? 'match' : 'matches'} to unlock your ${sportName} rating. Everyone starts at ${START_RATING}.`
                : `${i.placementsLeft} more rated ${i.placementsLeft === 1 ? 'match' : 'matches'} until this ${sportName} rating counts.`}
            </T>
          ) : (
            <>
              <DeltaLine delta={i.delta30} />
              <T size={13} color={colors.muted}>
                {tier!.next ? `${tier!.next.pointsToGo} points to ${tier!.next.name}` : 'Top tier'}
              </T>
              {percentileLine(i.percentile, sportName) ? (
                <T size={13} w={500}>
                  {percentileLine(i.percentile, sportName)}
                </T>
              ) : null}
            </>
          )}
          <ConfidenceLine level={i.confidence} ratedMatches={i.ratedMatches} />
        </View>
      </View>

      {!i.provisional ? (
        <>
          <View style={{ height: 1, backgroundColor: colors.line }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <T size={14} w={700}>
              Rating trend
            </T>
            <View accessibilityRole="tablist" accessibilityLabel="Range" style={{ flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 10, padding: 3 }}>
              {RANGES.map((r) => {
                const on = r === range;
                return (
                  <Tap
                    key={r}
                    label={r}
                    onPress={() => setRange(r)}
                    style={{
                      minWidth: 44,
                      minHeight: 32,
                      borderRadius: 8,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: on ? colors.card : 'transparent',
                      ...(on ? { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 } : {}),
                    }}
                  >
                    <T size={12} w={700} color={on ? colors.fg : colors.muted}>
                      {r}
                    </T>
                  </Tap>
                );
              })}
            </View>
          </View>
          <View style={{ height: 96, justifyContent: 'center' }} accessibilityLabel={geo ? `${sportName} rating over ${range}, from ${values[0]} to ${values.at(-1)}` : undefined}>
            {geo ? (
              <Svg width="100%" height={96} viewBox={`0 0 ${CHART_W} 96`} preserveAspectRatio="none">
                <Line x1={0} y1={8} x2={CHART_W} y2={8} stroke={colors.line} strokeDasharray="3 4" />
                <Line x1={0} y1={88} x2={CHART_W} y2={88} stroke={colors.line} strokeDasharray="3 4" />
                <Path d={geo.area} fill={colors.accentSoft} />
                <Path d={geo.line} fill="none" stroke={colors.primary} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
                <Circle cx={geo.high.x} cy={geo.high.y} r={4} fill={colors.card} stroke={colors.primary} strokeWidth={2} />
                <Circle cx={geo.end.x} cy={geo.end.y} r={5} fill={colors.primary} />
              </Svg>
            ) : (
              <T size={13} color={colors.muted} center>
                No rated matches in the last {range === '1M' ? 'month' : range === '3M' ? '3 months' : 'year'}.
              </T>
            )}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[
              ['Range high', geo ? String(geo.hi) : '—'],
              ['Range low', geo ? String(geo.lo) : '—'],
              ['All-time peak', String(i.peak)],
            ].map(([label, value]) => (
              <View key={label} style={{ flex: 1, gap: 2 }}>
                <T size={11} color={colors.muted}>
                  {label}
                </T>
                <D size={20}>{value}</D>
              </View>
            ))}
          </View>
        </>
      ) : isMe ? (
        <Button label={`Start a rated ${sportName.toLowerCase()} match`} icon="play" height={48} radius={14} onPress={onStartMatch} />
      ) : null}
    </View>
  );
}

function DeltaLine({ delta }: { delta: number }) {
  const { colors } = useTheme();
  const color = delta > 0 ? colors.good : delta < 0 ? colors.bad : colors.muted;
  return (
    <T size={13} w={700} color={color}>
      {delta > 0 ? `▲ ${delta}` : delta < 0 ? `▼ ${Math.abs(delta)}` : 'No change'} in the last 30 days
    </T>
  );
}

function Bar({ value, height = 8 }: { value: number; height?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: colors.surface, overflow: 'hidden' }}>
      <View style={{ height, borderRadius: height / 2, backgroundColor: colors.primary, width: `${Math.round(value * 100)}%` }} />
    </View>
  );
}

/** Everything under the rating card for a placed player. */
export function PerformanceSections({ insights: i, onPerson }: { insights: SportInsights; onPerson: (p: InsightPerson) => void }) {
  const { colors } = useTheme();
  const heat = activityGrid(i.activity);
  const record = `${i.record.won}–${i.record.lost}${i.record.drawn ? `–${i.record.drawn}` : ''}`;
  return (
    <>
      <View style={{ gap: 10 }}>
        <SectionTitle
          title="Performance"
          right={
            <T size={13} color={colors.muted}>
              <T size={13} w={700}>
                {record}
              </T>
              {i.record.winRate === null ? '' : ` · ${i.record.winRate}% won`}
            </T>
          }
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {performanceTiles(i).map((t) => (
            <View key={t.label} style={{ width: '31.5%', flexGrow: 1, backgroundColor: colors.surface, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 10, gap: 4 }}>
              <D size={24} lh={24}>
                {t.value}
              </D>
              <T size={11} lh={14} color={colors.muted}>
                {t.label}
              </T>
            </View>
          ))}
        </View>
      </View>

      <Card padding={14}>
        <View style={{ gap: 2 }}>
          <T size={14} w={700}>
            Win rate by opponent rating
          </T>
          <T size={12} color={colors.muted}>
            Compared with your rating at match time
          </T>
        </View>
        {i.vsStrength.map((v) => {
          const p = pct(v.won, v.lost);
          return (
            <View key={v.band} style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <T size={13}>
                  {BAND_LABEL[v.band].label}{' '}
                  <T size={13} color={colors.muted}>
                    {BAND_LABEL[v.band].range}
                  </T>
                </T>
                <T size={13}>
                  <T size={13} w={700}>
                    {p.text}
                  </T>
                  <T size={13} color={colors.muted}>
                    {` · ${v.won}–${v.lost}`}
                  </T>
                </T>
              </View>
              <Bar value={p.value} />
            </View>
          );
        })}
      </Card>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['singles', 'doubles'] as const).map((k) => {
          const s = i.split[k];
          const p = pct(s.won, s.lost);
          const n = s.won + s.lost;
          return (
            <View key={k} style={{ flex: 1 }}>
              <Card padding={14} gap={8}>
                <T size={12} w={700} ls={0.06} upper color={colors.muted}>
                  {k}
                </T>
                <D size={28} lh={28}>
                  {p.text}
                </D>
                <Bar value={p.value} height={6} />
                <T size={12} color={colors.muted}>
                  {n ? `${s.won}–${s.lost} · ${n} ${n === 1 ? 'match' : 'matches'}` : 'No matches yet'}
                </T>
              </Card>
            </View>
          );
        })}
      </View>

      <Card padding={14} gap={10}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <T size={14} w={700}>
            Form · last {Math.max(i.form.length, 1)}
          </T>
          <T size={12} color={colors.muted}>
            Oldest → latest
          </T>
        </View>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {Array.from({ length: 10 }, (_, n) => {
            const r = i.form[n - (10 - i.form.length)];
            if (!r) return <View key={n} style={{ flex: 1, height: 28, borderRadius: 7, backgroundColor: colors.surface }} />;
            const bg = r === 'W' ? colors.goodBg : r === 'L' ? colors.badBg : colors.surface;
            const fg = r === 'W' ? colors.good : r === 'L' ? colors.bad : colors.muted;
            return (
              <View key={n} accessibilityLabel={r === 'W' ? 'Won' : r === 'L' ? 'Lost' : 'Drew'} style={{ flex: 1, height: 28, borderRadius: 7, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
                <T size={12} w={700} color={fg}>
                  {r}
                </T>
              </View>
            );
          })}
        </View>
      </Card>

      <Card padding={14} gap={10}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <T size={14} w={700}>
            Activity · 12 weeks
          </T>
          <T size={12} color={colors.muted}>
            {activitySummary(i.activity)}
          </T>
        </View>
        <View accessibilityRole="image" accessibilityLabel="Matches per day over the last 12 weeks" style={{ flexDirection: 'row', gap: 4 }}>
          {Array.from({ length: 12 }, (_, week) => (
            <View key={week} style={{ flex: 1, gap: 4 }}>
              {heat.slice(week * 7, week * 7 + 7).map((lvl, d) => (
                <View
                  key={d}
                  style={{ height: 16, borderRadius: 3, backgroundColor: lvl ? colors.primary : colors.surface, opacity: lvl === null ? 0 : lvl ? [0, 0.35, 0.65, 1][lvl] : 1 }}
                />
              ))}
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 4 }}>
          <T size={11} color={colors.muted}>
            Less
          </T>
          {[0, 0.35, 0.65, 1].map((o) => (
            <View key={o} style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: o ? colors.primary : colors.surface, opacity: o || 1 }} />
          ))}
          <T size={11} color={colors.muted}>
            More
          </T>
        </View>
      </Card>

      {i.partner || i.rival ? (
        <View style={{ gap: 8 }}>
          <SectionTitle title={i.partner && i.rival ? 'Best partner & top rival' : i.partner ? 'Best partner' : 'Top rival'} />
          {i.partner ? <PersonRow person={i.partner} kind="Partner" note={`${i.partner.matches} ${i.partner.matches === 1 ? 'match' : 'matches'}`} onPress={() => onPerson(i.partner!)} /> : null}
          {i.rival ? <PersonRow person={i.rival} kind="Rival" note="Head-to-head" vs onPress={() => onPerson(i.rival!)} /> : null}
        </View>
      ) : null}
    </>
  );
}

function PersonRow({ person: p, kind, note, vs, onPress }: { person: InsightPerson; kind: string; note: string; vs?: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Tap
      label={`${kind}: ${p.name}, ${p.won}–${p.lost}`}
      onPress={p.userId ? onPress : undefined}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14 }}
    >
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
        <T size={13} w={700}>
          {initials(p.name)}
        </T>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <T size={14} w={700} numberOfLines={1}>
          {vs ? 'vs' : 'with'} {p.name}
        </T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {p.rating !== null ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2, paddingHorizontal: 7, borderRadius: 7, backgroundColor: colors.accentSoft }}>
              <Diamond size={8} color={colors.accentText} />
              <D size={14} lh={17} color={colors.accentText}>
                {p.rating}
              </D>
            </View>
          ) : (
            <T size={12} color={colors.muted}>
              {p.userId ? 'Unrated' : 'Guest'}
            </T>
          )}
          <T size={12} color={colors.muted}>
            {note}
          </T>
        </View>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <D size={22} lh={22}>
          {p.won}–{p.lost}
        </D>
        <T size={11} color={colors.muted}>
          {kind}
        </T>
      </View>
    </Tap>
  );
}

/** "Overall 1563 · Gold · across 2 sports, 40 rated matches": one number across every sport. */
export function OverallCard({ sports, isMe = true }: { sports: PlayerSport[]; isMe?: boolean }) {
  const { colors } = useTheme();
  const [info, setInfo] = useState(false);
  const o = overallRating(sports);
  if (!o) return null;
  const tier = tierFor(o.rating);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line }}>
      <View style={{ gap: 2 }}>
        <T size={12} w={700} color={colors.muted}>
          Overall rating
        </T>
        <D size={36} lh={38}>
          {o.rating}
        </D>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 6, alignItems: 'flex-start' }}>
        <TierChip name={tier.name} provisional={o.provisional} />
        <T size={12} lh={17} color={colors.muted}>
          {o.provisional ? 'Provisional · ' : ''}Across {o.sports} {o.sports === 1 ? 'sport' : 'sports'}, {o.matches} rated {o.matches === 1 ? 'match' : 'matches'}, weighted by matches played
        </T>
      </View>
      <IconButton icon="info" label="How ratings and tiers work" size={36} iconSize={18} style={{ alignSelf: 'flex-start' }} onPress={() => setInfo(true)} />
      <Sheet visible={info} onClose={() => setInfo(false)} scroll>
        <D size={26}>Rating tiers</D>
        <T size={14} lh={20} color={colors.muted}>
          Everyone starts at {START_RATING}. Beating stronger players moves a rating up faster; the tier follows the rating.
        </T>
        <TierLadder rating={o.rating} who={isMe ? 'You' : 'Overall'} />
        <View style={{ gap: 8 }}>
          {[
            `Overall rating: each sport's rating weighted by how many rated matches you have played in it.`,
            `Your first ${PLACEMENT_MATCHES} matches in a sport are placement: that sport is provisional and left out of the overall once another sport is settled.`,
            'Ratings in each sport are kept separately; the overall is only a summary.',
          ].map((line) => (
            <View key={line} style={{ flexDirection: 'row', gap: 8 }}>
              <T size={14} color={colors.accentText}>
                •
              </T>
              <T size={14} lh={20} flex>
                {line}
              </T>
            </View>
          ))}
        </View>
        <Button label="Got it" height={50} radius={14} onPress={() => setInfo(false)} />
      </Sheet>
    </View>
  );
}

/** Ratings by sport + the picked sport's card and sections, with loading and error states. */
export function SportInsightsBlock({
  sports,
  picked,
  onPick,
  insights,
  loading,
  error,
  isMe,
}: {
  sports: PlayerSport[];
  picked: PlayerSport | null;
  onPick: (slug: string) => void;
  insights: SportInsights | null;
  loading: boolean;
  error: string | null;
  isMe: boolean;
}) {
  const { colors } = useTheme();
  return (
    <>
      <View style={{ gap: 10 }}>
        <OverallCard sports={sports} isMe={isMe} />
        <SectionTitle title="Ratings by sport" right="Tap a sport for details" />
        <SportChips sports={sports} picked={picked?.slug ?? null} onPick={onPick} />
      </View>
      {error ? <Notice tone="error" icon="alert" text={error} /> : null}
      {picked && insights ? (
        <>
          <RatingCard
            insights={insights}
            sportName={picked.name}
            isMe={isMe}
            onStartMatch={() => router.push({ pathname: '/match/new', params: { sport: picked.slug } })}
          />
          {!insights.provisional ? (
            <PerformanceSections
              insights={insights}
              onPerson={(p) => p.userId && router.push({ pathname: '/user/[id]', params: { id: p.userId } })}
            />
          ) : null}
        </>
      ) : loading ? (
        <View style={{ height: 150, borderRadius: 22, backgroundColor: colors.surface }} accessibilityLabel="Loading rating" />
      ) : picked ? (
        <T size={14} color={colors.muted}>
          {CONFIDENCE_LABEL.placement}: no {picked.name.toLowerCase()} matches yet.
        </T>
      ) : null}
    </>
  );
}
