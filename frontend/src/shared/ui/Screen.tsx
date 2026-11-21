import type { ReactNode, Ref } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/shared/theme';

interface ScreenProps {
  children: ReactNode;
  /** Horizontal padding (designs use 20 or 24; 16 on scoring screens). */
  px?: number;
  /** Space between direct children. */
  gap?: number;
  /** Extra space under the status bar (designs: 54px total, i.e. ~10 under a 44px bar). */
  top?: number;
  /** Space above the bottom edge when there is no footer. */
  bottom?: number;
  /** Scrolls the content (default true). */
  scroll?: boolean;
  /** Fixed bar under the content ("Send entry", composer, tab-like action bars). */
  footer?: ReactNode;
  /** Draws the footer on the bar colour with a hairline above it. */
  footerBar?: boolean;
  /** Content tucked under the status bar (coloured headers). */
  edgeToEdge?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  background?: string;
  contentStyle?: ViewStyle;
  /** The scroll view, for screens that scroll something into view themselves. */
  scrollRef?: Ref<ScrollViewInstance>;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** Height of the visible scroll area. */
  onViewportHeight?: (height: number) => void;
}

/** Every screen's frame: safe-area top, design padding, keyboard handling, optional fixed footer. */
export function Screen({
  children,
  px = 20,
  gap = 16,
  top = 10,
  bottom = 28,
  scroll = true,
  footer,
  footerBar = false,
  edgeToEdge = false,
  refreshing,
  onRefresh,
  background,
  contentStyle,
  scrollRef,
  onScroll,
  onViewportHeight,
}: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const padTop = edgeToEdge ? 0 : insets.top + top;
  const padBottom = footer ? 16 : Math.max(insets.bottom, 8) + bottom;
  const inner: ViewStyle = { paddingHorizontal: px, paddingTop: padTop, paddingBottom: padBottom, gap, flexGrow: 1, ...contentStyle };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: background ?? colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {scroll ? (
        <ScrollView
          ref={scrollRef}
          onScroll={onScroll}
          scrollEventThrottle={onScroll ? 32 : undefined}
          onLayout={onViewportHeight ? (e) => onViewportHeight(e.nativeEvent.layout.height) : undefined}
          contentContainerStyle={inner}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.muted} /> : undefined}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[inner, { flex: 1 }]}>{children}</View>
      )}
      {footer ? (
        <View
          style={{
            paddingHorizontal: px,
            paddingTop: 14,
            paddingBottom: Math.max(insets.bottom, 12) + (footerBar ? 14 : 16),
            ...(footerBar ? { backgroundColor: colors.bar, borderTopWidth: 1, borderTopColor: colors.raised } : {}),
          }}
        >
          {footer}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

/** A row with items centred vertically. */
export function Row({ children, gap = 0, style, between }: { children: ReactNode; gap?: number; style?: ViewStyle; between?: boolean }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, between && { justifyContent: 'space-between' }, style]}>{children}</View>;
}

export function Col({ children, gap = 0, style }: { children: ReactNode; gap?: number; style?: ViewStyle }) {
  return <View style={[{ gap }, style]}>{children}</View>;
}

/** Takes the remaining space (pushes footers down inside a screen). */
export function Spacer() {
  return <View style={{ flex: 1 }} />;
}
