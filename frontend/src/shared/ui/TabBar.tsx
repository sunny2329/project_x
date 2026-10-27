import type { BottomTabBarProps } from 'expo-router/tabs';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/shared/theme';
import { Icon, type IconName } from './Icon';
import { T } from './Text';

const TABS: Record<string, { icon: IconName; label: string }> = {
  index: { icon: 'home', label: 'Home' },
  tournaments: { icon: 'trophy', label: 'Tournaments' },
  chats: { icon: 'chat', label: 'Chats' },
  profile: { icon: 'person', label: 'Profile' },
};

/** Home · Tournaments · + New match (orange square) · Chats · Profile. */
export function TabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const routes = state.routes.filter((r) => TABS[r.name]);
  const item = (route: (typeof routes)[number]) => {
    const meta = TABS[route.name]!;
    const focused = state.routes[state.index]?.key === route.key;
    const color = focused ? colors.primary : colors.muted;
    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={meta.label}
        onPress={() => {
          const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigateToTab(route.key);
        }}
        style={{ flex: 1, height: 52, alignItems: 'center', justifyContent: 'center', gap: 3 }}
      >
        <Icon name={meta.icon} size={24} color={color} />
        <T size={11} w={600} color={color} lh={14}>
          {meta.label}
        </T>
      </Pressable>
    );
  };
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 6,
        paddingHorizontal: 8,
        paddingBottom: Math.max(insets.bottom, 10) + 4,
        backgroundColor: colors.bar,
        borderTopWidth: 1,
        borderTopColor: colors.line,
      }}
    >
      {routes.slice(0, 2).map(item)}
      <View style={{ flex: 1, alignItems: 'center' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New match"
          onPress={() => router.push('/match/new')}
          style={({ pressed }) => ({
            width: 56,
            height: 56,
            borderRadius: 18,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.85 : 1,
            shadowColor: '#000',
            shadowOpacity: 0.45,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 6 },
            elevation: 6,
          })}
        >
          <Icon name="plus" size={26} color={colors.onPrimary} strokeWidth={2.4} />
        </Pressable>
      </View>
      {routes.slice(2).map(item)}
    </View>
  );
}
