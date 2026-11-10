import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { rulesName, scoringRegistry } from '@/engine/scoring';
import { useNow } from '@/shared/hooks/useNow';
import { useTheme } from '@/shared/theme';
import { Badge, Button, D, IconButton, Notice, Row, T } from '@/shared/ui';
import { clockNow, formatClock, hoopsRules, inkOn, playClock, playText, roster, shortTeam, type Roster } from '../../basketball';
import type { useLiveScoring } from '../../hooks/useLiveScoring';
import { useGameClock } from '../../store/clock.store';
import type { GameDetail, MatchView, PluginEvent, ScoreSummary } from '../../types';
import { FoulSheet, SubSheet, WhoScoredSheet } from './Sheets';

type Live = ReturnType<typeof useLiveScoring>;
/**
 * A basket or foul waiting for "who?", or a substitution being picked: shown as chips on the team
 * card until the next play, Skip or Cancel.
 */
interface Pending {
  side: number;
  kind: 'pts' | 'foul' | 'subOut' | 'subIn';
  points: number;
  /** Event count the chips belong to: once anything else happens they go away. */
  at: number;
  /** subIn: the player coming off. */
  out?: number;
  /** subIn after a foul-out: the prompt says so and its button reads "Later". */
  forced?: boolean;
}

const BLUE = '#3B82F6';
const RED = '#FF5468';

export function teamColor(match: Pick<MatchView, 'sides'>, side: number, fallbackB: string): string {
  return match.sides[side]?.color ?? (side === 0 ? BLUE : fallbackB);
}

function PlayIcon({ running, color }: { running: boolean; color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24">
      {running ? (
        <>
          <Rect x={6} y={5} width={4} height={14} rx={1} fill={color} />
          <Rect x={14} y={5} width={4} height={14} rx={1} fill={color} />
        </>
      ) : (
        <Path d="M7 5l12 7-12 7z" fill={color} />
      )}
    </Svg>
  );
}

/**
 * Live basketball scoring: first-to games (3v3 style: clock, shot, ball, two stacked team cards)
 * and timed games (5v5 style: period, big clock, shot resets, possession arrow, two columns).
 * The clocks run on this phone; every play carries the reading.
 */
