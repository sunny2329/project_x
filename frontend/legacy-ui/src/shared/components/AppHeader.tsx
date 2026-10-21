import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sizes, spacing, typography, useTheme } from '@/shared/theme';
import { BrandLogo } from './BrandLogo';

interface AppHeaderProps {
  /** Big left-aligned title (Strava's "Home", "You"); the logo is shown when there is none. */
  title?: string;
  /** Icon buttons on the right. */
  actions?: ReactNode;
}

/** Top-level tab app bar: title (or logo) on the left, actions on the right, hairline underneath. */
export function AppHeader({ title, actions }: AppHeaderProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top, backgroundColor: colors.header, borderBottomColor: colors.divider }]}>
      <View style={styles.row}>
        {title ? (
          <Text style={[typography.appBarTitle, { color: colors.text }]} accessibilityRole="header">
            {title}
          </Text>
        ) : (
          <BrandLogo size={sizes.headerLogo} />
        )}
        <View style={styles.actions}>{actions}</View>
      </View>
    </View>
  );
}

export const appBarStyles = StyleSheet.create({
  bar: { borderBottomWidth: StyleSheet.hairlineWidth },
});

const styles = StyleSheet.create({
  bar: appBarStyles.bar,
  row: {
    height: sizes.appBar + 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
