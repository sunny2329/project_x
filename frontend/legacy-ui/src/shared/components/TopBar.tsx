import Feather from '@expo/vector-icons/Feather';
import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sizes, spacing, typography, useTheme } from '@/shared/theme';
import { appBarStyles } from './AppHeader';

interface TopBarProps {
  title?: string;
  /** Replaces the plain title (e.g. a LIVE badge + league name). */
  titleContent?: ReactNode;
  /** Shows the back arrow. Where to go when there is no screen to go back to. */
  back?: Href | false;
  actions?: ReactNode;
  /** No hairline or background, for screens with a hero underneath. */
  transparent?: boolean;
}

/** Pushed-screen app bar: back arrow, title, actions on the right. */
export function TopBar({ title, titleContent, back = '/', actions, transparent = false }: TopBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        transparent ? null : appBarStyles.bar,
        { paddingTop: insets.top, backgroundColor: transparent ? 'transparent' : colors.header, borderBottomColor: colors.divider },
      ]}
    >
      <View style={styles.row}>
        {back !== false ? (
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace(back))}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.back}
          >
            <Feather name="arrow-left" size={24} color={colors.text} />
          </Pressable>
        ) : null}
        <View style={styles.title}>
          {titleContent ?? (
            <Text style={[typography.screenTitle, { color: colors.text }]} numberOfLines={1} accessibilityRole="header">
              {title}
            </Text>
          )}
        </View>
        {actions ? <View style={styles.actions}>{actions}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { height: sizes.appBar, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.screen, gap: spacing.md },
  back: { width: 32, height: 40, justifyContent: 'center' },
  title: { flex: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
