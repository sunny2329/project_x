import type { BottomTabBarProps } from 'expo-router/tabs';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/shared/theme';
import { Icon, type IconName } from './Icon';
import { T } from './Text';

/** Tab routes shown in the bar, in order. `chats` stays a tab route but is opened from Home's header. */
const TABS: Record<string, { icon: IconName; label: string }> = {
  index: { icon: 'home', label: 'Home' },
  tournaments: { icon: 'trophy', label: 'Events' },
  profile: { icon: 'person', label: 'Profile' },
};

/** Design v2: Home · Play (opens a new friendly match) · Events · Profile. */
export function TabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const cell = (key: string, icon: IconName, label: string, focused: boolean, onPress: () => void, role: 'tab' | 'button' = 'tab') => {
    const color = focused ? colors.primary : colors.muted;
    return (
      <Pressable
        key={key}
        accessibilityRole={role}
        accessibilityState={role === 'tab' ? { selected: focused } : undefined}
        accessibilityLabel={label}
        onPress={onPress}
        style={{ flex: 1, minWidth: 64, minHeight: 44, alignItems: 'center', justifyContent: 'flex-start', gap: 4, paddingTop: 2 }}
      >
        <Icon name={icon} size={24} color={color} />
        <T size={11} w={focused ? 700 : 400} color={color} lh={14} numberOfLines={1}>
          {label}
        </T>
      </Pressable>
    );
  };
  const tab = (name: string) => {
    const route = state.routes.find((r) => r.name === name);
    if (!route) return null;
    const meta = TABS[name]!;
    const focused = state.routes[state.index]?.key === route.key;
    return cell(route.key, meta.icon, meta.label, focused, () => {
      const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) navigateToTab(route.key);
    });
  };
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'flex-start',
        paddingTop: 8,
        paddingBottom: Math.max(insets.bottom, 12) + 4,
        backgroundColor: colors.nav,
        borderTopWidth: 1,
        borderTopColor: colors.line,
      }}
    >
      {tab('index')}
      {cell('play', 'play', 'Play', false, () => router.push('/match/new'), 'button')}
      {tab('tournaments')}
      {tab('profile')}
    </View>
  );
}
