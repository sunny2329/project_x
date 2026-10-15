import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LiveBadge } from '@/shared/components';
import { radius, spacing, typography, useTheme } from '@/shared/theme';
import type { FixtureView, StandingRow } from '../types';

/** One fixture: both entries (or "Winner of …" placeholders), score, court and time. */
export function FixtureCard({ fixture, onPress }: { fixture: FixtureView; onPress?: () => void }) {
  const { colors } = useTheme();
  const line = (i: 0 | 1) => {
    const entry = fixture.entries[i];
    const won = entry && fixture.winnerEntryId === entry.id;
    return (
      <Text style={[styles.entry, { color: entry ? colors.text : colors.textMuted, fontWeight: won ? '800' : '600' }]} numberOfLines={1}>
        {entry ? entry.name : (fixture.placeholders[i] ?? 'TBD')}
        {won ? <Text style={{ color: colors.primary }}> ✓</Text> : null}
      </Text>
    );
  };
  const meta = [
    fixture.match?.headline || (fixture.status === 'bye' ? 'Bye' : fixture.status === 'ready' ? 'Ready' : fixture.status === 'pending' ? 'Waiting' : null),
    fixture.court?.name,
    fixture.scheduledAt ? new Date(fixture.scheduledAt).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : null,
  ].filter(Boolean);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [styles.card, { backgroundColor: colors.surface, borderColor: fixture.status === 'live' ? colors.primary : colors.surfaceBorder, opacity: pressed ? 0.8 : 1 }]}
    >
      <View style={styles.row}>
        <View style={styles.flex}>
          {line(0)}
          {line(1)}
        </View>
        {fixture.status === 'live' ? <LiveBadge /> : null}
      </View>
      {meta.length ? <Text style={[typography.caption, { color: colors.textMuted }]}>{meta.join(' · ')}</Text> : null}
    </Pressable>
  );
}

/** Rounds side by side (scrolls horizontally on the event screen). */
export function Bracket({ fixtures, onPressFixture }: { fixtures: FixtureView[]; onPressFixture: (f: FixtureView) => void }) {
  const { colors } = useTheme();
  const rounds = [...new Set(fixtures.map((f) => f.round))].sort((a, b) => a - b);
  return (
    <View style={styles.bracket}>
      {rounds.map((round) => {
        const inRound = fixtures.filter((f) => f.round === round).sort((a, b) => a.position - b.position);
        return (
          <View key={round} style={styles.round}>
            <Text style={[typography.overline, { color: colors.textMuted }]}>{inRound[0]?.roundName ?? `Round ${round}`}</Text>
            {inRound.map((f) => (
              <FixtureCard key={f.id} fixture={f} onPress={() => onPressFixture(f)} />
            ))}
          </View>
        );
      })}
    </View>
  );
}

/** A group table: rank, entry, played, won, lost, game/set difference. */
export function StandingsTable({ rows }: { rows: StandingRow[] }) {
  const { colors } = useTheme();
  const cell = (value: string | number, flex?: boolean, bold?: boolean) => (
    <Text style={[flex ? styles.flex : styles.cell, { color: colors.text, fontWeight: bold ? '700' : '500' }]} numberOfLines={1}>
      {value}
    </Text>
  );
  return (
    <View style={styles.table}>
      <View style={styles.tr}>
        {['#', 'Entry', 'P', 'W', 'L', '+/−'].map((h, i) => (
          <Text key={h} style={[i === 1 ? styles.flex : styles.cell, typography.overline, { color: colors.textMuted }]}>
            {h}
          </Text>
        ))}
      </View>
      {rows.map((r) => (
        <View key={r.entryId} style={[styles.tr, { borderTopColor: colors.divider, borderTopWidth: StyleSheet.hairlineWidth }]}>
          {cell(r.rank)}
          {cell(r.name, true, r.rank === 1)}
          {cell(r.played)}
          {cell(r.won)}
          {cell(r.lost)}
          {cell(r.majorWon - r.majorLost)}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.field, borderWidth: 1, padding: spacing.md, gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  entry: { fontSize: 14 },
  bracket: { flexDirection: 'row', gap: spacing.md },
  round: { width: 200, gap: spacing.sm },
  table: { gap: 0 },
  tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.sm },
  cell: { width: 30, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
