import { Tabs } from 'expo-router';
import { useTheme } from '@/shared/theme';
import { TabBar } from '@/shared/ui';

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="tournaments" />
      <Tabs.Screen name="chats" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
