/*
 * Design v2 "Rating · shared component": one anatomy in three sizes.
 *   L RatingRing  (profile hero)   M RatingBar (cards & lists)   S RatingPill (inline, all states)
 * Reading order: number (Barlow, loudest) · tier with diamond · progress to next tier ·
 * 30-day trend (colour plus ▲▼, never colour alone) · confidence bars.
 */
import { View, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '@/shared/theme';
import { D, T } from '@/shared/ui/Text';
import type { Confidence } from '@/features/profile/types';
import { CONFIDENCE_BARS, CONFIDENCE_LABEL, TIERS, tierFor, tierLevel } from './index';

/** The tier diamond (◆), filled with the current text colour. */
export function Diamond({ size = 10, color }: { size?: number; color: string }) {
  return (
    <View aria-hidden>
      <Svg width={size} height={size} viewBox="0 0 10 10">
        <Path d="M5 0 10 5 5 10 0 5z" fill={color} />
      </Svg>
    </View>
  );
}

/** "◆ GOLD" chip. */
export function TierChip({ name, provisional }: { name: string; provisional?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityLabel={`${name} tier`}
      style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, backgroundColor: colors.accentSoft }}
    >
      {provisional ? null : <Diamond size={10} color={colors.accentText} />}
      <T size={12} w={700} ls={0.06} upper color={colors.accentText}>
        {name}
      </T>
    </View>
  );
}

/** Three rising bars; `lit` of them in the accent colour. */
export function ConfidenceBars({ level }: { level: Confidence }) {
  const { colors } = useTheme();
  const lit = CONFIDENCE_BARS[level];
  return (
    <View style={{ flexDirection: 'row', gap: 3, alignItems: 'flex-end' }} aria-hidden>
      {[1, 2, 3].map((n) => (
        <View key={n} style={{ width: 5, height: 4 + n * 4, borderRadius: 2, backgroundColor: n <= lit ? colors.primary : colors.track }} />
      ))}
    </View>
  );
}

export function ConfidenceLine({ level, ratedMatches }: { level: Confidence; ratedMatches: number }) {
  const { colors } = useTheme();
  const detail = level === 'placement' ? `${Math.min(ratedMatches, 3)} of 3 played` : `${ratedMatches} rated`;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <ConfidenceBars level={level} />
      <T size={12} color={colors.muted}>
        {CONFIDENCE_LABEL[level]} · {detail}
      </T>
    </View>
  );
}

/** The ring: `progress` (0-1) of the circle in the accent colour, number and label inside. */
export function RatingRing({ progress, center, label, size = 112, accessibilityLabel }: { progress: number; center: string; label: string; size?: number; accessibilityLabel: string }) {
  const { colors } = useTheme();
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size }} accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <Svg width={size} height={size} viewBox="0 0 120 120">
        <Circle cx={60} cy={60} r={r} fill="none" stroke={colors.track} strokeWidth={10} />
        {progress > 0 ? (
          <Circle
            cx={60}
            cy={60}
            r={r}
            fill="none"
            stroke={colors.primary}
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={`${(c * Math.min(1, progress)).toFixed(1)} ${c.toFixed(1)}`}
            transform="rotate(-90 60 60)"
          />
        ) : null}
      </Svg>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        <D size={size * 0.32} lh={size * 0.34}>
          {center}
        </D>
        <T size={10} w={700} ls={0.08} upper color={colors.muted}>
          {label}
        </T>
      </View>
    </View>
  );
}

/** "▲ 34 in the last 30 days" (green up, red down, muted when flat). */
export function DeltaText({ delta, suffix = ' in the last 30 days', size = 13 }: { delta: number; suffix?: string; size?: number }) {
  const { colors } = useTheme();
  const d = Math.round(delta);
  const color = d > 0 ? colors.good : d < 0 ? colors.bad : colors.muted;
  return (
    <T size={size} w={700} color={color}>
      {d > 0 ? `▲ ${d}` : d < 0 ? `▼ ${Math.abs(d)}` : 'No change'}
      {suffix}
    </T>
  );
}

