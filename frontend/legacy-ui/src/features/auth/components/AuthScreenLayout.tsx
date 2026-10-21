import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BackButton, Screen } from '@/shared/components';
import { spacing, typography, useTheme } from '@/shared/theme';

interface AuthScreenLayoutProps {
  title: string;
  subtitle?: string;
  /** Hidden on screens reached only from the welcome screen's own back stack root. */
  showBack?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Strava-style auth screen: plain back arrow, big left-aligned title, then the form directly
 * underneath and an optional footer line.
 */
export function AuthScreenLayout({ title, subtitle, showBack = true, children, footer }: AuthScreenLayoutProps) {
  const { colors } = useTheme();
  return (
    <Screen background={colors.header}>
      <View style={styles.inner}>
        <View style={styles.backRow}>{showBack ? <BackButton /> : null}</View>
        <Text style={[typography.largeTitle, { color: colors.text }]} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}
        <View style={styles.form}>{children}</View>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  inner: { flexGrow: 1, paddingHorizontal: spacing.xs },
  backRow: { height: 56, justifyContent: 'center', marginBottom: spacing.sm },
  subtitle: { ...typography.subtitle, fontSize: 15, lineHeight: 21, marginTop: spacing.sm },
  form: { gap: spacing.md, marginTop: spacing.xl },
  footer: { marginTop: spacing.xxl },
});
