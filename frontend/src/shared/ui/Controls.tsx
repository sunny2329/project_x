import type { ReactNode } from 'react';
import { Pressable, Switch, View, type ViewStyle } from 'react-native';
import { useTheme, withAlpha } from '@/shared/theme';
import { Icon } from './Icon';
import { D, T } from './Text';

export interface SegmentOption<V extends string> {
  value: V;
  label: string;
  disabled?: boolean;
  badge?: ReactNode;
}

/**
 * Two (or more) equal tabs in a surface tray; the active one is filled ("Password | Text me a
 * code", "Singles | Doubles", "Playing | Scoring duties").
 */
export function Segmented<V extends string>({
  options,
  value,
  onChange,
  height = 44,
  activeColor,
  activeText,
  tray,
  radius = 14,
  size = 15,
  style,
}: {
  options: SegmentOption<V>[];
  value: V;
  onChange: (v: V) => void;
  height?: number;
  /** Fill of the active tab (default primary; sport colour on match setup). */
  activeColor?: string;
  activeText?: string;
  tray?: string;
  radius?: number;
  size?: number;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="tablist" style={[{ flexDirection: 'row', padding: 4, gap: 4, borderRadius: radius, backgroundColor: tray ?? colors.surface }, style]}>
      {options.map((o) => {
        const active = o.value === value;
        const fill = activeColor ?? colors.primary;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active, disabled: !!o.disabled }}
            accessibilityLabel={o.label}
            disabled={o.disabled}
            onPress={() => onChange(o.value)}
            style={{ flex: 1, height, borderRadius: radius - 3, backgroundColor: active ? fill : 'transparent', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}
          >
            <T size={size} w={active ? 700 : 600} color={active ? activeText ?? (activeColor ? colors.ink : colors.onPrimary) : o.disabled ? colors.faint : colors.muted}>
              {o.label}
            </T>
            {o.badge}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Rounded filter/tab chip ("Open", "Live now", sport chips with a colour dot). */
export function Chip({
  label,
  active,
  onPress,
  dot,
  activeColor,
  height = 36,
  tint = false,
  style,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  /** Sport colour dot before the label. */
  dot?: string;
  /** Active fill (default primary); `tint` makes it a light wash with a coloured border instead. */
  activeColor?: string;
  height?: number;
  tint?: boolean;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const fill = activeColor ?? colors.primary;
  const bg = active ? (tint ? withAlpha(fill, 0.16) : fill) : 'transparent';
  const border = active ? (tint ? fill : fill) : colors.line;
  const fg = active && !tint ? (activeColor ? colors.ink : colors.onPrimary) : colors.fg;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        {
          height,
          paddingHorizontal: dot ? 12 : 14,
          borderRadius: height / 2,
          backgroundColor: bg,
          borderWidth: active && !tint ? 0 : active ? 1.5 : 1,
          borderColor: border,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          opacity: pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {dot && !(active && !tint) ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} /> : null}
      <T size={14} w={active ? 700 : 600} color={fg}>
        {label}
      </T>
    </Pressable>
  );
}

/** Radio indicator (20px ring with a dot). */
export function RadioDot({ on, color }: { on: boolean; color?: string }) {
  const { colors } = useTheme();
  const c = color ?? colors.primary;
  return (
    <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: on ? 6 : 1.5, borderColor: on ? c : colors.line2, backgroundColor: on ? colors.bg : 'transparent' }} />
  );
}

/** Checkbox (20px rounded square). */
export function CheckBox({ on, color }: { on: boolean; color?: string }) {
  const { colors } = useTheme();
  const c = color ?? colors.primary;
  return (
    <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: on ? 0 : 1.5, borderColor: colors.line2, backgroundColor: on ? c : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
      {on ? <Icon name="check" size={14} color={colors.onPrimary} strokeWidth={3} /> : null}
    </View>
  );
}

/**
 * A selectable card with a radio ("Best of 3 · 21 points" / "Public"). Selected: tinted fill and a
 * 1.5px coloured border.
 */
export function RadioCard({
  title,
  subtitle,
  selected,
  onPress,
  color,
  disabled,
  background,
  children,
  style,
}: {
  title: string;
  subtitle?: string;
  selected: boolean;
  onPress?: () => void;
  color?: string;
  disabled?: boolean;
  background?: string;
  children?: ReactNode;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const c = color ?? colors.primary;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled: !!disabled }}
      accessibilityLabel={title}
      onPress={onPress}
      disabled={disabled}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: 14,
          backgroundColor: selected ? withAlpha(c.startsWith('#') ? c : '#E85D04', 0.12) : background ?? colors.surface,
          borderWidth: selected ? 1.5 : 1,
          borderColor: selected ? c : colors.line,
          ...(disabled ? { borderStyle: 'dashed', backgroundColor: 'transparent' } : {}),
        },
        style,
      ]}
    >
      <RadioDot on={selected} color={c} />
      {children}
      <View style={{ flex: 1 }}>
        <T size={15} w={selected ? 700 : 600} color={disabled ? colors.faint : colors.fg}>
          {title}
        </T>
        {subtitle ? (
          <T size={13} color={disabled ? colors.faint : selected ? colors.soft : colors.muted}>
            {subtitle}
          </T>
        ) : null}
      </View>
    </Pressable>
  );
}

/** On/off switch in the design colours. */
export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  const { colors } = useTheme();
  return (
    <Switch
      accessibilityLabel={label}
      value={value}
      onValueChange={onChange}
      trackColor={{ false: colors.line2, true: colors.primary }}
      thumbColor={value ? colors.bg : colors.soft}
      ios_backgroundColor={colors.line2}
    />
  );
}

/** "− 4 +" number stepper. */
export function Stepper({ value, onChange, min = 0, max = 99, label }: { value: number; onChange: (v: number) => void; min?: number; max?: number; label: string }) {
  const { colors } = useTheme();
  const btn = (delta: number, text: string, a11y: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      disabled={value + delta < min || value + delta > max}
      onPress={() => onChange(value + delta)}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: colors.raised,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: value + delta < min || value + delta > max ? 0.4 : pressed ? 0.7 : 1,
      })}
    >
      <T size={18} w={700}>
        {text}
      </T>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      {btn(-1, '−', `Fewer ${label}`)}
      <D size={22} style={{ width: 32, textAlign: 'center' }}>
        {value}
      </D>
      {btn(1, '+', `More ${label}`)}
    </View>
  );
}
