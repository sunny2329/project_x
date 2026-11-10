import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';
import { useTheme } from '@/shared/theme';
import { D, T } from '@/shared/ui';

/** The design's court is 350 x 230; everything scales from that. */
const W = 350;
const H = 230;
const JERSEY = 'M12 2h5c1.5 5 8.5 5 10 0h5v6c0 4 3 6 6 6v30H6V14c3 0 6-2 6-6z';

/** A half court seen from above the basket: floorboards, the paint, the arc, the rim. */
export function HalfCourt({ width = W, children, overlay }: { width?: number; children?: ReactNode; overlay?: ReactNode }) {
  const { colors } = useTheme();
  const scale = width / W;
  const boards = Math.ceil(W / 25);
  return (
    <View style={{ width, height: H * scale, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.floor }}>
      <Svg width={width} height={H * scale} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0 }}>
        {Array.from({ length: boards }, (_, i) => (
          <Rect key={i} x={i * 25 + 23} y={0} width={2} height={H} fill={colors.floor2} />
        ))}
        <Rect x={117.5} y={0} width={115} height={135} fill={colors.paint} />
        <G fill="none" stroke={colors.cline} strokeWidth={2}>
          <Rect x={1} y={1} width={348} height={250} />
          <Rect x={117.5} y={0} width={115} height={135} />
          <Path d="M133 135 A42 42 0 0 0 217 135" />
          <Path d="M133 135 A42 42 0 0 1 217 135" strokeDasharray="6 6" />
          <Path d="M21 0 V67.5 A157 157 0 0 0 329 67.5 V0" />
          <Path d="M146 37 A29 29 0 0 0 204 37" />
        </G>
        <Line x1={152} y1={28} x2={198} y2={28} stroke={colors.cline} strokeWidth={3} />
        <Circle cx={175} cy={37} r={6.5} fill="none" stroke="#E85D04" strokeWidth={2.5} />
      </Svg>
      {children}
      {overlay}
    </View>
  );
}

/** A shirt with its number: filled in the team colour, dashed red with "?" when it has no number yet. */
export function Jersey({ color, number, size = 42, open = false, empty = false }: { color: string; number: string; size?: number; open?: boolean; empty?: boolean }) {
  const { colors } = useTheme();
  const missing = open || empty;
  return (
    <View style={{ width: size, height: size * (44 / 42), alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size * (44 / 42)} viewBox="0 0 44 46" style={{ position: 'absolute' }}>
        <Path
          d={JERSEY}
          fill={open ? 'rgba(10,10,10,0.25)' : empty ? 'rgba(10,10,10,0.35)' : color}
          stroke={open ? colors.cline : empty ? colors.bad : 'rgba(10,10,10,0.35)'}
          strokeWidth={1.6}
          strokeDasharray={missing ? '3 3' : undefined}
        />
      </Svg>
      <D size={size * 0.45} lh={size * 0.5} color={open ? colors.cline : empty ? colors.bad : '#0A0A0A'} style={{ marginTop: size * 0.18 }}>
        {number}
      </D>
    </View>
  );
}

export interface CourtSpot {
  key: string;
  x: number;
  y: number;
  number: string;
  label: string;
  color: string;
  selected?: boolean;
  open?: boolean;
  empty?: boolean;
  onPress?: () => void;
  accessibilityLabel: string;
}

/** Players on the court drawing: shirt, number and a first-name tag; tap to select. */
export function CourtPlayers({ spots, width = W, small = false }: { spots: CourtSpot[]; width?: number; small?: boolean }) {
  const scale = width / W;
  const box = small ? 60 : 64;
  return (
    <>
      {spots.map((s) => (
        <Pressable
          key={s.key}
          accessibilityRole="button"
          accessibilityLabel={s.accessibilityLabel}
          accessibilityState={{ selected: !!s.selected }}
          disabled={!s.onPress}
          onPress={s.onPress}
          style={{ position: 'absolute', left: (s.x / 100) * W * scale - box / 2, top: (s.y / 100) * H * scale - (small ? 24 : 32), width: box, alignItems: 'center', gap: small ? 1 : 2 }}
        >
          <View
            style={{
              width: small ? 36 : 54,
              height: small ? 38 : 52,
              borderRadius: 27,
              alignItems: 'center',
              justifyContent: 'center',
              ...(s.selected ? { borderWidth: 3, borderColor: '#E85D04', shadowColor: '#E85D04', shadowOpacity: 0.55, shadowRadius: 9, shadowOffset: { width: 0, height: 0 } } : {}),
            }}
          >
            <Jersey color={s.color} number={s.number} size={small ? 36 : 42} open={s.open} empty={s.empty} />
          </View>
          <View style={{ maxWidth: box, paddingHorizontal: small ? 5 : 6, paddingVertical: small ? 0 : 1, borderRadius: small ? 5 : 6, backgroundColor: 'rgba(10,10,10,0.72)' }}>
            <T size={10} w={700} color="#FFFFFF" numberOfLines={1}>
              {s.label}
            </T>
          </View>
        </Pressable>
      ))}
    </>
  );
}
