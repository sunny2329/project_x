import { Tabs } from 'expo-router';
import { TabBar, type TabBarItem } from '@/shared/components';
import { useTheme } from '@/shared/theme';

const ITEMS: Record<string, TabBarItem> = {
  index: { icon: 'home-outline', activeIcon: 'home', label: 'Home' },
  sports: { icon: 'compass-outline', activeIcon: 'compass', label: 'Sports' },
  play: { icon: 'record-circle-outline', activeIcon: 'record-circle', label: 'Play' },
  matches: { icon: 'scoreboard-outline', activeIcon: 'scoreboard', label: 'Matches' },
  profile: { icon: 'account-circle-outline', activeIcon: 'account-circle', label: 'You' },
};

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} items={ITEMS} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background } }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="sports" />
      <Tabs.Screen name="play" />
      <Tabs.Screen name="matches" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
