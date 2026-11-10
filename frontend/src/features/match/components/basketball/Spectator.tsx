import { View } from 'react-native';
import { useTheme } from '@/shared/theme';
import { D, Row, T } from '@/shared/ui';
import { formatClock, hoopsRules, playClock, playText, roster, shortTeam, tagName, topScorer, type Roster } from '../../basketball';
import type { GameDetail, MatchView } from '../../types';
import { teamColor } from './Board';

const RED = '#FF5468';
const PLAYS = 6;

/** Watching a basketball game: the score card with period and clock, fouls and timeouts, play by play, leading scorers. */
export function HoopsSpectator({ match }: { match: MatchView }) {
  const { colors } = useTheme();
  const score = match.score;
  const g = score.game as GameDetail;
  const rules = hoopsRules(match.rulesetConfig);
  const names = match.sides.map((s) => s.name);
  const rosters: [Roster[], Roster[]] = [roster(match, 0), roster(match, 1)];
  const totals = [Number(score.sides[0]!.primary), Number(score.sides[1]!.primary)];
  const ball = g.possessionSideIndex;
  const tied = totals[0] === totals[1];
  const lead = tied ? null : totals[0]! > totals[1]! ? 0 : 1;
  const callout = score.callout
    ? score.callout.toUpperCase()
    : tied
      ? `TIED${ball === null ? '' : ` · ${shortTeam(names[ball]!).toUpperCase()} BALL`}`
      : `${shortTeam(names[lead!]!).toUpperCase()} BY ${Math.abs(totals[0]! - totals[1]!)}`;
  const plays = g.plays.slice(-PLAYS).reverse();
  const teamLine = (side: number) => {
    const t = g.teams[side]!;
    const other = g.teams[side === 0 ? 1 : 0]!;
    return { text: `Fouls ${t.fouls} · TO ${t.timeoutsLeft}`, bonus: other.bonus ? `${shortTeam(names[side]!)} in bonus` : null };
  };

  return (
    <>
      <View style={{ borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 18, paddingHorizontal: 12, paddingBottom: 12 }}>
          {[0, 1].map((side) => {
            const box = (
              <View key={side} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                <View style={{ width: 36, height: 6, borderRadius: 3, backgroundColor: side === 0 ? teamColor(match, 0, colors.soft) : (match.sides[1]?.color ?? colors.soft) }} />
                <D size={64} lh={58}>
                  {String(totals[side])}
                </D>
                <T size={13} w={700} numberOfLines={1}>
                  {shortTeam(names[side]!)}
                </T>
              </View>
            );
            if (side === 0) return box;
            return [
              <View key="mid" style={{ width: 96, alignItems: 'center', gap: 2 }}>
                <D size={18} color={colors.muted}>
                  {g.periodLabel}
                </D>
                <D size={34} lh={34} color={rules.timed && g.clock !== null && g.clock <= 60 ? RED : colors.fg}>
                  {g.clock === null ? '–' : formatClock(g.clock, rules.timed)}
                </D>
                <T size={11} color={colors.muted}>
                  at last play
                </T>
              </View>,
              box,
            ];
          })}
        </View>
        <Row between style={{ paddingVertical: 10, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: colors.raised }}>
          {[0, 1].map((side) => {
            const l = teamLine(side);
            return (
              <T key={side} size={13} color={colors.muted} right={side === 1} flex numberOfLines={2}>
                {l.text}
                {l.bonus ? (
                  <T size={13} w={700} color={colors.tBb}>
                    {` · ${l.bonus}`}
                  </T>
                ) : null}
              </T>
            );
          })}
        </Row>
        <View style={{ padding: 10, backgroundColor: colors.bbTint, alignItems: 'center' }}>
          <D size={22} ls={0.06} color={colors.tBb} numberOfLines={1}>
            {callout}
          </D>
        </View>
      </View>

      {plays.length ? (
        <View style={{ gap: 8 }}>
          <T size={12} w={700} ls={0.08} color={colors.muted}>
            PLAY BY PLAY
          </T>
          <View style={{ borderRadius: 16, backgroundColor: colors.surface, overflow: 'hidden' }}>
            {plays.map((p, i) => (
              <View key={p.seq} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 14, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.raised }}>
                <T size={12} color={colors.muted} style={{ width: 52 }}>
                  {playClock(p, rules.timed) || g.periodLabel}
                </T>
                <T size={14} flex numberOfLines={2}>
                  {playText(p, rosters, names, { threes: rules.threePointers })}
                </T>
                <D size={16} style={{ width: 54, textAlign: 'right' }} color={p.kind === 'score' ? colors.fg : colors.muted}>
                  {`${p.score[0]}–${p.score[1]}`}
                </D>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <Row gap={10}>
        {[0, 1].map((side) => {
          const top = topScorer(g, side);
          return (
            <View key={side} style={{ flex: 1, padding: 12, borderRadius: 14, backgroundColor: colors.surface, gap: 2 }}>
              <T size={11} w={700} ls={0.06} color={colors.muted}>
                LEADING · {shortTeam(names[side]!).toUpperCase()}
              </T>
              <Row gap={6}>
                <T size={15} w={700} numberOfLines={1} style={{ flexShrink: 1 }}>
                  {top ? tagName(rosters[side]![top.index]) : 'Nobody tagged'}
                </T>
                {top ? (
                  <D size={20} color={side === lead ? colors.tBb : colors.fg}>
                    {String(top.points)}
                  </D>
                ) : null}
              </Row>
            </View>
          );
        })}
      </Row>
    </>
  );
}
