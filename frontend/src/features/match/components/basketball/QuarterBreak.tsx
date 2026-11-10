import { useState } from 'react';
import { View } from 'react-native';
import { useNow } from '@/shared/hooks/useNow';
import { useTheme } from '@/shared/theme';
import { Button, D, Icon, IconButton, Row, T } from '@/shared/ui';
import { breakLine, formatClock, hoopsRules, roster, shortTeam, tagName, topScorer, type HoopsRules } from '../../basketball';
import type { GameDetail, MatchView, ScoreSummary } from '../../types';
import { teamColor } from './Board';

/** Score per period: Q1..Q4 (OT when played) and the total, one row per team. */
export function PeriodTable({ match, score, rules, highlight }: { match: MatchView; score: ScoreSummary; rules: Pick<HoopsRules, 'periods'>; highlight?: number | null }) {
  const { colors } = useTheme();
  const g = score.game as GameDetail;
  const played = score.segments.filter((s) => s.type !== 'game');
  const labels = Array.from({ length: Math.max(rules.periods, played.length) }, (_, i) => played[i]?.label ?? (rules.periods === 4 ? `Q${i + 1}` : rules.periods === 2 ? `H${i + 1}` : 'Game'));
  const cols = labels.length;
  const cell = cols > 5 ? 32 : 40;
  const now = g.period;
  return (
    <View style={{ borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' }}>
      <Row style={{ paddingTop: 10, paddingHorizontal: 14, paddingBottom: 6 }}>
        <View style={{ flex: 1 }} />
        {labels.map((l) => (
          <T key={l} size={11} w={700} color={colors.muted} center style={{ width: cell }}>
            {l}
          </T>
        ))}
        <T size={11} w={700} color={colors.muted} center style={{ width: 48 }}>
          T
        </T>
      </Row>
      {[0, 1].map((side) => (
        <Row key={side} style={{ paddingVertical: 10, paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: colors.line }}>
          <Row gap={8} style={{ flex: 1, minWidth: 0 }}>
            <View style={{ width: 4, height: 18, borderRadius: 2, backgroundColor: teamColor(match, side, colors.sideB) }} />
            <T size={14} w={700} numberOfLines={1} flex>
              {shortTeam(match.sides[side]?.name ?? '')}
            </T>
          </Row>
          {labels.map((l, i) => {
            const seg = played[i];
            const shown = seg && (seg.complete || i + 1 < now || seg.scores.some((n) => n > 0));
            return (
              <T key={l} size={14} w={600} center color={shown ? colors.fg : colors.faint} style={{ width: cell }}>
                {shown ? String(seg.scores[side] ?? 0) : '–'}
              </T>
            );
          })}
          <D size={20} center color={highlight === side ? colors.tBb : colors.fg} style={{ width: 48 }}>
            {String(score.sides[side]!.primary)}
          </D>
        </Row>
      ))}
    </View>
  );
}

const BREAK_SECONDS = 120;
const HALF_TIME_SECONDS = 600;

/**
 * Between periods of a timed game: the score, a period table, top scorers, and what carries over
 * (fouls reset, timeouts left, who gets the ball). "Start Q4" goes back to the scoreboard.
 */
export function QuarterBreakView({ match, score, onBack, onStart, onBoxScore }: { match: MatchView; score: ScoreSummary; onBack: () => void; onStart: () => void; onBoxScore: () => void }) {
  const { colors } = useTheme();
  const g = score.game as GameDetail;
  const rules = hoopsRules(match.rulesetConfig);
  const [since] = useState(() => Date.now());
  const now = useNow(1000);
  const names = match.sides.map((s) => s.name);
  const ended = g.periods === 4 ? `Q${g.period - 1}` : g.periods === 2 ? `H${g.period - 1}` : 'regulation';
  const endedLabel = g.period - 1 > g.periods ? (g.period - 1 === g.periods + 1 ? 'OT' : `OT${g.period - 1 - g.periods}`) : ended;
  const halfTime = rules.periods === 4 && g.period === 3;
  const left = Math.max(0, (halfTime ? HALF_TIME_SECONDS : BREAK_SECONDS) - (now - since) / 1000);
  const totals = [Number(score.sides[0]!.primary), Number(score.sides[1]!.primary)];
  const lead = totals[0] === totals[1] ? null : totals[0]! > totals[1]! ? 0 : 1;
  const ball = g.possessionSideIndex ?? 0;
  const rosters = [roster(match, 0), roster(match, 1)];
  const teamFouls = rules.teamFoulsPer === 'period' ? `Reset to 0 for ${g.periodLabel}` : `${shortTeam(names[0]!)} ${g.teams[0]!.fouls} · ${shortTeam(names[1]!)} ${g.teams[1]!.fouls}`;
  return (
    <View style={{ flex: 1, gap: 16 }}>
      <Row between>
        <IconButton icon="back" label="Back to scoreboard" onPress={onBack} />
        <Row gap={6} style={{ height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.bbTint }}>
          <Icon name="clock" size={14} color={colors.tBb} />
          <T size={13} w={800} color={colors.tBb}>
            {halfTime ? 'Half-time' : 'Break'} {formatClock(left)}
          </T>
        </Row>
        <View style={{ width: 44 }} />
      </Row>

      <View style={{ alignItems: 'center', gap: 4 }}>
        <D size={20} ls={0.08} color={colors.muted}>
          {`END OF ${endedLabel.toUpperCase()}`}
        </D>
        <Row gap={18}>
          {[0, 1].map((side) => (
            <View key={side} style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
              {side === 1 ? (
                <D size={30} color={colors.faint}>
                  –
                </D>
              ) : null}
              <View style={{ alignItems: 'center' }}>
                <D size={84} lh={76} color={lead === side ? colors.tBb : colors.fg}>
                  {String(totals[side])}
                </D>
                <T size={13} w={700} numberOfLines={1}>
                  {shortTeam(names[side]!)}
                </T>
              </View>
            </View>
          ))}
        </Row>
        <T size={13} color={colors.muted} center>
          {breakLine(score, names, rules)}
        </T>
      </View>

      <PeriodTable match={match} score={score} rules={rules} highlight={lead} />

      <Row gap={10}>
        {[0, 1].map((side) => {
          const top = topScorer(g, side);
          const r = top ? rosters[side]![top.index] : undefined;
          return (
            <View key={side} style={{ flex: 1, padding: 12, borderRadius: 14, backgroundColor: colors.surface, gap: 4 }}>
              <T size={11} w={700} ls={0.06} color={colors.muted}>
                TOP SCORER
              </T>
              <T size={15} w={700} numberOfLines={1}>
                {top ? tagName(r) : '–'}
              </T>
              <T size={12} color={colors.muted} numberOfLines={1}>
                {top ? `${top.points} pts · ${shortTeam(names[side]!)}` : `Nobody tagged · ${shortTeam(names[side]!)}`}
              </T>
            </View>
          );
        })}
      </Row>

      <View style={{ gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: colors.raised }}>
        <Row between gap={10}>
          <T size={14} color={colors.muted}>
            Team fouls
          </T>
          <T size={14} w={700} right flex numberOfLines={1}>
            {teamFouls}
          </T>
        </Row>
        <Row between gap={10}>
          <T size={14} color={colors.muted}>
            Timeouts left
          </T>
          <T size={14} w={700} right flex numberOfLines={1}>
            {shortTeam(names[0]!)} {g.teams[0]!.timeoutsLeft} · {shortTeam(names[1]!)} {g.teams[1]!.timeoutsLeft}
          </T>
        </Row>
        <Row between gap={10}>
          <T size={14} color={colors.muted}>
            {g.periodLabel} starts with
          </T>
          <T size={14} w={700} color={colors.tBb} right flex numberOfLines={1}>
            {shortTeam(names[ball]!)} ball (arrow)
          </T>
        </Row>
      </View>

      <View style={{ marginTop: 'auto', gap: 10 }}>
        <Button label={`Start ${g.periodLabel}`} weight={800} height={56} radius={16} onPress={onStart} />
        <Button label="See full box score" variant="ghost" height={44} size={14} onPress={onBoxScore} />
      </View>
    </View>
  );
}
