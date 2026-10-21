import type { ReactNode } from 'react';
import { ActivityIndicator, Image, Pressable, View, type ViewStyle } from 'react-native';
import { env } from '@/shared/config/env';
import { avatarTone, LIVE, READY, useTheme } from '@/shared/theme';
import { Icon } from './Icon';
import { D, T } from './Text';

/** "Riya Sharma" -> "RS"; "kabir.m" -> "KM". */
export function initials(name: string): string {
  const parts = name
    .replace(/[@._-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0]![0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]![0] ?? '' : parts[0]![1] ?? '';
  return (first + last).toUpperCase();
}

/** Media paths from the API are relative ("/media/…"). */
export function mediaUri(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith('http') || url.startsWith('file:') || url.startsWith('data:') ? url : `${env.apiUrl}${url}`;
}

/** A person's photo, or their initials on a stable tone. */
export function Avatar({
  name,
  id,
  photoUrl,
  size = 40,
  ring,
  display = false,
  border,
}: {
  name: string;
  /** Picks the tone; defaults to the name. */
  id?: string | null;
  photoUrl?: string | null;
  size?: number;
  /** A coloured ring around it (own profile, podium winner). */
  ring?: string;
  /** Big Shoulders initials (profile headers). */
  display?: boolean;
  /** A bg-coloured border (overlapping avatars). */
  border?: string;
}) {
  const { colors } = useTheme();
  const uri = mediaUri(photoUrl);
  const text = initials(name);
  const fontSize = display ? Math.round(size * 0.4) : size >= 48 ? 15 : size >= 40 ? 14 : size >= 34 ? 12 : 11;
  const circle: ViewStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: avatarTone(colors, id ?? name),
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...(border ? { borderWidth: 2, borderColor: border } : {}),
  };
  const body = uri ? (
    <View style={circle}>
      <Image source={{ uri }} style={{ width: size, height: size }} accessibilityIgnoresInvertColors />
    </View>
  ) : (
    <View style={circle} accessibilityLabel={name}>
      {display ? (
        <D size={fontSize}>{text}</D>
      ) : (
        <T size={fontSize} w={700}>
          {text}
        </T>
      )}
    </View>
  );
  if (!ring) return body;
  return <View style={{ padding: 2, borderRadius: size, borderWidth: 2, borderColor: ring, backgroundColor: colors.bg }}>{body}</View>;
}

export function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

/** Small status badge ("LIVE", "READY", "PENDING", "AWAITING YOU"). */
export function Badge({
  label,
  tone = 'neutral',
  size = 'sm',
  style,
}: {
  label: string;
  tone?: 'live' | 'ready' | 'readySolid' | 'pending' | 'neutral' | 'bad' | 'primary' | 'good' | 'progress';
  size?: 'xs' | 'sm';
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const map = {
    live: { bg: LIVE, fg: colors.ink },
    ready: { bg: 'rgba(74,222,128,0.16)', fg: colors.good },
    readySolid: { bg: READY, fg: colors.ink },
    good: { bg: 'rgba(74,222,128,0.16)', fg: colors.good },
    pending: { bg: colors.warnBg, fg: colors.warnText },
    neutral: { bg: colors.raised, fg: colors.soft },
    bad: { bg: 'rgba(255,84,104,0.14)', fg: colors.bad },
    progress: { bg: 'rgba(255,84,104,0.16)', fg: colors.bad },
    primary: { bg: colors.primary, fg: colors.onPrimary },
  }[tone];
  return (
    <View style={[{ alignSelf: 'flex-start', paddingHorizontal: size === 'xs' ? 6 : 8, paddingVertical: size === 'xs' ? 2 : 4, borderRadius: size === 'xs' ? 4 : 6, backgroundColor: map.bg }, style]}>
      <T size={size === 'xs' ? 10 : 11} w={800} ls={0.06} color={map.fg}>
        {label}
      </T>
    </View>
  );
}

/** Surface card: 16-20px radius, hairline border. */
export function Card({ children, style, padding = 16, radius = 18, border = true, background, onPress, label }: { children: ReactNode; style?: ViewStyle; padding?: number; radius?: number; border?: boolean; background?: string; onPress?: () => void; label?: string }) {
  const { colors } = useTheme();
  const s: ViewStyle = { padding, borderRadius: radius, backgroundColor: background ?? colors.surface, ...(border ? { borderWidth: 1, borderColor: colors.line } : {}), ...style };
  if (!onPress) return <View style={s}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [s, pressed && { opacity: 0.8 }]}>
      {children}
    </Pressable>
  );
}

/** Sign-up progress: 4 bars, the first `step` in primary. */
export function StepDots({ step, total = 4 }: { step: number; total?: number }) {
  const { colors } = useTheme();
  return (
    <View accessibilityLabel={`Step ${step} of ${total}`} style={{ flexDirection: 'row', gap: 6 }}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={{ width: 28, height: 4, borderRadius: 2, backgroundColor: i < step ? colors.primary : colors.line }} />
      ))}
    </View>
  );
}

/** A settings-style group: rounded surface with hairlines between rows. */
export function Group({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { colors } = useTheme();
  return <View style={[{ borderRadius: 16, backgroundColor: colors.surface, overflow: 'hidden' }, style]}>{children}</View>;
}

/** A row inside a Group. */
export function GroupRow({ children, onPress, last, minHeight = 52, label, style }: { children: ReactNode; onPress?: () => void; last?: boolean; minHeight?: number; label?: string; style?: ViewStyle }) {
  const { colors } = useTheme();
  const s: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight, paddingHorizontal: 16, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.raised, ...style };
  if (!onPress) return <View style={s}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [s, pressed && { backgroundColor: colors.raised2 }]}>
      {children}
    </Pressable>
  );
}

export function Divider({ color, inset = 0 }: { color?: string; inset?: number }) {
  const { colors } = useTheme();
  return <View style={{ height: 1, backgroundColor: color ?? colors.raised, marginHorizontal: inset }} />;
}

/** Full-screen spinner. */
export function Loading() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: 40 }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

/** Inline message box: info (raised), warn, error. */
export function Notice({ text, tone = 'info', icon }: { text: string; tone?: 'info' | 'warn' | 'error' | 'surface'; icon?: 'info' | 'alert' | 'lock' | 'phone' | 'snake' | 'eye' | 'check' | 'clock' }) {
  const { colors } = useTheme();
  const map = {
    info: { bg: colors.raised, fg: colors.soft },
    surface: { bg: colors.surface, fg: colors.muted },
    warn: { bg: colors.warnBg, fg: colors.warnText },
    error: { bg: 'rgba(255,84,104,0.1)', fg: colors.bad },
  }[tone];
  return (
    <View accessibilityRole={tone === 'error' ? 'alert' : undefined} style={{ flexDirection: 'row', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: map.bg }}>
      {icon ? <Icon name={icon} size={18} color={map.fg} /> : null}
      <T size={13} lh={19} color={map.fg} flex>
        {text}
      </T>
    </View>
  );
}

/** Centered empty / error message with an optional action. */
export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 8, paddingVertical: 32, paddingHorizontal: 16 }}>
      <T size={16} w={700} center>
        {title}
      </T>
      {body ? (
        <T size={14} color={colors.muted} center>
          {body}
        </T>
      ) : null}
      {action}
    </View>
  );
}
