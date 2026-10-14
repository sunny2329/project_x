import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { BottomTabBarProps } from 'expo-router/tabs';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { spacing, useTheme } from '@/shared/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export interface TabBarItem {
  /** Outline icon, shown while the tab is not selected. */
  icon: IconName;
  /** Filled icon for the selected tab. */
  activeIcon: IconName;
  label: string;
}

interface TabBarProps extends BottomTabBarProps {
  items: Record<string, TabBarItem>;
}

/** Strava-style bottom bar: five flat icon + label tabs; the selected one is filled and orange. */
export function TabBar({ state, navigation, insets, items }: TabBarProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.bar,
        { paddingBottom: Math.max(insets.bottom, spacing.sm), backgroundColor: colors.header, borderTopColor: colors.divider },
      ]}
    >
      {state.routes.map((route, index) => {
        const item = items[route.name];
        if (!item) return null;
        const focused = state.index === index;
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        };
        const tint = focused ? colors.primary : colors.text;

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: focused }}
            style={({ pressed }) => [styles.slot, pressed && { opacity: 0.6 }]}
          >
            <MaterialCommunityIcons name={focused ? item.activeIcon : item.icon} size={26} color={tint} />
            <Text style={[styles.label, { color: tint }]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm },
  slot: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 48 },
  label: { fontSize: 11, fontWeight: '600' },
});