/** M · cards & lists: number, tier, 30-day change, bar to the next tier. */
export function RatingBar({ rating, ratedMatches, delta30, sportName, style }: { rating: number; ratedMatches: number; delta30: number; sportName: string; style?: ViewStyle }) {
  const { colors } = useTheme();
  const tier = tierFor(rating);
  const provisional = ratedMatches < 3;
  return (
    <View style={[{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 14, gap: 10 }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <D size={28} lh={30}>
          {provisional ? `${ratedMatches}/3` : Math.round(rating)}
        </D>
        <Diamond size={9} color={colors.accentText} />
        <T size={12} w={700} ls={0.06} upper color={colors.accentText} flex>
          {provisional ? 'Provisional' : tier.name}
        </T>
        {!provisional && delta30 !== 0 ? (
          <T size={13} w={700} color={delta30 > 0 ? colors.good : colors.bad}>
            {delta30 > 0 ? `▲ ${delta30}` : `▼ ${Math.abs(delta30)}`}
          </T>
        ) : null}
      </View>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.track, overflow: 'hidden' }}>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.primary, width: `${Math.round((provisional ? ratedMatches / 3 : tier.progress) * 100)}%` }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T size={12} color={colors.muted}>
          {sportName} · {ratedMatches} rated
        </T>
        <T size={12} color={colors.muted}>
          {provisional ? `${3 - ratedMatches} to go` : tier.next ? `${tier.next.pointsToGo} to ${tier.next.name}` : 'Top tier'}
        </T>
      </View>
    </View>
  );
}

export type PillState = 'rising' | 'falling' | 'steady' | 'placement' | 'unrated';

/**
 * S · inline pill. Rated (rising ▲ / falling ▼ / steady), placement ("◇ Prov. 1/3", dashed) or
 * unrated ("— Unrated"). `onAccent` draws it on an orange fill (selected chips).
 */
export function RatingPill({
  rating,
  ratedMatches,
  delta = 0,
  size = 17,
  onAccent = false,
  unrated = false,
}: {
  rating: number | null;
  ratedMatches: number;
  delta?: number;
  size?: number;
  onAccent?: boolean;
  /** Never played this sport. */
  unrated?: boolean;
}) {
  const { colors } = useTheme();
  const base: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2, paddingHorizontal: 8, borderRadius: 8, alignSelf: 'flex-start' };
  if (unrated || rating === null) {
    return (
      <View style={[base, { backgroundColor: onAccent ? 'rgba(255,255,255,0.18)' : colors.surface }]} accessibilityLabel="Unrated">
        <D size={size} lh={size * 1.2} color={onAccent ? colors.onPrimary : colors.muted}>
          — Unrated
        </D>
      </View>
    );
  }
  if (ratedMatches < 3) {
    return (
      <View
        style={[base, { borderWidth: 1, borderStyle: 'dashed', borderColor: onAccent ? colors.onPrimary : colors.muted, paddingVertical: 1, paddingHorizontal: 7 }]}
        accessibilityLabel={`Provisional, ${ratedMatches} of 3 placement matches`}
      >
        <D size={size} lh={size * 1.2} color={onAccent ? colors.onPrimary : colors.muted}>
          ◇ Prov. {ratedMatches}/3
        </D>
      </View>
    );
  }
  const r = Math.round(rating);
  const arrow = delta > 0 ? ' ▲' : delta < 0 ? ' ▼' : '';
  const fg = onAccent ? colors.onPrimary : colors.accentText;
  return (
    <View
      style={[base, { backgroundColor: onAccent ? 'rgba(255,255,255,0.18)' : colors.accentSoft }]}
      accessibilityLabel={`Rating ${r}${delta > 0 ? ', rising' : delta < 0 ? ', falling' : ''}`}
    >
      <Diamond size={Math.round(size * 0.53)} color={fg} />
      <D size={size} lh={size * 1.2} color={fg}>
        {r}
        {arrow}
      </D>
    </View>
  );
}

/** The six-step ladder with the player's tier highlighted. */
export function TierLadder({ rating }: { rating: number | null }) {
  const { colors } = useTheme();
  const mine = rating === null ? null : tierFor(rating).key;
  return (
    <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 6 }}>
      {TIERS.map((t, i) => {
        const on = t.key === mine;
        const level = tierLevel(t.key) + 1;
        return (
          <View
            key={t.key}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingVertical: 10,
              paddingHorizontal: 10,
              borderRadius: 12,
              backgroundColor: on ? colors.accentSoft : 'transparent',
              borderTopWidth: i && !on ? 1 : 0,
              borderTopColor: colors.line,
            }}
          >
            <View style={{ width: 86 }}>
              <T size={12} w={700} ls={0.06} upper color={on ? colors.accentText : colors.fg}>
                {t.name}
              </T>
              {on && rating !== null ? (
                <T size={11} color={colors.accentText}>
                  You · {Math.round(rating)}
                </T>
              ) : null}
            </View>
            <View style={{ flex: 1, flexDirection: 'row', gap: 4 }}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <View key={n} style={{ flex: 1, maxWidth: 18, height: 6, borderRadius: 3, backgroundColor: n <= level ? colors.primary : colors.track }} />
              ))}
            </View>
            <T size={12} color={on ? colors.accentText : colors.muted} right style={{ width: 82 }}>
              {t.range}
            </T>
          </View>
        );
      })}
    </View>
  );
}