export function BasketballBoard({
  match,
  score,
  live,
  haptics,
  onLeave,
  onMatchMenu,
  onFinish,
  onBreak,
}: {
  match: MatchView;
  score: ScoreSummary;
  live: Live;
  haptics: boolean;
  onLeave: () => void;
  onMatchMenu: () => void;
  onFinish: () => void;
  /** Called after a timed period ends (not the last): shows the break. */
  onBreak: () => void;
}) {
  const { colors } = useTheme();
  const g = score.game as GameDetail;
  const rules = hoopsRules(match.rulesetConfig);
  const now = useNow(250);
  const stored = useGameClock((s) => s.clocks[match.id]);
  const [pend, setPend] = useState<Pending | null>(null);
  const [sheet, setSheet] = useState<null | 'foul' | 'sub' | 'who'>(null);
  useEffect(() => {
    void useGameClock.getState().restore(match.id);
  }, [match.id]);

  const seconds = rules.periodSeconds(g.period);
  const clock = stored && stored.period === g.period ? stored : { period: g.period, left: seconds, shot: rules.shotClock, runningSince: null };
  const reading = clockNow(clock, now);
  const left = reading.left;
  const running = reading.running && !score.complete;
  const clockSec = Math.ceil(left);
  const timeUp = left <= 0;
  const hasShot = rules.shotClock > 0;
  const names = match.sides.map((s) => s.name);
  const rosters: [Roster[], Roster[]] = [roster(match, 0), roster(match, 1)];
  const fills = [teamColor(match, 0, colors.sideB), teamColor(match, 1, colors.sideB)];
  const inks = fills.map(inkOn);
  const totals = [Number(score.sides[0]!.primary), Number(score.sides[1]!.primary)];
  const lastPlay = g.plays.at(-1) ?? null;
  const chips = pend && pend.at === live.eventCount && !score.complete ? pend : null;
  const store = useGameClock.getState();
  const benchFor = (side: number) => (g.players[side] ?? []).filter((p) => !p.onCourt);
  const values = rules.threePointers ? [1, 2, 3] : [1, 2];

  const buzz = () => {
    if (haptics) void Haptics.selectionAsync().catch(() => undefined);
  };
  const send = (event: PluginEvent) => {
    buzz();
    live.tap(event);
  };
  const withClock = (event: PluginEvent): PluginEvent => (clock.runningSince !== null || clock.left < seconds ? { ...event, clock: clockSec } : event);

  const basket = (side: number, points: number) => {
    send(withClock({ type: 'score', sideIndex: side, points }));
    if (hasShot && (!rules.timed || points > 1)) store.shot(match.id, g.period, seconds, rules.shotClock);
    setPend(rules.tagPlayers ? { side, kind: 'pts', points, at: live.eventCount + 1 } : null);
  };
  /** After this foul: ask who comes on when it fouls the player out and someone is on the bench. */
  const foulOutPrompt = (side: number, playerIndex: number, at: number): Pending | null => {
    const p = g.players[side]?.find((q) => q.index === playerIndex);
    if (!p || !p.onCourt || rules.foulOutAt <= 0 || p.fouls + 1 < rules.foulOutAt || !benchFor(side).some((b) => !b.fouledOut)) return null;
    return { side, kind: 'subIn', points: 0, at, out: playerIndex, forced: true };
  };
  const foul = (side: number, playerIndex: number | null = null, kind = 'personal') => {
    send(withClock({ type: 'foul', sideIndex: side, kind, ...(playerIndex === null ? {} : { playerIndex }) }));
    store.pause(match.id);
    const at = live.eventCount + 1;
    setPend(playerIndex === null ? (rosters[side]!.length ? { side, kind: 'foul', points: 0, at } : null) : foulOutPrompt(side, playerIndex, at));
  };
  const tag = (playerIndex: number) => {
    const wasFoul = chips?.kind === 'foul' ? chips.side : null;
    send({ type: 'tag', playerIndex });
    setPend(wasFoul === null ? null : foulOutPrompt(wasFoul, playerIndex, live.eventCount + 1));
  };
  const startSub = (side: number) => {
    buzz();
    store.pause(match.id);
    setPend({ side, kind: 'subOut', points: 0, at: live.eventCount });
  };
  const doSub = (side: number, outIndex: number, inIndex: number) => {
    send(withClock({ type: 'sub', sideIndex: side, outIndex, inIndex }));
    setPend(null);
  };
  const timeout = (side: number) => {
    send(withClock({ type: 'timeout', sideIndex: side }));
    store.pause(match.id);
    setPend(null);
  };
  const flip = () => {
    const current = g.possessionSideIndex ?? 0;
    send({ type: 'possession', sideIndex: current === 0 ? 1 : 0 });
  };
  const toggleClock = () => {
    if (score.complete || timeUp) return;
    buzz();
    store.toggle(match.id, g.period, seconds, rules.shotClock);
  };
  const endPeriod = () => {
    store.pause(match.id);
    const last = rules.timed && g.period >= rules.periods && totals[0] !== totals[1];
    send({ type: 'period_end', clock: clockSec });
    setPend(null);
    if (rules.timed && !last) onBreak();
  };
  const endPeriodNow = () =>
    Alert.alert(rules.timed ? `End ${g.periodLabel} now?` : 'Call time now?', rules.timed ? `With ${formatClock(left, true)} on the clock. Undo brings it back.` : 'The team ahead wins; if tied, the next basket wins. Undo brings it back.', [
      { text: 'Keep playing', style: 'cancel' },
      { text: rules.timed ? `End ${g.periodLabel}` : 'Call time', style: 'destructive', onPress: endPeriod },
    ]);
  const undo = () => {
    setPend(null);
    live.undo();
  };

  const canEndPeriod = score.actions.some((a) => a.id === 'period-end');
  const lastText = lastPlay ? [playText(lastPlay, rosters, names, { threes: rules.threePointers }), playClock(lastPlay, rules.timed)].filter(Boolean).join(' · ') : 'Tip off: start the clock';
  const canTagLast = !!lastPlay && (lastPlay.kind === 'score' || lastPlay.kind === 'foul') && !score.complete && rosters[lastPlay.sideIndex ?? 0]!.length > 0;

  const header = (
    <Row gap={10}>
      <IconButton icon="close" label="Leave scoring" onPress={onLeave} />
      <View style={{ flex: 1, alignItems: 'center' }}>
        <Row gap={6}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: BLUE }} />
          <T size={14} w={700} numberOfLines={1}>
            {match.sport.name} · {match.format.code} {rules.half ? 'half court' : 'full court'}
          </T>
        </Row>
        <T size={12} color={colors.muted} numberOfLines={1}>
          {rulesName(scoringRegistry, 'baskets', match.rulesetConfig, match.ruleset.name)}
        </T>
      </View>
      {score.complete ? <View style={{ width: 40 }} /> : <Badge label="LIVE" tone="live" />}
      <IconButton icon="dots" label="Fouls, timeouts, subs and match menu" onPress={() => setSheet('foul')} />
    </Row>
  );

  const pickChips = (side: number, columns: number) => {
    if (!chips || chips.side !== side) return null;
    const ink = inks[side]!;
    const fill = fills[side]!;
    const sub = chips.kind === 'subOut' || chips.kind === 'subIn';
    const list = chips.kind === 'subIn' ? benchFor(side) : (g.players[side] ?? []).filter((p) => p.onCourt);
    const width = columns === 2 ? '47%' : '22%';
    const outNo = chips.out === undefined ? null : rosters[side]![chips.out];
    const outTag = outNo ? (outNo.number === null ? outNo.first.toUpperCase() : `#${outNo.number}`) : '';
    const title =
      chips.kind === 'pts' ? `WHO SCORED +${chips.points}?` : chips.kind === 'foul' ? 'FOUL BY WHO?' : chips.kind === 'subOut' ? 'SUB · WHO’S COMING OFF?' : chips.forced ? `${outTag} FOULED OUT · WHO COMES ON?` : `${outTag} OFF · WHO’S COMING ON?`;
    const word = chips.kind === 'pts' ? 'SKIP' : chips.kind === 'foul' ? 'BENCH / TEAM' : chips.forced ? 'LATER' : 'CANCEL';
    const wordLabel = chips.kind === 'pts' ? 'Skip: keep the points for the team' : chips.kind === 'foul' ? 'Bench or team foul' : chips.forced ? 'Sub later' : 'Cancel the substitution';
    return (
      <View style={{ marginTop: 'auto', gap: 6 }}>
        <T size={columns === 2 ? 11 : 12} w={800} ls={0.04} color={ink}>
          {title}
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {list.map((p) => {
            const r = rosters[side]![p.index];
            // Coming off, anyone may go (a fouled-out player most of all); coming on or being credited, not a fouled-out one.
            const out = chips.kind !== 'subOut' && p.fouledOut;
            const line = chips.kind === 'subOut' ? (p.fouledOut ? 'FOULED OUT' : `${r?.first ?? ''} · ${p.fouls}F`) : out ? 'OUT' : columns === 2 ? `${r?.first ?? ''} · ${chips.kind === 'pts' ? p.points : `${p.fouls}F`}` : (r?.first ?? '');
            const action = chips.kind === 'subOut' ? `Take off ${r ? r.name : 'player'}` : chips.kind === 'subIn' ? `Put on ${r ? r.name : 'player'}` : (r ? r.name : 'Player');
            return (
              <Pressable
                key={p.index}
                accessibilityRole="button"
                accessibilityState={{ disabled: out }}
                accessibilityLabel={`${action}${out ? ', fouled out' : ''}`}
                disabled={out}
                onPress={() =>
                  chips.kind === 'subOut' ? setPend({ ...chips, kind: 'subIn', out: p.index }) : chips.kind === 'subIn' ? doSub(side, chips.out!, p.index) : tag(p.index)
                }
                style={{ width, flexGrow: 1, height: columns === 2 ? 50 : 52, borderRadius: 12, backgroundColor: ink, opacity: out ? 0.35 : 1, alignItems: 'center', justifyContent: 'center' }}
              >
                <D size={columns === 2 ? 22 : 24} lh={columns === 2 ? 22 : 24} color={fill}>
                  {r?.number === null || r?.number === undefined ? (r?.first.slice(0, 3).toUpperCase() ?? '?') : String(r.number)}
                </D>
                <T size={10} w={700} color={fill} numberOfLines={1}>
                  {line}
                </T>
              </Pressable>
            );
          })}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={wordLabel}
            onPress={() => setPend(null)}
            style={{ width: columns === 2 ? '47%' : 64, flexGrow: columns === 2 ? 1 : 0, height: columns === 2 ? 50 : 52, borderRadius: 12, borderWidth: 2, borderColor: side === 0 ? 'rgba(10,10,10,0.35)' : 'rgba(128,128,128,0.45)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}
          >
            <T size={11} w={800} center color={ink}>
              {word}
            </T>
          </Pressable>
        </View>
        {sub && !list.length ? (
          <T size={11} w={700} color={ink}>
            Nobody on the bench
          </T>
        ) : null}
      </View>
    );
  };

  const scoreButtons = (side: number, stacked: boolean) => {
    if (score.complete || (chips && chips.side === side)) return null;
    const ink = inks[side]!;
    const fill = fills[side]!;
    const soft = inkOn(fill) === '#0A0A0A' ? 'rgba(10,10,10,0.16)' : 'rgba(255,255,255,0.18)';
    const border = inkOn(fill) === '#0A0A0A' ? 'rgba(10,10,10,0.35)' : 'rgba(255,255,255,0.45)';
    const pts = values.map((v) => (
      <Pressable
        key={v}
        accessibilityRole="button"
        accessibilityLabel={`${v} point${v === 1 ? '' : 's'} for ${names[side]}`}
        onPress={() => basket(side, v)}
        style={{ ...(stacked ? {} : { flex: v === 1 ? 1 : 1.4 }), height: stacked ? 54 : 58, borderRadius: 14, backgroundColor: v === 1 ? soft : ink, alignItems: 'center', justifyContent: 'center' }}
      >
        <D size={v === 1 ? (stacked ? 26 : 28) : stacked ? 28 : 32} color={v === 1 ? ink : fill}>
          {`+${v}`}
        </D>
      </Pressable>
    ));
    const foulButton = (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Foul by ${names[side]}`}
        onPress={() => foul(side)}
        style={{ ...(stacked ? {} : { width: 60 }), height: stacked ? 40 : 58, borderRadius: stacked ? 12 : 14, borderWidth: 2, borderColor: border, alignItems: 'center', justifyContent: 'center' }}
      >
        <T size={12} w={800} ls={0.04} color={ink}>
          FOUL
        </T>
      </Pressable>
    );
    const canSub = benchFor(side).some((p) => !p.fouledOut);
    return stacked ? (
      <View style={{ marginTop: 'auto', gap: 8 }}>
        {pts}
        {canSub ? (
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <View style={{ flex: 1 }}>{foulButton}</View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Substitute a ${names[side]} player`}
              onPress={() => startSub(side)}
              style={{ flex: 1, height: 40, borderRadius: 12, backgroundColor: soft, alignItems: 'center', justifyContent: 'center' }}
            >
              <T size={12} w={800} ls={0.04} color={ink}>
                ⇄ SUB
              </T>
            </Pressable>
          </View>
        ) : (
          foulButton
        )}
      </View>
    ) : (
      <View style={{ marginTop: 'auto', flexDirection: 'row', gap: 8 }}>
        {pts}
        {foulButton}
      </View>
    );
  };

  const bottom = score.complete ? (
    <Row gap={10}>
      <IconButton icon="undo" label="Undo last play" size={50} radius={14} style={{ borderWidth: 1, borderColor: colors.line2 }} onPress={undo} />
      <Button label={live.syncing && !live.busy ? 'Finish game · saving plays' : 'Finish game'} weight={800} height={50} radius={14} style={{ flex: 1 }} loading={live.busy} onPress={onFinish} />
    </Row>
  ) : timeUp && canEndPeriod ? (
    <Row gap={10}>
      <IconButton icon="undo" label="Undo last play" size={50} radius={14} style={{ borderWidth: 1, borderColor: colors.line2 }} onPress={undo} />
      <Button label={rules.timed ? (g.period >= rules.periods && totals[0] !== totals[1] ? `${g.periodLabel} over · final score` : `${g.periodLabel} over · see break`) : 'Time up · call the game'} weight={800} height={50} radius={14} style={{ flex: 1 }} onPress={endPeriod} />
    </Row>
  ) : (
    <Row gap={10}>
      <Button label="Undo" icon="undo" variant="surface" inline px={rules.timed ? 16 : 18} height={50} radius={14} style={{ borderWidth: 1, borderColor: colors.line2 }} disabled={!live.eventCount} onPress={undo} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={canTagLast ? `Last play: ${lastText}. Tap to say who.` : `Last play: ${lastText}`}
        disabled={!canTagLast}
        onPress={() => setSheet('who')}
        style={{ flex: 1, minWidth: 0, alignItems: 'flex-end' }}
      >
        <T size={11} color={colors.muted}>
          Last play
        </T>
        <T size={13} w={700} numberOfLines={1}>
          {lastText}
        </T>
      </Pressable>
    </Row>
  );

  const notices = (
    <>
      {live.error ? <Notice tone="error" icon="alert" text={live.error} /> : null}
      {live.offline ? <Notice tone="warn" icon="alert" text="No connection. Your plays are saved and will be sent." /> : null}
    </>
  );

  const sheets = (
    <>
      {sheet === 'foul' ? (
        <FoulSheet
          match={match}
          game={g}
          rules={rules}
          rosters={rosters}
          clockText={`${running ? 'Clock running' : 'Clock paused'} at ${rules.timed ? `${g.periodLabel} · ` : ''}${formatClock(left, rules.timed)}`}
          canEndPeriod={canEndPeriod && !score.complete}
          endLabel={!rules.timed ? 'Call time now' : g.overtime ? 'End overtime now' : rules.periods === 4 ? 'End quarter now' : rules.periods === 2 ? 'End half now' : 'End game now'}
          endNote={rules.timed ? `Ends ${g.periodLabel} at ${formatClock(left, true)}` : 'Ahead wins · tied: next basket'}
          complete={score.complete}
          onClose={() => setSheet(null)}
          onFoul={(side, player, kind) => {
            setSheet(null);
            foul(side, player, kind);
          }}
          onTimeout={(side) => {
            setSheet(null);
            timeout(side);
          }}
          onSub={() => setSheet('sub')}
          onEndPeriod={() => {
            setSheet(null);
            endPeriodNow();
          }}
          onMatchMenu={() => {
            setSheet(null);
            onMatchMenu();
          }}
        />
      ) : null}
      {sheet === 'sub' ? (
        <SubSheet
          game={g}
          rosters={rosters}
          names={names}
          onClose={() => setSheet(null)}
          onSub={(side, outIndex, inIndex) => {
            setSheet(null);
            send(withClock({ type: 'sub', sideIndex: side, outIndex, inIndex }));
            setPend(null);
          }}
        />
      ) : null}
      {sheet === 'who' && lastPlay && canTagLast ? (
        <WhoScoredSheet
          play={lastPlay}
          game={g}
          rosters={rosters}
          names={names}
          onClose={() => setSheet(null)}
          onSave={(playerIndex, assistIndex, andOne) => {
            setSheet(null);
            setPend(null);
            if (playerIndex !== null) send({ type: 'tag', playerIndex, ...(assistIndex === null ? {} : { assistIndex }) });
            if (andOne) basket(lastPlay.sideIndex ?? 0, 1);
          }}
        />
      ) : null}
    </>
  );

  // ------------------------------------------------------------------ timed (5v5 style)
  if (rules.timed) {
    const dots = (n: number, color: string) =>
      Array.from({ length: Math.max(rules.teamFoulLimit, 1) }, (_, i) => (
        <View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: i < n ? (n >= rules.teamFoulLimit ? RED : color) : 'rgba(128,128,128,0.35)' }} />
      ));
    const toLeft = (n: number) => (n === 0 ? 'none left' : `${n} left`);
    const arrow = g.possessionSideIndex === 1 ? '▶' : '◀';
    return (
      <>
        {header}
        <View style={{ borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: 12, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 64, alignItems: 'center', paddingVertical: 6, borderRadius: 12, backgroundColor: colors.raised }}>
              <T size={10} w={700} ls={0.08} color={colors.muted}>
                PERIOD
              </T>
              <D size={26} lh={26}>
                {g.periodLabel}
              </D>
            </View>
            <D size={68} lh={64} center flex color={left <= 60 && !score.complete ? RED : colors.fg} style={{ fontVariant: ['tabular-nums'] }}>
              {formatClock(left, true)}
            </D>
            <View style={{ width: 64, alignItems: 'center', paddingVertical: 6, borderRadius: 12, backgroundColor: colors.raised }}>
              <T size={10} w={700} ls={0.08} color={colors.muted}>
                SHOT
              </T>
              <D size={26} lh={26} color={hasShot && reading.shot <= 5 ? RED : colors.fg}>
                {hasShot ? String(Math.ceil(reading.shot)) : '–'}
              </D>
            </View>
          </View>
          <Row gap={8}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={running ? 'Pause clock' : 'Start clock'}
              disabled={score.complete || timeUp}
              onPress={toggleClock}
              style={{ flex: 1, height: 52, borderRadius: 14, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: running ? colors.raised : colors.primary, opacity: score.complete || timeUp ? 0.5 : 1 }}
            >
              <PlayIcon running={running} color={running ? colors.fg : colors.onPrimary} />
              <T size={15} w={800} color={running ? colors.fg : colors.onPrimary}>
                {running ? 'Pause' : 'Start clock'}
              </T>
            </Pressable>
            {hasShot
              ? [rules.shotClock, Math.min(14, rules.shotClock)].filter((v, i, a) => a.indexOf(v) === i).map((v) => (
                  <Pressable
                    key={v}
                    accessibilityRole="button"
                    accessibilityLabel={`Reset shot clock to ${v}`}
                    onPress={() => store.shot(match.id, g.period, seconds, v)}
                    style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: colors.raised, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <D size={20}>{String(v)}</D>
                  </Pressable>
                ))
              : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Possession arrow: ${names[g.possessionSideIndex ?? 0]}. Tap to flip.`}
              disabled={score.complete}
              onPress={flip}
              style={{ width: 64, height: 52, borderRadius: 14, backgroundColor: colors.bbTint, alignItems: 'center', justifyContent: 'center' }}
            >
              <T size={9} w={800} ls={0.06} color={colors.tBb}>
                ARROW
              </T>
              <T size={22} lh={22} w={800} color={colors.tBb}>
                {arrow}
              </T>
            </Pressable>
          </Row>
        </View>

        {score.complete || score.callout ? (
          <View style={{ height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: score.complete ? colors.primary : colors.bbTint }}>
            <D size={20} ls={0.06} color={score.complete ? colors.onPrimary : colors.tBb} upper>
              {score.complete && score.winnerSideIndex !== null ? `${shortTeam(names[score.winnerSideIndex]!)} win` : (score.callout ?? '')}
            </D>
          </View>
        ) : null}

        <View style={{ flex: 1, minHeight: 0, flexDirection: 'row', gap: 10 }}>
          {[0, 1].map((side) => {
            const ink = inks[side]!;
            const team = g.teams[side]!;
            const otherBonus = g.teams[side === 0 ? 1 : 0]!.bonus;
            const dim = score.complete && score.winnerSideIndex !== side;
            return (
              <View key={side} style={{ flex: 1, borderRadius: 22, backgroundColor: fills[side], padding: 12, gap: 4, opacity: dim ? 0.4 : 1 }}>
                <T size={14} lh={18} w={800} color={ink} numberOfLines={2}>
                  {names[side]}
                </T>
                <D size={76} lh={64} color={ink} style={{ fontVariant: ['tabular-nums'] }}>
                  {String(totals[side])}
                </D>
                <Row gap={4}>
                  <T size={11} w={800} color={ink}>
                    FOULS
                  </T>
                  <Row gap={3}>{dots(team.fouls, ink)}</Row>
                </Row>
                <T size={11} w={800} color={ink}>
                  TIMEOUTS {toLeft(team.timeoutsLeft)}
                  {otherBonus ? ' · BONUS' : ''}
                </T>
                {pickChips(side, 2)}
                {scoreButtons(side, true)}
              </View>
            );
          })}
        </View>
        {notices}
        {bottom}
        {sheets}
      </>
    );
  }

  // ------------------------------------------------------------------ first-to (3v3 style)
  const target = rules.target;
  const ball = g.possessionSideIndex ?? 0;
  const lead = totals[0] === totals[1] ? null : totals[0]! > totals[1]! ? 0 : 1;
  let callout = `BALL: ${shortTeam(names[ball]!).toUpperCase()}`;
  let calloutBg = colors.surface;
  let calloutFg = colors.muted;
  if (score.complete) {
    callout = score.winnerSideIndex === null ? 'GAME OVER' : `${shortTeam(names[score.winnerSideIndex]!).toUpperCase()} WIN`;
    calloutBg = colors.primary;
    calloutFg = colors.onPrimary;
  } else if (g.suddenDeath) {
    callout = 'TIME · TIED · NEXT BASKET WINS';
    calloutBg = colors.bbTint;
    calloutFg = colors.tBb;
  } else if (score.callout === 'Game point') {
    callout = `GAME POINT · ${shortTeam(names[lead ?? 0]!).toUpperCase()}`;
    calloutBg = colors.bbTint;
    calloutFg = colors.tBb;
  }

  return (
    <>
      {header}
      <Row gap={8}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={running ? 'Pause clock' : 'Start clock'}
          disabled={score.complete || timeUp}
          onPress={toggleClock}
          style={{ flex: 1.5, height: 52, borderRadius: 14, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: running ? colors.surface : colors.primary, opacity: score.complete ? 0.5 : 1 }}
        >
          <PlayIcon running={running} color={running ? colors.fg : colors.onPrimary} />
          <D size={28} color={running ? colors.fg : colors.onPrimary} style={{ fontVariant: ['tabular-nums'] }}>
            {formatClock(left)}
          </D>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reset shot clock"
          disabled={!hasShot}
          onPress={() => store.shot(match.id, g.period, seconds, rules.shotClock)}
          style={{ flex: 1, height: 52, borderRadius: 14, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}
        >
          <T size={10} w={700} ls={0.08} color={colors.muted}>
            SHOT
          </T>
          <D size={22} lh={22} color={hasShot && reading.shot <= 5 ? RED : colors.fg}>
            {hasShot ? String(Math.ceil(reading.shot)) : '–'}
          </D>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Ball: ${names[ball]}. Tap to flip.`}
          disabled={score.complete}
          onPress={flip}
          style={{ flex: 1.2, height: 52, borderRadius: 14, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}
        >
          <T size={10} w={700} ls={0.08} color={colors.muted}>
            BALL
          </T>
          <T size={13} w={800} numberOfLines={1}>
            {shortTeam(names[ball]!)}
          </T>
        </Pressable>
      </Row>

      <View style={{ height: 38, borderRadius: 12, backgroundColor: calloutBg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }}>
        <D size={callout.length > 22 ? 17 : 22} ls={0.06} color={calloutFg} numberOfLines={1}>
          {callout}
        </D>
      </View>

      <View style={{ flex: 1, minHeight: 0, gap: 10 }}>
        {[0, 1].map((side) => {
          const ink = inks[side]!;
          const team = g.teams[side]!;
          const total = totals[side]!;
          const pct = Math.min(100, Math.round((total / target) * 100));
          const dim = score.complete && score.winnerSideIndex !== side;
          const lines = (g.players[side] ?? []).filter((p) => p.onCourt);
          return (
            <View key={side} style={{ flex: 1, borderRadius: 24, backgroundColor: fills[side], paddingVertical: 12, paddingHorizontal: 14, gap: 6, opacity: dim ? 0.4 : 1 }}>
              <Row between>
                <T size={15} w={800} color={ink} flex numberOfLines={1}>
                  {names[side]}
                </T>
                <Row gap={6}>
                  <T size={12} w={700} color={ink}>
                    TEAM FOULS {team.fouls}/{rules.teamFoulLimit}
                  </T>
                  {team.bonus ? (
                    <View style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: 5, backgroundColor: ink }}>
                      <T size={10} w={800} color={fills[side]}>
                        BONUS
                      </T>
                    </View>
                  ) : null}
                </Row>
              </Row>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12 }}>
                <D size={84} lh={70} color={ink} style={{ fontVariant: ['tabular-nums'] }}>
                  {String(total)}
                </D>
                <View style={{ flex: 1, gap: 4, paddingBottom: 4 }}>
                  <View style={{ height: 8, borderRadius: 4, backgroundColor: side === 0 ? 'rgba(10,10,10,0.18)' : 'rgba(128,128,128,0.25)', overflow: 'hidden' }}>
                    <View style={{ height: 8, width: `${pct}%`, backgroundColor: ink }} />
                  </View>
                  <T size={12} w={700} color={ink}>
                    {total >= target ? `Reached ${target}` : `${target - total} to win`}
                  </T>
                </View>
              </View>
              {lines.length ? (
                <Row gap={10} style={{ flexWrap: 'wrap' }}>
                  {lines.map((p) => {
                    const r = rosters[side]![p.index];
                    return (
                      <T key={p.index} size={12} w={700} color={ink}>
                        {r?.number === null || r?.number === undefined ? r?.first : `#${r.number}`}{' '}
                        <T size={12} w={700} color={ink} style={{ opacity: 0.75 }}>
                          {p.points} pts · {p.fouls}F
                        </T>
                      </T>
                    );
                  })}
                </Row>
              ) : null}
              {pickChips(side, 3)}
              {scoreButtons(side, false)}
            </View>
          );
        })}
      </View>
      {notices}
      {bottom}
      {sheets}
    </>
  );
}
