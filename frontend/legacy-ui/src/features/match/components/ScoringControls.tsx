import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, spacing, useTheme } from '@/shared/theme';
import type { MatchView, PluginEvent } from '../types';

interface ControlsProps {
  match: Pick<MatchView, 'sides' | 'score'>;
  busy: boolean;
  onEvent: (event: PluginEvent) => void;
}

/**
 * The scorer's buttons, exactly as the scoring plugin offers them (`score.actions`): one big
 * button per side ("Point", or "Side out" / "Second server" in side-out pickleball), and any
 * match-level actions underneath. No sport-specific code: a new sport brings its own actions.
 */
export function ScoringControls({ match, busy, onEvent }: ControlsProps) {
  const { colors } = useTheme();
  const sideActions = match.sides.map((side) => ({ side, actions: match.score.actions.filter((a) => a.sideIndex === side.index) }));
  const general = match.score.actions.filter((a) => a.sideIndex === null);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {sideActions.map(({ side, actions }) => (
          <View key={side.index} style={styles.column}>
            {actions.map((action) => (
              <Pressable
                key={action.id}
                onPress={() => onEvent(action.event)}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={`${action.label}, ${side.name}`}
                style={({ pressed }) => [
                  styles.big,
                  { backgroundColor: pressed ? colors.primaryPressed : colors.primary, opacity: busy ? 0.6 : 1 },
                ]}
              >
                <Text style={[styles.bigLabel, { color: colors.onPrimary }]}>{action.label}</Text>
                <Text style={[styles.bigSide, { color: colors.onPrimary }]} numberOfLines={1}>
                  {side.name}
                </Text>
              </Pressable>
            ))}
          </View>
        ))}
      </View>
      {general.map((action) => (
        <Pressable
          key={action.id}
          onPress={() => onEvent(action.event)}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          style={({ pressed }) => [styles.small, { backgroundColor: pressed ? colors.secondaryButtonPressed : colors.secondaryButton }]}
        >
          <Text style={[styles.smallLabel, { color: colors.text }]}>{action.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  column: { flex: 1, gap: spacing.sm },
  big: { minHeight: 112, borderRadius: radius.card, alignItems: 'center', justifyContent: 'center', padding: spacing.md, gap: spacing.xs },
  bigLabel: { fontSize: 22, fontWeight: '800' },
  bigSide: { fontSize: 14, fontWeight: '600', opacity: 0.9 },
  small: { borderRadius: radius.field, paddingVertical: spacing.md, alignItems: 'center' },
  smallLabel: { fontSize: 15, fontWeight: '700' },
});
