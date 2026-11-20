import { View } from 'react-native';
import { replay, type Scorer } from '@/engine/scoring';
import { sportText, useTheme, withAlpha } from '@/shared/theme';
import { Badge, D, IconButton, T } from '@/shared/ui';
import { firstName } from '@/shared/utils/format';
import type { MatchView, PluginEvent, ScoreSummary, ScoringAction, SegmentSummary } from '../types';

/** The game / set being played now, and whether it is a tiebreak (tennis, padel). */
export function currentUnit(score: ScoreSummary): { segment: SegmentSummary | null; tiebreak: boolean; number: number } {
  const last = score.segments.at(-1) ?? null;
  const child = last?.children.at(-1);
  const tiebreak = last?.type === 'match_tiebreak' || child?.type === 'tiebreak';
  const done = score.segments.filter((s) => s.complete).length;
  return { segment: last, tiebreak, number: score.complete ? done : done + 1 };
}

/** "Game 3" / "Set 2" / "2nd innings" / "Final". */
export function unitLabel(score: ScoreSummary): string {
  if (score.complete) return 'Final';
  if (score.scoringModel === 'overs') return score.segments.at(-1)?.children.at(-1)?.label ?? '1st innings';
  if (score.scoringModel === 'baskets') return score.game?.periodLabel ?? 'Game';
  const word = score.totals.majorLabel === 'Sets' ? 'Set' : 'Game';
  return `${word} ${currentUnit(score).number}`;
}

/** A column heading for a game, set or period: "G1", "S2", "INN", "SO1". */
export function segmentShort(score: ScoreSummary, segment: SegmentSummary): string {
  if (score.scoringModel === 'overs') return segment.type === 'super_over' ? `SO${segment.sequence - 1}` : 'INN';
  if (score.scoringModel === 'baskets') return segment.label;
  return `${score.totals.majorLabel === 'Sets' ? 'S' : 'G'}${segment.sequence}`;
}

/** Header: close, "Badminton · Doubles" over the rules and court, LIVE, ⋯. */
export function ScoreHeader({ match, onClose, onMenu, live = true }: { match: MatchView; onClose?: () => void; onMenu?: () => void; live?: boolean }) {
  const { colors } = useTheme();
  const rules = [match.ruleset.name, match.court?.name].filter(Boolean).join(' · ');
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      {onClose ? <IconButton icon="close" label="Leave scoring" onPress={onClose} /> : <View style={{ width: 44 }} />}
      <View style={{ flex: 1, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: match.sport.accentColor }} />
          <T size={14} w={700} numberOfLines={1}>
            {match.sport.name} · {match.format.name}
          </T>
        </View>
        {rules ? (
          <T size={12} color={colors.muted} numberOfLines={1}>
            {rules}
          </T>
        ) : null}
      </View>
      {live ? <Badge label="LIVE" tone="live" /> : null}
      {onMenu ? <IconButton icon="dots" label="Match menu" onPress={onMenu} /> : <View style={{ width: 44 }} />}
    </View>
  );
}

