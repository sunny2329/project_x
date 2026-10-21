import { StyleSheet, Text, View } from 'react-native';
import { TeamBadge } from '@/shared/components';
import { radius, spacing, typography, useTheme } from '@/shared/theme';
import { playedSegments } from '../format';
import type { MatchView } from '../types';

/**
 * Hero scoreboard, drawn only from the generic ScoreSummary: per side the big number (games or
 * sets), the running score (points, 15/30/40/AD), who serves, the callout ("Deuce", "4-7-2",
 * "Match point"), and every game or set so far.
 */
export function Scoreboard({ match }: { match: Pick<MatchView, 'sides' | 'score' | 'status'> }) {
  const { colors } = useTheme();
  const { score } = match;
  const live = match.status === 'live' && !score.complete;
  const segments = playedSegments(score.segments);

  return (
    <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
      {match.sides.map((side) => {
        const s = score.sides[side.index];
        const winner = score.winnerSideIndex === side.index;
        const server = s?.serving && s.serverPlayerIndex !== null ? side.players[s.serverPlayerIndex] : undefined;
        return (
          <View key={side.index} style={styles.sideRow} accessibilityLabel={`${side.name}: ${s?.primary ?? 0}${s?.current ? `, ${s.current}` : ''}${s?.serving ? ', serving' : ''}`}>
            <TeamBadge name={side.name} size={40} />
            <View style={styles.sideName}>
              <Text style={[styles.name, { color: colors.text, fontWeight: winner ? '800' : '700' }]} numberOfLines={1}>
                {side.name}
                {winner ? <Text style={{ color: colors.primary }}> ✓</Text> : null}
              </Text>
              {live && s?.serving ? (
                <Text style={[typography.caption, { color: colors.primary }]} numberOfLines={1}>
                  ● Serving{server && side.players.length > 1 ? ` · ${server.displayName}` : ''}
                  {s.serverNumber ? ` · server ${s.serverNumber}` : ''}
                  {s.serveNote ? ` · ${s.serveNote}` : ''}
                </Text>
              ) : null}
            </View>
            <Text style={[styles.primary, { color: colors.text }]}>{s?.primary ?? '0'}</Text>
            {live ? (
              <View style={[styles.current, { backgroundColor: colors.primarySoft }]}>
                <Text style={[styles.currentText, { color: colors.primary }]}>{s?.current ?? ''}</Text>
              </View>
            ) : null}
          </View>
        );
      })}

      {score.callout ? (
        <View style={[styles.callout, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}>
          <Text style={[styles.calloutText, { color: colors.primary }]}>{score.callout}</Text>
        </View>
      ) : null}

      {segments.length ? (
        <View style={[styles.segments, { borderTopColor: colors.divider }]}>
          {segments.map((seg) => (
            <View key={`${seg.type}-${seg.sequence}`} style={styles.segmentRow}>
              <Text style={[typography.caption, styles.segmentLabel, { color: colors.textMuted }]}>{seg.label}</Text>
              {seg.display.map((value, i) => (
                <Text
                  key={i}
                  style={[styles.segmentScore, { color: seg.complete ? (seg.winnerSideIndex === i ? colors.text : colors.textMuted) : colors.primary }]}
                >
                  {value}
                </Text>
              ))}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.card, borderWidth: 1, padding: spacing.lg, gap: spacing.md },
  sideRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  sideName: { flex: 1, gap: 2 },
  name: { fontSize: 17 },
  primary: { fontSize: 34, fontWeight: '800', fontVariant: ['tabular-nums'], minWidth: 34, textAlign: 'right' },
  current: { minWidth: 56, borderRadius: radius.field, paddingVertical: spacing.xs, alignItems: 'center' },
  currentText: { fontSize: 26, fontWeight: '800', fontVariant: ['tabular-nums'] },
  callout: { alignSelf: 'center', borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs + 2 },
  calloutText: { fontSize: 14, fontWeight: '800', letterSpacing: 0.3 },
  segments: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.md, gap: spacing.xs },
  segmentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  segmentLabel: { flex: 1 },
  segmentScore: { minWidth: 32, textAlign: 'right', fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
