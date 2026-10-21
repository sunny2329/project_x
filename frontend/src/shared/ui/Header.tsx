import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useTheme } from '@/shared/theme';
import { IconButton } from './Buttons';
import { D, T } from './Text';

/** Goes back, or to `fallback` when there is nothing to go back to (opened from a link). */
export function goBack(fallback = '/') {
  if (router.canGoBack()) router.back();
  else router.replace(fallback as never);
}

/**
 * The common top row: back (or close) button, then a title ("Post", 17 bold) or a kicker over a
 * display title ("Jaipur Open 2026" / "MEN'S DOUBLES"), and optional right-side actions.
 */
export function Header({
  title,
  display,
  kicker,
  right,
  icon = 'back',
  onBack,
  displaySize = 28,
  center,
}: {
  title?: string;
  display?: string;
  kicker?: string;
  right?: ReactNode;
  icon?: 'back' | 'close' | null;
  onBack?: () => void;
  displaySize?: number;
  /** Centred label between back and right ("NEW MATCH"). */
  center?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}>
      {icon ? <IconButton icon={icon} label={icon === 'close' ? 'Close' : 'Back'} onPress={onBack ?? (() => goBack())} /> : null}
      {center ? (
        <View style={{ flex: 1, alignItems: 'center' }}>{center}</View>
      ) : (
        <View style={{ flex: 1, minWidth: 0 }}>
          {kicker ? (
            <T size={12} color={colors.muted} numberOfLines={1}>
              {kicker}
            </T>
          ) : null}
          {display ? (
            <D size={displaySize} lh={displaySize} upper numberOfLines={2}>
              {display}
            </D>
          ) : title ? (
            <T size={17} w={700} numberOfLines={1}>
              {title}
            </T>
          ) : null}
        </View>
      )}
      {right ?? (center ? <View style={{ width: 44 }} /> : null)}
    </View>
  );
}
