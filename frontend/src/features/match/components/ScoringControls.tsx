import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { OutlineButton } from '@/shared/components';
import { radius, spacing, typography, useTheme } from '@/shared/theme';
import type { BallExtra, MatchDetail, ScoreEvent, Side } from '../types';

interface ControlsProps {
  match: MatchDetail;
  busy: boolean;
  onEvent: (event: ScoreEvent) => void;
}

/** The scorer's buttons for the match's sport. */
export function ScoringControls(props: ControlsProps) {
  switch (props.match.score.kind) {
    case 'rally':
      return <SideButtons {...props} label="+1" hint="point" type="point" />;
    case 'timed_goals':
      return <FootballControls {...props} />;
    case 'overs':
      return <CricketControls {...props} />;
  }
}

function sideName(match: MatchDetail, side: Side): string {
  return match.sides.find((s) => s.no === side)?.name ?? `Side ${side}`;
}

/** One big button per side: a point (rally sports) or a goal (football). */
function SideButtons({ match, busy, onEvent, label, hint, type }: ControlsProps & { label: string; hint: string; type: 'point' | 'goal' }) {
  const { colors } = useTheme();
  return (
    <View style={styles.sideButtons}>
      {([1, 2] as const).map((side) => (
        <Pressable
          key={side}
          onPress={() => onEvent({ type, side })}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={`${hint} for ${sideName(match, side)}`}
          style={({ pressed }) => [
            styles.bigButton,
            { backgroundColor: pressed ? colors.primaryPressed : colors.primary, shadowColor: colors.primary },
            busy && styles.busy,
          ]}
        >
          <Text style={[styles.bigLabel, { color: colors.onPrimary }]}>{label}</Text>
          <Text style={[styles.bigName, { color: colors.onPrimary }]} numberOfLines={1}>
            {sideName(match, side)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function FootballControls(props: ControlsProps) {
  const { match, busy, onEvent } = props;
  const lastPeriod = match.config.kind === 'timed_goals' && match.score.periods.length >= match.config.periods;
  return (
    <View style={styles.stack}>
      <SideButtons {...props} label="Goal" hint="Goal" type="goal" />
      <OutlineButton
        title={lastPeriod ? 'End match' : `End ${match.score.currentPeriod.label}`}
        onPress={() => onEvent({ type: 'period_end' })}
        disabled={busy}
      />
    </View>
  );
}

const RUNS = [0, 1, 2, 3, 4, 5, 6];

/** Mark wide / no-ball / wicket first if needed, then tap the runs. */
function CricketControls({ match, busy, onEvent }: ControlsProps) {
  const { colors } = useTheme();
  const [extra, setExtra] = useState<BallExtra>('none');
  const [wicket, setWicket] = useState(false);
  const batting = match.score.cricket ? sideName(match, match.score.cricket.battingSide) : '';

  function bowl(runs: number) {
    onEvent({ type: 'ball', runs, extra, wicket });
    setExtra('none');
    setWicket(false);
  }

  const toggles: { label: string; active: boolean; onPress: () => void }[] = [
    { label: 'Wide', active: extra === 'wide', onPress: () => setExtra(extra === 'wide' ? 'none' : 'wide') },
    { label: 'No ball', active: extra === 'no_ball', onPress: () => setExtra(extra === 'no_ball' ? 'none' : 'no_ball') },
    { label: 'Wicket', active: wicket, onPress: () => setWicket(!wicket) },
  ];

  return (
    <View style={styles.stack}>
      <Text style={[typography.caption, styles.center, { color: colors.textMuted }]}>{batting} batting · tap the runs for each ball</Text>
      <View style={styles.toggles}>
        {toggles.map((toggle) => (
          <Pressable
            key={toggle.label}
            onPress={toggle.onPress}
            accessibilityRole="switch"
            accessibilityState={{ checked: toggle.active }}
            style={[
              styles.toggle,
              {
                backgroundColor: toggle.active ? (toggle.label === 'Wicket' ? colors.error : colors.primary) : colors.surface,
                borderColor: toggle.active ? 'transparent' : colors.surfaceBorder,
              },
            ]}
          >
            <Text style={[styles.toggleText, { color: toggle.active ? colors.onPrimary : colors.text }]}>{toggle.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.runs}>
        {RUNS.map((runs) => (
          <Pressable
            key={runs}
            onPress={() => bowl(runs)}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={`${runs} run${runs === 1 ? '' : 's'}${extra !== 'none' ? `, ${extra.replace('_', ' ')}` : ''}${wicket ? ', wicket' : ''}`}
            style={({ pressed }) => [
              styles.run,
              {
                backgroundColor:
                  runs === 4 || runs === 6 ? colors.primary : pressed ? colors.secondaryButtonPressed : colors.secondaryButton,
              },
              busy && styles.busy,
            ]}
          >
            <Text style={[styles.runText, { color: runs === 4 || runs === 6 ? colors.onPrimary : colors.text }]}>{runs}</Text>
          </Pressable>
        ))}
      </View>
      <OutlineButton title="End innings" onPress={() => onEvent({ type: 'innings_end' })} disabled={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  center: { textAlign: 'center' },
  sideButtons: { flexDirection: 'row', gap: spacing.md },
  bigButton: {
    flex: 1,
    height: 120,
    borderRadius: radius.field + 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  bigLabel: { fontSize: 34, fontWeight: '800' },
  bigName: { fontSize: 13, fontWeight: '700' },
  busy: { opacity: 0.6 },
  toggles: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },
  toggle: {
    flex: 1,
    height: 38,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleText: { fontSize: 13, fontWeight: '700' },
  runs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  run: { width: '22%', aspectRatio: 1.35, borderRadius: radius.field, alignItems: 'center', justifyContent: 'center' },
  runText: { fontSize: 24, fontWeight: '800' },
});
