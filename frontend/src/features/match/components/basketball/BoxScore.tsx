import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useTheme } from '@/shared/theme';
import { D, Icon, T } from '@/shared/ui';
import { hoopsRules, playerOfTheGame, roster, shortTeam, statLine, tagName } from '../../basketball';
import type { GameDetail, MatchView, ScoreSummary } from '../../types';

/** Team tabs over a per-player table: points, baskets by value (made), assists, fouls. */
export function PlayerTable({ match, score, initialSide = 0 }: { match: MatchView; score: ScoreSummary; initialSide?: number }) {
  const { colors } = useTheme();
  const [side, setSide] = useState(initialSide);
  const g = score.game as GameDetail;
  const rules = hoopsRules(match.rulesetConfig);
  const rows = roster(match, side);
  const lines = g.players[side] ?? [];
  // With 1-and-2 scoring a "1" is a basket inside the arc, not a free throw.
  const cols: [string, (i: number) => string][] = rules.threePointers
    ? [
        ['2PT', (i) => String(lines[i]?.twos ?? 0)],
        ['3PT', (i) => String(lines[i]?.threes ?? 0)],
        ['FT', (i) => String(lines[i]?.ones ?? 0)],
      ]
    : [
        ['1PT', (i) => String(lines[i]?.ones ?? 0)],
        ['2PT', (i) => String(lines[i]?.twos ?? 0)],
      ];
  const credited = lines.reduce((sum, l) => sum + l.points, 0);
  const team = Number(score.sides[side]?.primary ?? 0) - credited;
  const cell = { width: 44, textAlign: 'center' as const };
  return (
    <View style={{ gap: 12 }}>
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', padding: 4, borderRadius: 12, backgroundColor: colors.surface, gap: 4 }}>
        {[0, 1].map((s) => (
          <Pressable
            key={s}
            accessibilityRole="tab"
            accessibilityState={{ selected: side === s }}
            onPress={() => setSide(s)}
            style={{ flex: 1, height: 38, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: side === s ? colors.primary : 'transparent' }}
          >
            <T size={14} w={700} color={side === s ? colors.onPrimary : colors.muted} numberOfLines={1}>
              {shortTeam(match.sides[s]?.name ?? '')}
            </T>
          </Pressable>
        ))}
      </View>
      <View style={{ borderRadius: 14, backgroundColor: colors.surface, overflow: 'hidden' }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
          <View style={{ flexGrow: 1, minWidth: 340 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line }}>
              <T size={11} w={700} color={colors.muted} style={{ flex: 1, minWidth: 110, paddingLeft: 12 }}>
                PLAYER
              </T>
              {['PTS', ...cols.map((c) => c[0]), 'AST', 'FLS'].map((h) => (
                <T key={h} size={11} w={700} color={colors.muted} style={cell}>
                  {h}
                </T>
              ))}
            </View>
            {rows.map((r) => {
              const l = lines[r.index];
              const out = !!l?.fouledOut;
              return (
                <View key={r.index} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 40, borderBottomWidth: 1, borderBottomColor: colors.raised }}>
                  <T size={14} w={600} numberOfLines={1} style={{ flex: 1, minWidth: 110, paddingLeft: 12 }}>
                    {r.number === null ? null : (
                      <T size={14} w={600} color={colors.muted}>
                        {`#${r.number}  `}
                      </T>
                    )}
                    {r.first}
                  </T>
                  <D size={17} style={cell}>
                    {String(l?.points ?? 0)}
                  </D>
                  {cols.map(([h, v]) => (
                    <T key={h} size={14} style={cell}>
                      {v(r.index)}
                    </T>
                  ))}
                  <T size={14} style={cell}>
                    {String(l?.assists ?? 0)}
                  </T>
                  <T size={14} w={out ? 800 : 400} color={out ? '#FF5468' : colors.fg} style={cell}>
                    {String(l?.fouls ?? 0)}
                  </T>
                </View>
              );
            })}
            {team > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 36 }}>
                <T size={13} color={colors.muted} style={{ flex: 1, minWidth: 110, paddingLeft: 12 }}>
                  Team (not tagged)
                </T>
                <D size={17} color={colors.muted} style={cell}>
                  {String(team)}
                </D>
                <View style={{ width: 44 * (cols.length + 2) }} />
              </View>
            ) : null}
          </View>
        </ScrollView>
      </View>
      <T size={11} color={colors.muted}>
        Baskets made. Misses aren’t tracked while scoring.
      </T>
    </View>
  );
}

/** "Player of the game · #7 Arjun · 26 pts, 4 threes, 5 ast", or nothing without tagged baskets. */
export function PlayerOfTheGame({ match, score }: { match: MatchView; score: ScoreSummary }) {
  const { colors } = useTheme();
  const best = playerOfTheGame(score.game as GameDetail, score.winnerSideIndex);
  if (!best) return null;
  const r = roster(match, best.side)[best.line.index];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: colors.bbTint }}>
      <Icon name="crown" size={26} color={colors.tBb} />
      <View style={{ flex: 1 }}>
        <T size={12} w={700} ls={0.06} color={colors.tBb}>
          PLAYER OF THE GAME
        </T>
        <T size={15} w={700} numberOfLines={2}>
          {tagName(r)} · {statLine(best.line)}
        </T>
      </View>
    </View>
  );
}
