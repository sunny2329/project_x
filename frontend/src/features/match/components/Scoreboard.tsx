import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { replay, type Scorer } from '@/engine/scoring';
import { sportText, useTheme, withAlpha } from '@/shared/theme';
import { Badge, D, Icon, IconButton, T } from '@/shared/ui';
import { firstName } from '@/shared/utils/format';
import { serveTurn } from '../rules';
import type { MatchView, PluginEvent, ScoreSummary, ScoringAction, SegmentSummary } from '../types';

/** The game / set being played now, and whether it is a tiebreak (tennis, padel). */
export function currentUnit(score: ScoreSummary): { segment: SegmentSummary | null; tiebreak: boolean; number: number } {
  const last = score.segments.at(-1) ?? null;
  const child = last?.children.at(-1);
  const tiebreak = last?.type === 'match_tiebreak' || child?.type === 'tiebreak';
  const done = score.segments.filter((s) => s.complete).length;
  return { segment: last, tiebreak, number: score.complete ? done : done + 1 };
}

/** "Game 3" / "Set 2" / "Final". */
export function unitLabel(score: ScoreSummary): string {
  if (score.complete) return 'Final';
  const word = score.totals.majorLabel === 'Sets' ? 'Set' : 'Game';
  return `${word} ${currentUnit(score).number}`;
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

/** Finished games as chips ("G1 21-17"), and the game in play on the right. Rally and side-out sports. */
export function SegmentChips({ score, slug }: { score: ScoreSummary; slug: string }) {
  const { colors } = useTheme();
  const done = score.segments.filter((s) => s.complete);
  const short = score.totals.majorLabel === 'Sets' ? 'S' : 'G';
  const tight = done.length > 3;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: tight ? 5 : 6, height: 32 }}>
      {done.map((s) => (
        <View key={s.sequence} style={{ height: 30, paddingHorizontal: tight ? 7 : 10, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <T size={tight ? 11 : 12} color={colors.muted}>
            {short}
            {s.sequence}
          </T>
          <D size={tight ? 16 : 17} w={900} color={s.winnerSideIndex === 0 ? sportText(colors, slug) : colors.fg}>
            {s.display.join('-')}
          </D>
        </View>
      ))}
      <T size={13} w={700} color={colors.soft} style={{ marginLeft: 'auto' }}>
        {unitLabel(score)}
      </T>
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
    <View style={{ borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 10, paddingHorizontal: 14, paddingBottom: 4 }}>
        <View style={{ flex: 1 }} />
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
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: side.serving ? sportText(colors, slug) : 'transparent' }} />
              <T size={15} w={i === 0 ? 700 : 600} color={i === 0 ? colors.fg : colors.soft} flex numberOfLines={1}>
                {names[i]}
              </T>
            </View>
            <D size={24} color={ahead && Number(side.primary) > 0 ? sportText(colors, slug) : colors.muted} style={{ width: col, textAlign: 'center' }}>
              {side.primary}
            </D>
            {sets.map((s) => (
              <D key={s.sequence} size={s.complete ? 22 : 24} w={s.complete ? 800 : 900} color={s.complete && s.winnerSideIndex !== i ? colors.muted : colors.fg} style={{ width: col, textAlign: 'center' }}>
                {s.display[i]}
              </D>
            ))}
            {!score.complete ? (
              <View style={{ width: 64, alignItems: 'center' }}>
                <View style={{ minWidth: 52, borderRadius: 10, backgroundColor: leader === i ? color : 'transparent', alignItems: 'center' }}>
                  <D size={30} color={leader === i ? colors.ink : colors.fg}>
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

/** The serve pill text: "Serving · Right court", "Ishaan serving · Left", "Serving ●○ 1 of 2". */
export function servePill(match: MatchView, score: ScoreSummary, sideIndex: number): { text: string; number: 1 | 2 | null; turn: { nth: number; of: number } | null } | null {
  const side = score.sides[sideIndex];
  if (!side?.serving) return null;
  const players = match.sides[sideIndex]?.players ?? [];
  const who = players.length > 1 && side.serverPlayerIndex !== null ? firstName(players[side.serverPlayerIndex]?.displayName ?? '') : null;
  const note = side.serveNote?.replace(' court', '') ?? null;
  if (score.scoringModel === 'side_out') return { text: [who ? `${who} serving` : 'Serving', note].filter(Boolean).join(' · '), number: side.serverNumber, turn: null };
  const game = score.segments.at(-1);
  const turn = serveTurn(match.rulesetConfig, game?.scores ?? [0, 0]);
  if (turn && turn.of > 1) return { text: 'Serving', number: null, turn: { nth: turn.nth, of: turn.of } };
  if (side.serveNote) return { text: `${who ? `${who} serving` : 'Serving'} · ${side.serveNote}`, number: null, turn: null };
  return { text: who ? `${who} serving` : 'Serving', number: null, turn: null };
}

/**
 * One side's big button. Side A is filled with the sport colour, side B with the bright "sideB";
 * the layouts mirror each other. The bar shows the engine's action label ("+ POINT", "SIDE OUT").
 */
export function SideButton({
  index,
  name,
  score,
  action,
  color,
  pill,
  info,
  footNote,
  dim,
  winner,
  big = 132,
  onPress,
  sideOutStyle,
  tint,
}: {
  index: number;
  name: string;
  score: string;
  action?: ScoringAction;
  color: string;
  pill: ReturnType<typeof servePill>;
  info: ReactNode;
  /** Side B's note under the name ("Serves next after 1 more"). */
  footNote?: string | null;
  dim?: boolean;
  winner?: boolean;
  big?: number;
  onPress?: () => void;
  sideOutStyle?: boolean;
  /** Sport text colour for side A's bar in the side-out style. */
  tint?: string;
}) {
  const { colors, scheme } = useTheme();
  const a = index === 0;
  const fg = a ? colors.ink : colors.onPrimary;
  const label = action ? (action.label.toLowerCase() === 'point' ? '+ POINT' : action.label.toUpperCase()) : null;
  const barBg = sideOutStyle ? colors.bg : a ? 'rgba(10,15,28,0.14)' : scheme === 'dark' ? 'rgba(10,15,28,0.08)' : 'rgba(255,255,255,0.12)';
  const barFg = sideOutStyle ? (a ? (tint ?? colors.fg) : colors.fg) : fg;
  const bar = label ? (
    <View style={{ height: sideOutStyle ? 44 : 40, borderRadius: 12, backgroundColor: barBg, alignItems: 'center', justifyContent: 'center' }}>
      <T size={sideOutStyle ? 16 : 15} w={800} ls={0.1} color={barFg}>
        {label}
      </T>
    </View>
  ) : (
    <View style={{ height: 40 }} />
  );
  const pillView = winner ? (
    <View style={{ height: 30, paddingHorizontal: 12, borderRadius: 15, backgroundColor: colors.bg, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Icon name="cup" size={14} color={colors.fg} />
      <T size={13} w={800} ls={0.06}>
        WINNERS
      </T>
    </View>
  ) : pill ? (
    <View style={{ height: 30, paddingHorizontal: 10, borderRadius: 15, backgroundColor: colors.bg, flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
      {pill.number ? (
        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
          <T size={12} w={800} color={colors.onPrimary}>
            {pill.number}
          </T>
        </View>
      ) : !pill.turn ? (
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} />
      ) : null}
      <T size={13} w={700} numberOfLines={1} style={{ flexShrink: 1 }}>
        {pill.text}
      </T>
      {pill.turn ? (
        <>
          <View style={{ flexDirection: 'row', gap: 3 }}>
            {Array.from({ length: pill.turn.of }, (_, i) => (
              <View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: i < pill.turn!.nth ? colors.primary : 'transparent', borderWidth: i < pill.turn!.nth ? 0 : 1.5, borderColor: colors.primary }} />
            ))}
          </View>
          <T size={13} w={700}>
            {pill.turn.nth} of {pill.turn.of}
          </T>
        </>
      ) : null}
    </View>
  ) : null;
  const nameRow = (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <T size={18} w={700} color={fg} numberOfLines={1} style={{ flexShrink: 1 }}>
        {name}
      </T>
      {pillView ?? (footNote ? (
        <T size={13} w={600} color={a ? fg : colors.onBrightMuted} numberOfLines={1}>
          {footNote}
        </T>
      ) : null)}
    </View>
  );
  const middle = (
    <View style={{ flexDirection: 'row', alignItems: a ? 'flex-end' : 'flex-start', justifyContent: 'space-between', gap: 8 }}>
      <View style={{ flexShrink: 1, maxWidth: 160 }}>{info}</View>
      <D size={big} lh={Math.round(big * 0.84)} ls={-0.02} color={fg}>
        {score}
      </D>
    </View>
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={action ? `${action.label} to ${name}` : name}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 170,
        paddingVertical: 16,
        paddingHorizontal: 18,
        borderRadius: 26,
        backgroundColor: a ? color : colors.sideB,
        justifyContent: 'space-between',
        opacity: dim ? 0.35 : pressed ? 0.88 : 1,
        transform: [{ scale: pressed ? 0.985 : 1 }],
        ...(a ? { shadowColor: color, shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 4 } : {}),
      })}
    >
      {a ? (
        <>
          {nameRow}
          {middle}
          {bar}
        </>
      ) : (
        <>
          {bar}
          {middle}
          {nameRow}
        </>
      )}
    </Pressable>
  );
}

/** "GAMES 2" under a side's score (rally sports). */
export function TotalInfo({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ gap: 2 }}>
      <T size={12} w={700} ls={0.08} color={color}>
        {label.toUpperCase()}
      </T>
      <D size={34} lh={34} color={color}>
        {value}
      </D>
    </View>
  );
}

export function HintInfo({ text, color }: { text: string | null; color: string }) {
  if (!text) return null;
  return (
    <T size={13} w={700} lh={18} color={color}>
      {text}
    </T>
  );
}
