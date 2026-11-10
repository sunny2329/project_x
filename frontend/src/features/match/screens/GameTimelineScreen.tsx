import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Share, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Line, Polygon, Polyline, Rect } from 'react-native-svg';
import { useResource } from '@/shared/hooks/useResource';
import { useTheme } from '@/shared/theme';
import { Button, D, EmptyState, Header, IconButton, Loading, Row, Screen, T } from '@/shared/ui';
import { matchApi, shareUrl } from '../api/match.api';
import { flowStats, hoopsRules, marginSeries, moments, roster, shortTeam, type Moment } from '../basketball';
import { teamColor } from '../components/basketball/Board';
import { PlayerTable } from '../components/basketball/BoxScore';
import type { GameDetail, MatchView } from '../types';

const CW = 330;
const CH = 96;
const TAGS: Record<Moment['kind'], string> = { tip: 'START', pts: '', to: 'TIMEOUT', end: 'PERIOD', foul: 'FOUL', out: 'FOULED OUT', run: 'SCORING RUN', sub: 'SUB' };

export function periodName(periods: number, p: number): string {
  if (p > periods) return p - periods === 1 ? 'OT' : `OT${p - periods}`;
  return periods === 4 ? `Q${p}` : periods === 2 ? `H${p}` : 'Game';
}

/** The lead line: above the middle = side 0 ahead (its colour), below = side 1. */
function LeadChart({ match, game }: { match: MatchView; game: GameDetail }) {
  const { colors } = useTheme();
  const rules = hoopsRules(match.rulesetConfig);
  const periods = Math.max(game.periods, game.period > game.periods ? game.period : 0, ...game.plays.map((p) => p.period));
  const series = marginSeries(game.plays, periods, rules);
  const max = Math.max(4, ...series.map(([, m]) => Math.abs(m)));
  const pts = series.map(([x, m]) => `${(x * CW).toFixed(1)},${(CH / 2 - (m / max) * (CH / 2 - 4)).toFixed(1)}`);
  const line = pts.join(' ');
  const last = series.at(-1)!;
  const area = `0,${CH / 2} ${line} ${(last[0] * CW).toFixed(1)},${CH / 2}`;
  let total = 0;
  const bounds: number[] = [];
  for (let p = 1; p <= periods; p += 1) total += rules.periodSeconds(p);
  let acc = 0;
  for (let p = 1; p < periods; p += 1) {
    acc += rules.periodSeconds(p);
    bounds.push((acc / total) * CW);
  }
  const a = teamColor(match, 0, colors.wDot);
  const b = match.sides[1]?.color ?? colors.wDot;
  return (
    <Svg width="100%" height={CH} viewBox={`0 0 ${CW} ${CH}`} preserveAspectRatio="none">
      <Defs>
        <ClipPath id="tlUp">
          <Rect x={0} y={0} width={CW} height={CH / 2} />
        </ClipPath>
        <ClipPath id="tlDn">
          <Rect x={0} y={CH / 2} width={CW} height={CH / 2} />
        </ClipPath>
      </Defs>
      {bounds.map((x, i) => (
        <Line key={i} x1={x} y1={0} x2={x} y2={CH} stroke={game.periods === 4 && i === 1 ? colors.line2 : colors.line} strokeWidth={1} strokeDasharray={game.periods === 4 && i === 1 ? '3 3' : undefined} />
      ))}
      <Polygon points={area} fill={a} opacity={0.35} clipPath="url(#tlUp)" />
      <Polygon points={area} fill={b} opacity={0.35} clipPath="url(#tlDn)" />
      <Line x1={0} y1={CH / 2} x2={CW} y2={CH / 2} stroke={colors.line2} strokeWidth={1} />
      <Polyline points={line} fill="none" stroke={colors.fg} strokeWidth={2} strokeLinejoin="round" />
      <Circle cx={last[0] * CW} cy={CH / 2 - (last[1] / max) * (CH / 2 - 4)} r={3.5} fill={last[1] >= 0 ? a : b} stroke={colors.fg} strokeWidth={1.5} />
    </Svg>
  );
}

