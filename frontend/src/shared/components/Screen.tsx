import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { spacing, useTheme } from '@/shared/theme';

interface ScreenProps {
  children: ReactNode;
  /** Tab screens pass ['top']: the tab bar already handles the bottom inset. */
  edges?: Edge[];
  /** An AppHeader / TopBar pinned above the scrolling content; it handles the top inset itself. */
  header?: ReactNode;
  /** A bar pinned below the scrolling content that rises with the keyboard (e.g. a Composer); it handles the bottom inset. */
  footer?: ReactNode;
  /** Horizontal screen padding (off for edge-to-edge lists like the feed). */
  padded?: boolean;
  /** Enables pull-to-refresh. */
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Canvas colour; defaults to the theme background. */
  background?: string;
}

/** Safe-area aware, keyboard-avoiding, scrollable screen shell used by every screen. */
export function Screen({ children, edges = ['top', 'bottom'], header, footer, padded = true, onRefresh, refreshing = false, background }: ScreenProps) {
  const { colors } = useTheme();
  const safeEdges = edges.filter((edge) => !(edge === 'top' && header) && !(edge === 'bottom' && footer));
  return (
    <View style={[styles.flex, { backgroundColor: background ?? colors.background }]}>
      {header}
      <SafeAreaView style={styles.flex} edges={safeEdges}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            contentContainerStyle={[styles.content, padded && styles.padded]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={Boolean(onRefresh)}
            refreshControl={
              onRefresh ? (
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
              ) : undefined
            }
          >
            {children}
          </ScrollView>
          {footer}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingBottom: spacing.xl },
  padded: { paddingHorizontal: spacing.screen },
});
