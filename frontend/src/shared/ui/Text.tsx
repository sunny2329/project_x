import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { bodyFont, displayFont, useTheme, type BodyWeight, type DisplayWeight } from '@/shared/theme';

interface BaseProps extends Omit<RNTextProps, 'style'> {
  size?: number;
  color?: string;
  /** Line height; defaults to a comfortable multiple of the size. */
  lh?: number;
  /** Letter spacing in em (the designs use em). */
  ls?: number;
  center?: boolean;
  right?: boolean;
  upper?: boolean;
  italic?: boolean;
  flex?: boolean;
  style?: TextStyle | (TextStyle | false | null | undefined)[];
}

function base(p: BaseProps, fontFamily: string, defaultColor: string, defaultLh: number): TextStyle {
  const size = p.size ?? 15;
  return {
    fontFamily,
    fontSize: size,
    color: p.color ?? defaultColor,
    lineHeight: p.lh ?? Math.round(size * defaultLh),
    ...(p.ls !== undefined ? { letterSpacing: p.ls * size } : {}),
    ...(p.center ? { textAlign: 'center' } : p.right ? { textAlign: 'right' } : {}),
    ...(p.upper ? { textTransform: 'uppercase' } : {}),
    ...(p.italic ? { fontStyle: 'italic' } : {}),
    ...(p.flex ? { flex: 1, minWidth: 0 } : {}),
  };
}

/** Body text (Instrument Sans). */
export function T({ w = 400, style, ...p }: BaseProps & { w?: BodyWeight }) {
  const { colors } = useTheme();
  return <RNText {...p} style={[base(p, bodyFont(w), colors.fg, 1.4), ...(Array.isArray(style) ? style : [style])]} />;
}

/** Display text (Big Shoulders Display): titles and every score number. */
export function D({ w = 900, style, ...p }: BaseProps & { w?: DisplayWeight }) {
  const { colors } = useTheme();
  return <RNText {...p} style={[base(p, displayFont(w), colors.fg, 1.0), ...(Array.isArray(style) ? style : [style])]} />;
}

/** "12 · 700 · 0.08em · UPPERCASE · muted" section labels. */
export function Label({ children, color, style }: { children: React.ReactNode; color?: string; style?: TextStyle }) {
  const { colors } = useTheme();
  return (
    <T size={12} w={700} ls={0.08} upper color={color ?? colors.muted} style={style}>
      {children}
    </T>
  );
}

/** PROJECT<X>: the wordmark, X in the accent colour. */
export function Wordmark({ size = 24 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <D size={size} ls={0.04} accessibilityRole="header" accessibilityLabel="ProjectX">
      PROJECT<D size={size} color={colors.accentText}>X</D>
    </D>
  );
}