/** One sentence about how the game went, from the flow stats. */
function summaryText(match: MatchView, game: GameDetail): string {
  const names = match.sides.map((s) => shortTeam(s.name));
  const stats = flowStats(game.plays);
  const totals = [Number(match.score.sides[0]!.primary), Number(match.score.sides[1]!.primary)];
  const w = match.score.winnerSideIndex;
  const parts: string[] = [];
  if (w !== null) parts.push(`${names[w]} won ${totals[w]}–${totals[w === 0 ? 1 : 0]}${game.period > game.periods && game.periods > 1 ? ' in overtime' : ''}.`);
  else parts.push(totals[0] === totals[1] ? `Level at ${totals[0]}.` : `${names[totals[0]! > totals[1]! ? 0 : 1]} lead ${Math.max(...totals)}–${Math.min(...totals)}.`);
  if (stats.leadChanges) parts.push(`The lead changed hands ${stats.leadChanges} time${stats.leadChanges === 1 ? '' : 's'}.`);
  if (stats.bestRun && stats.bestRun.points >= 6) parts.push(`Best run: ${names[stats.bestRun.side]} ${stats.bestRun.points}–0.`);
  return parts.join(' ');
}

/** "Game summary": the lead by minute, flow stats, key moments or a period's plays, and the box score. */
export default function GameTimelineScreen() {
  const { colors } = useTheme();
  const { id, tab: initialTab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const { data, error, loading } = useResource(() => matchApi.get(id), [id]);
  const [tab, setTab] = useState<string>(initialTab === 'box' ? 'box' : 'key');

  if (loading) return <Loading />;
  const m = data?.match;
  const g = m?.score.game;
  if (!m || !g) {
    return (
      <Screen>
        <Header />
        <EmptyState title="Couldn’t load the game" body={error ?? 'This game has no play-by-play.'} />
      </Screen>
    );
  }

  const rules = hoopsRules(m.rulesetConfig);
  const names = m.sides.map((s) => s.name);
  const rosters = [roster(m, 0), roster(m, 1)] as [ReturnType<typeof roster>, ReturnType<typeof roster>];
  const live = m.status === 'live';
  const w = m.score.winnerSideIndex;
  const finalText = !live && w !== null ? `Final · ${shortTeam(names[w]!)} win` : null;
  const all = moments(g.plays, rosters, names, (p) => periodName(g.periods, p), rules.threePointers, finalText);
  const periods = [...new Set(g.plays.map((p) => p.period))].sort((a, b) => a - b);
  const list = tab === 'key' ? all.filter((e) => e.key_) : all.filter((e) => String(e.period) === tab);
  const stats = flowStats(g.plays);
  const totals = [Number(m.score.sides[0]!.primary), Number(m.score.sides[1]!.primary)];
  const fills = [teamColor(m, 0, colors.wDot), m.sides[1]?.color ?? colors.wDot];
  const tabs: [string, string][] = [['key', 'Key moments'], ...periods.map((p): [string, string] => [String(p), periodName(g.periods, p)]), ['box', 'Box']];
  const share = () => void Share.share({ message: `${names.join(' vs ')}: ${m.score.headline}\n${shareUrl(m)}`, url: shareUrl(m) });

  return (
    <Screen gap={12}>
      <Row gap={12}>
        <IconButton icon="back" label="Back" onPress={() => router.back()} />
        <View style={{ flex: 1 }}>
          <T size={12} color={colors.muted}>
            {m.format.code} {rules.half ? 'half court' : 'full court'} · {live ? `Live · ${g.periodLabel}` : 'Final'}
          </T>
          <T size={17} w={700}>
            Game summary
          </T>
        </View>
        <IconButton icon="share" label="Share summary" onPress={share} />
      </Row>

      <View style={{ borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, paddingVertical: 12, paddingHorizontal: 14, gap: 8 }}>
        <Row gap={10}>
          <View style={{ flex: 1, gap: 2 }}>
            {[0, 1].map((side) => (
              <Row key={side} gap={6}>
                <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: fills[side] }} />
                <T size={14} w={side === (w ?? -1) ? 800 : 600} color={side === (w ?? -1) || w === null ? colors.fg : colors.muted} numberOfLines={1} flex>
                  {shortTeam(names[side]!)}
                </T>
              </Row>
            ))}
          </View>
          <D size={40} lh={40}>
            {String(totals[0])}
            <D size={40} color={colors.faint}>
              {' – '}
            </D>
            <D size={40} color={colors.muted}>
              {String(totals[1])}
            </D>
          </D>
        </Row>
        <T size={13} lh={19} color={colors.soft}>
          {summaryText(m, g)}
        </T>
        <Row between>
          <T size={10} w={800} ls={0.06} color={colors.muted}>
            {shortTeam(names[0]!).toUpperCase()} AHEAD ▲
          </T>
          <T size={10} w={800} ls={0.06} color={colors.muted}>
            {rules.timed ? 'LEAD BY MINUTE' : 'LEAD BY BASKET'}
          </T>
        </Row>
        <LeadChart match={m} game={g} />
        <Row between>
          <T size={10} w={800} ls={0.06} color={colors.muted}>
            {shortTeam(names[1]!).toUpperCase()} AHEAD ▼
          </T>
          {g.periods > 1 ? (
            <Row style={{ width: '70%', justifyContent: 'space-around' }}>
              {Array.from({ length: Math.max(g.periods, ...periods) }, (_, i) => (
                <T key={i} size={10} w={800} color={colors.muted}>
                  {periodName(g.periods, i + 1)}
                </T>
              ))}
            </Row>
          ) : null}
        </Row>
      </View>

      <Row gap={6}>
        {(
          [
            [String(stats.leadChanges), 'LEAD CHANGES'],
            [String(stats.ties), 'TIES'],
            [stats.bestRun ? `${stats.bestRun.points}–0` : '–', 'BEST RUN'],
            [`+${stats.biggestLead[0]} / +${stats.biggestLead[1]}`, 'BIGGEST LEAD'],
          ] as const
        ).map(([v, label]) => (
          <View key={label} style={{ flex: 1, paddingVertical: 8, paddingHorizontal: 6, borderRadius: 12, backgroundColor: colors.surface, alignItems: 'center' }}>
            <D size={v.length > 6 ? 17 : 22} numberOfLines={1}>
              {v}
            </D>
            <T size={10} w={700} color={colors.muted} center>
              {label}
            </T>
          </View>
        ))}
      </Row>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {tabs.map(([key, label]) => {
          const on = tab === key;
          return (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => setTab(key)}
              style={{ height: 36, paddingHorizontal: key === 'key' ? 16 : 14, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.primary : colors.surface }}
            >
              <T size={13} w={700} color={on ? colors.onPrimary : colors.muted}>
                {label}
              </T>
            </Pressable>
          );
        })}
      </ScrollView>

      {tab === 'box' ? (
        <PlayerTable match={m} score={m.score} initialSide={w ?? 0} />
      ) : (
        <View style={{ borderRadius: 16, backgroundColor: colors.surface, paddingVertical: 4, paddingHorizontal: 12 }}>
          {list.length === 0 ? (
            <T size={14} color={colors.muted} style={{ paddingVertical: 14 }}>
              Nothing here yet.
            </T>
          ) : null}
          {list.map((e, i) => (
            <View key={e.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 46, paddingVertical: 4, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.raised }}>
              <View style={{ width: 52 }}>
                <T size={10} w={800} color={colors.muted}>
                  {periodName(g.periods, e.period)}
                </T>
                <T size={13} w={700} style={{ fontVariant: ['tabular-nums'] }}>
                  {e.clock || '–'}
                </T>
              </View>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: e.side === null ? 'transparent' : fills[e.side], borderWidth: e.side === null ? 2 : 0, borderColor: colors.faint }} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <T size={14} lh={18} w={e.kind === 'end' || e.kind === 'run' ? 800 : 600} color={e.kind === 'out' ? colors.bad : colors.fg}>
                  {e.text}
                </T>
                {TAGS[e.kind] || e.kind === 'pts' ? (
                  <T size={11} w={700} color={colors.muted}>
                    {e.kind === 'pts' ? shortTeam(names[e.side ?? 0]!).toUpperCase() : TAGS[e.kind]}
                  </T>
                ) : null}
              </View>
              <D size={17} style={{ fontVariant: ['tabular-nums'] }}>
                {`${e.score[0]}–${e.score[1]}`}
              </D>
            </View>
          ))}
        </View>
      )}

      {tab !== 'box' ? <Button label="Player box score" weight={800} height={52} radius={14} onPress={() => setTab('box')} /> : null}
    </Screen>
  );
}
