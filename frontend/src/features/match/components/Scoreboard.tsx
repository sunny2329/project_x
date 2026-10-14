import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { TeamBadge } from '@/shared/components';
import { radius, spacing, typography, useTheme } from '@/shared/theme';
import { chaseText, formatClock, sideScore } from '../format';
import type { MatchDetail, Side } from '../types';

/** Hero scoreboard: both sides with badge and big score, the current period pill in the middle, cricket extras below. */
export function Scoreboard({ match }: { match: MatchDetail }) {
  const { colors } = useTheme();
  const { score } = match;
  const live = match.status === 'live' && !score.finished;
  const chase = chaseText(match);

  return (
    <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
      <View style={styles.row}>
        <SideColumn match={match} side={1} />
        <View style={styles.middle}>
          <Text style={[styles.vs, { color: colors.textMuted }]}>VS</Text>
          <View style={[styles.periodPill, { backgroundColor: live ? colors.primary : colors.secondaryButton }]}>
            {live ? <View style={[styles.dot, { backgroundColor: colors.onPrimary }]} /> : null}
            <Text style={[styles.periodText, { color: live ? colors.onPrimary : colors.textMuted }]} numberOfLines={1}>
              {score.finished ? 'Final' : score.currentPeriod.label}
            </Text>
          </View>
          {live && match.config.kind === 'timed_goals' && match.currentPeriodStartedAt ? (
            <PeriodClock startedAt={match.currentPeriodStartedAt} minutes={match.config.periodMinutes} />
          ) : null}
        </View>
        <SideColumn match={match} side={2} />
      </View>

      {chase ? (
        <View style={[styles.chase, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}>
          <Text style={[styles.chaseText, { color: colors.primary }]}>🔥 {chase}</Text>
        </View>
      ) : null}

      {score.cricket && score.cricket.thisOver.length > 0 && live ? (
        <View style={styles.over}>
          <Text style={[typography.caption, { color: colors.textMuted, fontWeight: '700' }]}>This over</Text>
          <View style={styles.balls}>
            {score.cricket.thisOver.map((ball, index) => (
              <Ball key={`${index}-${ball}`} ball={ball} />
            ))}
          </View>
        </View>
      ) : null}

      {score.periods.length > 1 || score.finished ? (
        <View style={[styles.periods, { borderTopColor: colors.divider }]}>
          {score.periods.map((period) => (
            <View key={period.no} style={styles.periodRow}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>{period.label}</Text>
              <Text style={[styles.periodScore, { color: period.finished ? colors.text : colors.primary }]}>
                {period.score[0]} – {period.score[1]}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** A ball of the current over: 4 in blue, 6 in orange, wickets in red, the rest neutral. */
function Ball({ ball }: { ball: string }) {
  const { colors } = useTheme();
  const wicket = ball.includes('W') && !ball.startsWith('Wd');
  const bg = wicket ? colors.error : ball === '4' ? '#3B82F6' : ball === '6' ? colors.primary : colors.secondaryButton;
  const highlighted = bg !== colors.secondaryButton;
  return (
    <View style={[styles.ball, { backgroundColor: bg, borderColor: highlighted ? bg : colors.surfaceBorder }]}>
      <Text style={[styles.ballText, { color: highlighted ? '#FFFFFF' : colors.text }]}>{ball}</Text>
    </View>
  );
}

function SideColumn({ match, side }: { match: MatchDetail; side: Side }) {
  const { colors } = useTheme();
  const name = match.sides.find((s) => s.no === side)?.name ?? `Side ${side}`;
  const { main, sub } = sideScore(match.score, side);
  const winner = match.score.finished && match.score.winner === side;
  const batting = match.status === 'live' && !match.score.finished && match.score.cricket?.battingSide === side;
  const trailing = match.score.cricket && !batting && match.status === 'live' && !match.score.finished;

  return (
    <View style={styles.side}>
      <TeamBadge name={name} size={52} />
      <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
        {name}
        {batting ? <Text style={{ color: colors.primary }}> •</Text> : null}
      </Text>
      <Text
        style={[styles.main, { color: winner ? colors.primary : trailing ? colors.textMuted : colors.text }]}
        adjustsFontSizeToFit
        numberOfLines={1}
      >
        {main}
      </Text>
      {sub ? <Text style={[typography.caption, { color: colors.textMuted }]}>{sub}</Text> : null}
      {winner ? <Text style={[styles.tag, { color: colors.primary }]}>WINNER</Text> : null}
    </View>
  );
}

/** Time since the half started, e.g. "12:05 / 20:00"; turns orange once the half's time is up. */
function PeriodClock({ startedAt, minutes }: { startedAt: string; minutes: number }) {
  const { colors } = useTheme();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const elapsed = now - new Date(startedAt).getTime();
  const over = elapsed > minutes * 60_000;
  return (
    <View style={styles.clock}>
      <Text style={[styles.clockText, { color: over ? colors.primary : colors.text }]}>{formatClock(elapsed)}</Text>
      <Text style={[typography.caption, { color: colors.textMuted }]}>of {minutes}:00</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth * 2, padding: spacing.lg, gap: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  side: { flex: 1, alignItems: 'center', gap: spacing.xs },
  name: { fontSize: 14, fontWeight: '700', textAlign: 'center', minHeight: 20 },
  main: { fontSize: 46, fontWeight: '800', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  tag: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  middle: { width: 88, alignItems: 'center', paddingTop: spacing.md, gap: spacing.sm },
  vs: { fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  periodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    maxWidth: 88,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  periodText: { fontSize: 11, fontWeight: '800' },
  clock: { alignItems: 'center' },
  clockText: { fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  chase: { borderRadius: radius.field, borderWidth: 1, paddingVertical: spacing.md, alignItems: 'center' },
  chaseText: { fontSize: 15, fontWeight: '700' },
  over: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  balls: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  ball: {
    minWidth: 30,
    height: 30,
    paddingHorizontal: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ballText: { fontSize: 12, fontWeight: '800' },
  periods: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.md, gap: spacing.xs + 2 },
  periodRow: { flexDirection: 'row', justifyContent: 'space-between' },
  periodScore: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
