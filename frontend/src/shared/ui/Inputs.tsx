import { useRef, useState, type ReactNode } from 'react';
import { Pressable, TextInput, View, type TextInputInstance, type TextInputProps, type ViewStyle } from 'react-native';
import { bodyFont, displayFont, useTheme } from '@/shared/theme';
import { Icon } from './Icon';
import { T } from './Text';

interface FieldProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  /** Under the box: hint (muted), or `error` (red) / `success` (green) when set. */
  hint?: string | null;
  error?: string | null;
  success?: string | null;
  /** Left of the input ("+91 |", "@"). */
  prefix?: ReactNode;
  /** Right of the input (show-password button, check mark). */
  suffix?: ReactNode;
  height?: number;
  radius?: number;
  size?: number;
  /** Display font (codes, scores). */
  display?: boolean;
  /** Field background (sheets use bg instead of surface). */
  background?: string;
  style?: ViewStyle;
  /** Highlights the border in primary while focused (default true). */
  focusRing?: boolean;
}

/** A labelled input: 56px, 14px radius, surface fill; primary border while focused. */
export function Field({
  label,
  hint,
  error,
  success,
  prefix,
  suffix,
  height = 56,
  radius = 14,
  size = 17,
  display = false,
  background,
  style,
  focusRing = true,
  multiline,
  onFocus,
  onBlur,
  ...input
}: FieldProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const border = error ? '#FF5468' : focused && focusRing ? colors.primary : colors.line;
  return (
    <View style={[{ gap: 8 }, style]}>
      {label ? (
        <T size={13} w={600} color={colors.muted}>
          {label}
        </T>
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: multiline ? 'flex-start' : 'center',
          minHeight: height,
          borderRadius: radius,
          backgroundColor: background ?? colors.surface,
          borderWidth: focused || error ? 1.5 : 1,
          borderColor: border,
          paddingLeft: 16,
          paddingRight: suffix ? 6 : 16,
          gap: 12,
        }}
      >
        {prefix}
        <TextInput
          {...input}
          multiline={multiline}
          accessibilityLabel={input.accessibilityLabel ?? label}
          placeholderTextColor={colors.faint}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={{
            flex: 1,
            minWidth: 0,
            color: colors.fg,
            fontFamily: display ? displayFont(800) : bodyFont(600),
            fontSize: size,
            paddingVertical: multiline ? 12 : 0,
            minHeight: multiline ? height : undefined,
            textAlignVertical: multiline ? 'top' : 'center',
          }}
        />
        {suffix}
      </View>
      {error || success || hint ? (
        <T size={13} color={error ? colors.bad : success ? colors.good : colors.muted}>
          {error ?? success ?? hint}
        </T>
      ) : null}
    </View>
  );
}

/** "+91 │" phone prefix. */
export function PhonePrefix({ code }: { code: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <T w={600}>{code}</T>
      <View style={{ width: 1, height: 24, backgroundColor: colors.line }} />
    </View>
  );
}

/** Rounded search box with a magnifier and a clear button. */
export function SearchField({
  value,
  onChangeText,
  placeholder,
  autoFocus,
  height = 48,
  background,
  active = true,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  height?: number;
  background?: string;
  active?: boolean;
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        height,
        borderRadius: 14,
        backgroundColor: background ?? colors.surface,
        borderWidth: active && focused ? 1.5 : 0,
        borderColor: colors.primary,
        paddingHorizontal: 14,
      }}
    >
      <Icon name="search" size={19} color={colors.muted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        autoFocus={autoFocus}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel={placeholder ?? 'Search'}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{ flex: 1, color: colors.fg, fontFamily: bodyFont(500), fontSize: 16 }}
      />
      {value ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Clear" onPress={() => onChangeText('')} hitSlop={8} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.line, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="close" size={14} color={colors.fg} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Six code boxes over one hidden input (paste and SMS autofill work). */
export function CodeBoxes({ value, onChange, length = 6, autoFocus = true }: { value: string; onChange: (v: string) => void; length?: number; autoFocus?: boolean }) {
  const { colors } = useTheme();
  const input = useRef<TextInputInstance>(null);
  const [focused, setFocused] = useState(false);
  return (
    <Pressable onPress={() => input.current?.focus()} accessibilityLabel={`${length}-digit code`} style={{ flexDirection: 'row', gap: 8 }}>
      {Array.from({ length }, (_, i) => {
        const digit = value[i] ?? '';
        const current = focused && i === Math.min(value.length, length - 1);
        return (
          <View
            key={i}
            style={{
              flex: 1,
              height: 64,
              borderRadius: 14,
              backgroundColor: colors.surface,
              borderWidth: current ? 2 : 1,
              borderColor: current ? colors.primary : digit ? colors.line2 : colors.line,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <T style={{ fontFamily: displayFont(800), fontSize: 34, lineHeight: 40 }}>{digit}</T>
          </View>
        );
      })}
      <TextInput
        ref={input}
        value={value}
        onChangeText={(v) => onChange(v.replace(/\D/g, '').slice(0, length))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        autoFocus={autoFocus}
        maxLength={length}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        caretHidden
        style={{ position: 'absolute', opacity: 0.01, width: '100%', height: '100%' }}
      />
    </Pressable>
  );
}

/** A big centred number box (scores typed in afterwards, seeds). */
export function NumberBox({
  value,
  onChange,
  label,
  invalid,
  height = 60,
  size = 30,
  width,
  placeholder,
  background,
  radius = 14,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  invalid?: boolean;
  height?: number;
  size?: number;
  width?: number;
  placeholder?: string;
  background?: string;
  radius?: number;
}) {
  const { colors } = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={(v) => onChange(v.replace(/\D/g, '').slice(0, 3))}
      keyboardType="number-pad"
      accessibilityLabel={label}
      placeholder={placeholder}
      placeholderTextColor={colors.faint}
      style={{
        ...(width ? { width } : { flex: 1 }),
        height,
        borderRadius: radius,
        backgroundColor: invalid ? 'rgba(255,84,104,0.08)' : background ?? colors.surface,
        borderWidth: invalid ? 2 : background ? 0 : 1,
        borderColor: invalid ? '#FF5468' : colors.line,
        textAlign: 'center',
        color: colors.fg,
        fontFamily: displayFont(900),
        fontSize: size,
        padding: 0,
      }}
    />
  );
}