/** Tennis / padel: SETS, games per set, and the points of the game in play (TB in a tiebreak). */
export function SetsTable({ score, names, slug, color }: { score: ScoreSummary; names: string[]; slug: string; color: string }) {
  const { colors } = useTheme();
  const sets = score.segments.filter((s) => s.type === 'set');
  const { tiebreak, segment } = currentUnit(score);
  const game = segment?.type === 'match_tiebreak' ? segment : segment?.children.at(-1);
  const pointsOf = (i: number) => (score.complete ? '' : (score.sides[i]?.current ?? ''));
  const leader = !score.complete && game ? (game.scores[0]! > game.scores[1]! ? 0 : game.scores[1]! > game.scores[0]! ? 1 : null) : null;
  const col = 40;
  return (
    <View style={{ borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 10, paddingHorizontal: 14, paddingBottom: 4 }}>
        <T size={11} w={700} ls={0.08} color={colors.muted} flex>
          PLAYER
        </T>
        {['SETS', ...sets.map((s) => `S${s.sequence}`)].map((h) => (
          <T key={h} size={11} w={700} ls={0.08} color={colors.muted} center style={{ width: col }}>
            {h}
          </T>
        ))}
        {!score.complete ? (
          <T size={11} w={700} ls={0.08} color={colors.muted} center style={{ width: 64 }}>
            {tiebreak ? 'TB' : 'PTS'}
          </T>
        ) : null}
      </View>
      {[0, 1].map((i) => {
        const side = score.sides[i]!;
        const ahead = score.complete ? score.winnerSideIndex === i : Number(side.primary) >= Number(score.sides[1 - i]?.primary ?? 0);
        return (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 8, paddingBottom: i === 1 ? 12 : 8 }}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: side.serving ? colors.primary : 'transparent' }} />
              <T size={15} w={i === 0 ? 700 : 600} color={i === 0 ? colors.fg : colors.soft} flex numberOfLines={1}>
                {names[i]}
              </T>
            </View>
            <D size={24} color={ahead && Number(side.primary) > 0 ? colors.fg : colors.muted} style={{ width: col, textAlign: 'center' }}>
              {side.primary}
            </D>
            {sets.map((s) => (
              <D key={s.sequence} size={s.complete ? 22 : 24} w={s.complete ? 800 : 900} color={s.complete && s.winnerSideIndex !== i ? colors.muted : colors.fg} style={{ width: col, textAlign: 'center' }}>
                {s.display[i]}
              </D>
            ))}
            {!score.complete ? (
              <View style={{ width: 64, alignItems: 'center' }}>
                <View style={{ minWidth: 48, borderRadius: 10, backgroundColor: color, opacity: leader === null || leader === i ? 1 : 0.85, alignItems: 'center' }}>
                  <D size={28} color={colors.onPrimary}>
                    {pointsOf(i)}
                  </D>
                </View>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

/**
 * The callout bar: "MATCH POINT", "20-ALL", "DEUCE", "ADVANTAGE · AARAV" in the sport's tint,
 * "GAME 2" in grey when nothing is on, "MATCH OVER" in primary. Side-out sports call the score
 * instead ("CALL THE SCORE 4 · 7 · 2").
 */
export function Callout({ score, slug, color, names, sideOut }: { score: ScoreSummary; slug: string; color: string; names: string[]; sideOut: boolean }) {
  const { colors } = useTheme();
  const tint = sportText(colors, slug);
  if (score.complete) {
    return (
      <View style={{ height: 48, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
        <D size={30} ls={0.06} color={colors.ink}>
          MATCH OVER
        </D>
      </View>
    );
  }
  if (sideOut && score.callout) {
    return (
      <View accessibilityLabel={`Call the score: ${score.callout}`} style={{ height: 84, borderRadius: 18, backgroundColor: withAlpha(color, 0.12), alignItems: 'center', justifyContent: 'center' }}>
        <T size={11} w={700} ls={0.12} color={tint}>
          CALL THE SCORE
        </T>
        <D size={58} lh={56} ls={0.06} color={tint}>
          {score.callout.split('-').join(' · ')}
        </D>
      </View>
    );
  }
  const { tiebreak, segment } = currentUnit(score);
  const [a, b] = score.sides.map((s) => Number(s.current ?? 0));
  let text = score.callout?.toUpperCase() ?? null;
  if (text === 'ADVANTAGE') {
    const game = segment?.children.at(-1);
    const ahead = game ? (game.scores[0]! > game.scores[1]! ? 0 : 1) : 0;
    text = `ADVANTAGE · ${firstName(names[ahead] ?? '').toUpperCase()}`;
  }
  if (!text && a === b && a !== undefined && a >= 10 && score.scoringModel === 'rally') text = `${a}-ALL`;
  const quiet = !text;
  if (tiebreak && (text === 'TIEBREAK' || text === 'MATCH TIEBREAK')) text = text === 'TIEBREAK' ? 'TIEBREAK' : 'SUPER TIEBREAK';
  return (
    <View style={{ height: 48, borderRadius: 14, backgroundColor: quiet ? colors.surface : withAlpha(color, 0.13), flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      <D size={30} ls={0.06} color={quiet ? colors.muted : tint} numberOfLines={1}>
        {text ?? unitLabel(score).toUpperCase()}
      </D>
      {tiebreak && text && !text.includes('TIEBREAK') ? (
        <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: tint }}>
          <T size={11} w={800} ls={0.08} color={tint}>
            TIEBREAK
          </T>
        </View>
      ) : null}
    </View>
  );
}

/** What a tap on this side would do, from the engine (tennis): "Wins game → 5-4", "Back to deuce". */
export function previewHint(scorer: Scorer | null, events: PluginEvent[], action: ScoringAction | undefined, now: ScoreSummary): string | null {
  if (!scorer || !action) return null;
  try {
    const after = replay(scorer, [...events, action.event]).summary;
    if (after.complete) return 'Wins the match';
    const setsBefore = now.segments.filter((s) => s.complete).length;
    const setsAfter = after.segments.filter((s) => s.complete).length;
    if (setsAfter > setsBefore) {
      const set = after.segments.filter((s) => s.complete).at(-1)!;
      return `Wins ${now.totals.majorLabel === 'Sets' ? 'set' : 'game'} → ${set.display.join('-')}`;
    }
    const before = now.segments.at(-1);
    const afterSet = after.segments.at(-1);
    const gamesBefore = before?.children.filter((g) => g.complete).length ?? 0;
    const gamesAfter = afterSet?.children.filter((g) => g.complete).length ?? 0;
    if (afterSet?.type === 'set' && gamesAfter > gamesBefore) return `Wins game → ${afterSet.display.join('-')}`;
    if (after.callout === 'Deuce' && now.callout === 'Advantage') return 'Back to deuce';
    const { tiebreak } = currentUnit(now);
    if (tiebreak && action.sideIndex !== null && now.sides[action.sideIndex]?.serving === false) return 'Serve passes after this point';
    return null;
  } catch {
    return null;
  }
}
