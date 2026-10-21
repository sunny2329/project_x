import Svg, { Circle, Path, Rect } from 'react-native-svg';

type Shape = { p: string; w?: number } | { c: [number, number, number] } | { r: [number, number, number, number, number] };

/** Stroke icons copied from the ProjectX-UI designs (24x24, 1.9 stroke, round caps). */
const ICONS = {
  back: [{ p: 'M15 18l-6-6 6-6' }],
  close: [{ p: 'M6 6l12 12M18 6 6 18' }],
  chevronRight: [{ p: 'M9 6l6 6-6 6' }],
  chevronDown: [{ p: 'M6 9l6 6 6-6' }],
  plus: [{ p: 'M12 5v14M5 12h14' }],
  check: [{ p: 'M5 12l5 5 9-10' }],
  share: [{ p: 'M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v14' }],
  undo: [{ p: 'M9 14 4 9l5-5' }, { p: 'M4 9h10a6 6 0 0 1 0 12h-3' }],
  chat: [{ p: 'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z' }],
  trophy: [{ p: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3' }],
  cup: [{ p: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z' }],
  search: [{ c: [11, 11, 7] }, { p: 'm20 20-4-4' }],
  pen: [{ p: 'M4 20h4L19 9l-4-4L4 16z' }],
  drag: [{ p: 'M8 6h.01M16 6h.01M8 12h.01M16 12h.01M8 18h.01M16 18h.01', w: 3 }],
  eye: [{ p: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z' }, { c: [12, 12, 3] }],
  clock: [{ c: [12, 12, 9] }, { p: 'M12 7v5l3 2' }],
  court: [{ r: [3, 5, 18, 14, 1] }, { p: 'M12 5v14M3 12h18' }],
  courtHalf: [{ r: [3, 5, 18, 14, 1] }, { p: 'M12 5v14' }],
  phone: [{ r: [7, 2, 10, 20, 2] }, { p: 'M11 18h2' }],
  shuffle: [{ p: 'M3 7h4l10 10h4M3 17h4l3-3M14 10l3-3h4M18 4l3 3-3 3M18 14l3 3-3 3' }],
  sliders: [{ p: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12' }, { c: [16, 6, 2] }, { c: [10, 12, 2] }, { c: [18, 18, 2] }],
  person: [{ c: [12, 8, 4] }, { p: 'M4 21a8 8 0 0 1 16 0' }],
  people: [{ c: [9, 8, 3.5] }, { p: 'M2 20a7 7 0 0 1 14 0M16 4.5a3.5 3.5 0 0 1 0 7' }],
  personSmall: [{ c: [9, 8, 3.5] }, { p: 'M2 20a7 7 0 0 1 14 0' }],
  personAdd: [{ c: [9, 8, 3.5] }, { p: 'M2 20a7 7 0 0 1 14 0M19 8v6M16 11h6' }],
  flag: [{ p: 'M5 21V4h11l-2 4 2 4H5' }],
  send: [{ p: 'M4 12 20 4l-6 16-3-7z' }],
  heart: [{ p: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z' }],
  info: [{ c: [12, 12, 9] }, { p: 'M12 11v5M12 8v.5' }],
  alert: [{ c: [12, 12, 9] }, { p: 'M12 7v6M12 16.5v.5' }],
  calendar: [{ r: [3, 5, 18, 16, 2] }, { p: 'M3 10h18M8 3v4M16 3v4' }],
  pin: [{ p: 'M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z' }, { c: [12, 9, 2.5] }],
  copy: [{ r: [8, 8, 12, 12, 2] }, { p: 'M4 16V6a2 2 0 0 1 2-2h10' }],
  photo: [{ r: [3, 5, 18, 14, 2] }, { c: [9, 10, 2] }, { p: 'm21 16-5-5-8 8' }],
  pulse: [{ p: 'M3 12h4l3-8 4 16 3-8h4' }],
  trend: [{ p: 'M3 17l6-6 4 4 8-8M15 7h6v6' }],
  rematch: [{ p: 'M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5' }],
  coin: [{ c: [12, 12, 9] }, { p: 'M12 3v18' }],
  crown: [{ p: 'M3 8l4 4 5-7 5 7 4-4-2 11H5z' }],
  ban: [{ c: [12, 12, 9] }, { p: 'M5.6 5.6l12.8 12.8' }],
  trash: [{ p: 'M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14' }],
  lock: [{ r: [5, 11, 14, 10, 2] }, { p: 'M8 11V7a4 4 0 0 1 8 0v4' }],
  arrowRight: [{ p: 'M5 12h14M13 6l6 6-6 6' }],
  snake: [{ p: 'M4 6h14l-3-3M20 12H6l3 3M4 18h14l-3-3' }],
  home: [{ p: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' }],
  // Sports
  badminton: [{ c: [12, 18, 3] }, { p: 'M10 15.5 7 4M14 15.5 17 4M12 15V4M7 4h10' }],
  'table-tennis': [{ c: [10, 10, 6] }, { p: 'm14.5 14.5 5 5' }, { c: [19, 5, 1.5] }],
  pickleball: [{ c: [12, 12, 8] }, { c: [9, 9, 1] }, { c: [15, 10, 1] }, { c: [11, 15, 1] }, { c: [15.5, 15, 1] }],
  padel: [{ r: [6, 2, 12, 13, 6] }, { p: 'M12 15v7' }, { c: [10, 7, 0.8] }, { c: [14, 7, 0.8] }, { c: [12, 10, 0.8] }],
  tennis: [{ c: [12, 12, 8] }, { p: 'M5 7c4 2 4 8 0 10M19 7c-4 2-4 8 0 10' }],
  volleyball: [{ c: [12, 12, 8] }, { p: 'M12 4c-1 4 0 8 4 10M4.5 9c4-1 7 1 8 4M8 19c2-3 5-5 11-4' }],
} satisfies Record<string, Shape[]>;

export type IconName = keyof typeof ICONS | 'dots';

export function isIconName(name: string): name is IconName {
  return name in ICONS || name === 'dots';
}

interface IconProps {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
  /** Fill the shape too (liked heart). */
  filled?: boolean;
}

export function Icon({ name, size = 20, color, strokeWidth = 1.9, filled = false }: IconProps) {
  if (name === 'dots') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx={5} cy={12} r={1.8} fill={color} />
        <Circle cx={12} cy={12} r={1.8} fill={color} />
        <Circle cx={19} cy={12} r={1.8} fill={color} />
      </Svg>
    );
  }
  const common = { stroke: color, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: filled ? color : 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {(ICONS[name] as Shape[]).map((shape, i) => {
        if ('p' in shape) return <Path key={i} d={shape.p} {...common} strokeWidth={shape.w ?? strokeWidth} />;
        if ('c' in shape) return <Circle key={i} cx={shape.c[0]} cy={shape.c[1]} r={shape.c[2]} {...common} strokeWidth={strokeWidth} />;
        return <Rect key={i} x={shape.r[0]} y={shape.r[1]} width={shape.r[2]} height={shape.r[3]} rx={shape.r[4]} {...common} strokeWidth={strokeWidth} />;
      })}
    </Svg>
  );
}

/** The design's icon for a sport slug. */
export function sportIcon(slug: string): IconName {
  return isIconName(slug) ? slug : 'trophy';
}
