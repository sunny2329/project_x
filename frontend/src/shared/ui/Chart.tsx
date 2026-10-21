import Svg, { Circle, Polyline } from 'react-native-svg';

/** Rating trend line (MatchResult, Profile): the points scaled into the box, a dot on the last one. */
export function Sparkline({ points, width = 120, height = 48, color, strokeWidth = 2.5 }: { points: number[]; width?: number; height?: number; color: string; strokeWidth?: number }) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const pad = 4;
  const xy = points.map((p, i) => [pad + (i * (width - pad * 2)) / (points.length - 1), pad + (1 - (p - min) / span) * (height - pad * 2)] as const);
  const last = xy[xy.length - 1]!;
  return (
    <Svg width={width} height={height} accessibilityLabel={`Rating trend, now ${points[points.length - 1]}`}>
      <Polyline points={xy.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={last[0]} cy={last[1]} r={4} fill={color} />
    </Svg>
  );
}
