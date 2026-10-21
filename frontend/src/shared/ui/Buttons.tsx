import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, type PressableProps, type ViewStyle } from 'react-native';
import { useTheme } from '@/shared/theme';
import { Icon, type IconName } from './Icon';
import { T } from './Text';

type Variant = 'primary' | 'outline' | 'surface' | 'raised' | 'danger' | 'ghost' | 'good';

interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  label: string;
  variant?: Variant;
  /** A fill colour instead of the variant (sport-coloured "Start match"); text goes `ink`. */
  color?: string;
  textColor?: string;
  height?: number;
  radius?: number;
  size?: number;
  weight?: 600 | 700 | 800;
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  style?: ViewStyle;
  /** Shrinks to its content instead of filling the row. */
  inline?: boolean;
  px?: number;
  children?: ReactNode;
}

/** The designs' buttons: 56px tall, 16px radius by default. */
export function Button({
  label,
  variant = 'primary',
  color,
  textColor,
  height = 56,
  radius = 16,
  size,
  weight,
  icon,
  iconRight,
  loading = false,
  disabled,
  style,
  inline = false,
  px = 16,
  children,
  ...rest
}: ButtonProps) {
  const { colors } = useTheme();
  const fills: Record<Variant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: colors.primary, fg: colors.onPrimary },
    outline: { bg: 'transparent', fg: colors.fg, border: colors.line2 },
    surface: { bg: colors.surface, fg: colors.fg },
    raised: { bg: colors.raised, fg: colors.fg },
    danger: { bg: '#FF5468', fg: colors.onPrimary },
    ghost: { bg: 'transparent', fg: colors.muted },
    good: { bg: '#4ADE80', fg: colors.ink },
  };
  const fill = color ? { bg: color, fg: colors.ink } : fills[variant];
  const fg = textColor ?? fill.fg;
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      disabled={isDisabled}
      {...rest}
      style={({ pressed }) => [
        {
          height,
          borderRadius: radius,
          backgroundColor: fill.bg,
          borderWidth: fill.border ? 1 : 0,
          borderColor: fill.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingHorizontal: px,
          opacity: disabled && !loading ? 0.45 : pressed ? 0.82 : 1,
          ...(inline ? { alignSelf: 'flex-start' as const } : {}),
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={18} color={fg} /> : null}
          {children ?? (
            <T size={size ?? (height >= 54 ? 16 : height >= 44 ? 15 : 13)} w={weight ?? (variant === 'primary' || color ? 800 : 700)} color={fg} numberOfLines={1}>
              {label}
            </T>
          )}
          {iconRight ? <Icon name={iconRight} size={18} color={fg} /> : null}
        </>
      )}
    </Pressable>
  );
}

interface IconButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  icon: IconName;
  label: string;
  /** surface (default), primary, translucent (on coloured headers), plain (no fill). */
  tone?: 'surface' | 'primary' | 'translucent' | 'plain' | 'raised';
  size?: number;
  iconSize?: number;
  radius?: number;
  color?: string;
  style?: ViewStyle;
  badge?: ReactNode;
}

/** 44x44, 14px radius square icon buttons (back, close, search, ⋯). */
export function IconButton({ icon, label, tone = 'surface', size = 44, iconSize, radius = 14, color, style, badge, ...rest }: IconButtonProps) {
  const { colors } = useTheme();
  const bg = { surface: colors.surface, primary: colors.primary, translucent: 'rgba(10,15,28,0.14)', plain: 'transparent', raised: colors.raised }[tone];
  const fg = color ?? (tone === 'primary' ? colors.onPrimary : colors.fg);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      {...rest}
      style={({ pressed }) => [
        { width: size, height: size, borderRadius: radius, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 },
        style,
      ]}
    >
      <Icon name={icon} size={iconSize ?? (icon === 'back' ? 22 : 20)} color={fg} />
      {badge}
    </Pressable>
  );
}

/** Text-only action ("Cancel", "See all", "Forgot password?"). */
export function TextButton({ label, onPress, color, size = 14, weight = 700, style }: { label: string; onPress?: () => void; color?: string; size?: number; weight?: 600 | 700; style?: ViewStyle }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8} style={({ pressed }) => [{ paddingVertical: 6, opacity: pressed ? 0.6 : 1 }, style]}>
      <T size={size} w={weight} color={color ?? colors.fg}>
        {label}
      </T>
    </Pressable>
  );
}

/** A pressable area with press feedback and no styling of its own. */
export function Tap({ children, onPress, style, label, disabled, onLongPress }: { children: ReactNode; onPress?: () => void; style?: ViewStyle | ViewStyle[]; label?: string; disabled?: boolean; onLongPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label}
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled || !onPress}
      style={({ pressed }) => [...(Array.isArray(style) ? style : [style]), pressed && onPress ? { opacity: 0.75 } : null]}
    >
      {children}
    </Pressable>
  );
}
