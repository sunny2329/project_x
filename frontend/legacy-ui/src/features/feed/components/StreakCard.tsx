import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TextLink } from '@/shared/components';
import { radius, spacing, typography, useTheme } from '@/shared/theme';

interface StreakCardProps {
  /** Weeks in a row with a match. */
  weeks: number;
}

/** Strava's "Your streak" card: weeks in a row with at least one match, and a shortcut to start one. */
export function StreakCard({ weeks }: StreakCardProps) {
  const { colors } = useTheme();
  const active = weeks > 0;
  const message = active
    ? `${weeks} ${weeks === 1 ? 'week' : 'weeks'} in a row with a match. Play this week to keep it going.`
    : 'Start your streak by playing a match.';

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <View style={styles.header}>
        <Text style={[typography.sectionTitle, { color: colors.text }]}>Your streak</Text>
        <TextLink title="View matches" onPress={() => router.navigate('/matches')} />
      </View>
      <View style={styles.row}>
        <View style={styles.badge} accessibilityLabel={`${weeks} week streak`}>
          <MaterialCommunityIcons name="fire" size={30} color={active ? colors.primary : colors.icon} />
          <Text style={[styles.count, { color: colors.text }]}>{weeks}</Text>
          <Text style={[styles.unit, { color: colors.textMuted }]}>Weeks</Text>
        </View>
        <Text style={[styles.message, { color: colors.text }]}>{message}</Text>
        <Pressable
          onPress={() => router.navigate('/play')}
          accessibilityRole="button"
          accessibilityLabel="Play now"
          style={({ pressed }) => [styles.button, { backgroundColor: pressed ? colors.primaryPressed : colors.primary }]}
        >
          <Text style={[styles.buttonText, { color: colors.onPrimary }]}>Play now</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { paddingHorizontal: spacing.screen, paddingVertical: spacing.lg, gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  badge: { alignItems: 'center', width: 52 },
  count: { fontSize: 15, fontWeight: '800', marginTop: -2 },
  unit: { fontSize: 11 },
  message: { flex: 1, fontSize: 15, lineHeight: 21 },
  button: { borderRadius: radius.pill, paddingHorizontal: spacing.lg, height: 38, justifyContent: 'center' },
  buttonText: { fontSize: 14, fontWeight: '700' },
});
