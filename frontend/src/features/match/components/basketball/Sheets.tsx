import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/shared/theme';
import { D, Icon, Row, Sheet, T } from '@/shared/ui';
import { foulWarning, shortTeam, tagName, type HoopsRules, type Roster } from '../../basketball';
import type { GameDetail, MatchView, PlayEntry } from '../../types';

const BLUE = '#3B82F6';
const KINDS = [
  ['personal', 'Personal'],
  ['shooting', 'Shooting · free throws'],
  ['technical', 'Technical'],
  ['unsportsmanlike', 'Unsportsmanlike'],
] as const;

function Seg({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      onPress={onPress}
      style={{ flex: 1, height: 44, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, backgroundColor: on ? colors.primary : 'transparent' }}
    >
      <T size={14} w={700} color={on ? colors.onPrimary : colors.muted} numberOfLines={1}>
        {label}
      </T>
    </Pressable>
  );
}

function Tile({ title, note, onPress, disabled }: { title: string; note: string; onPress: () => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      accessibilityLabel={`${title}. ${note}`}
      disabled={disabled}
      onPress={onPress}
      style={{ width: '48%', flexGrow: 1, padding: 12, borderRadius: 14, backgroundColor: colors.raised, gap: 2, opacity: disabled ? 0.45 : 1 }}
    >
      <T size={14} w={700} numberOfLines={1}>
        {title}
      </T>
      <T size={12} color={colors.muted} numberOfLines={1}>
        {note}
      </T>
    </Pressable>
  );
}

/**
 * "Foul" from the ... button: team, the player on court, the kind of foul; also timeouts,
 * substitutions, ending the period, and the match menu (end early, add a scorer, abandon).
 */
export function FoulSheet({
  match,
  game,
  rules,
  rosters,
  clockText,
  canEndPeriod,
  endLabel,
  endNote,
  complete,
  onClose,
  onFoul,
  onTimeout,
  onSub,
  onEndPeriod,
  onMatchMenu,
}: {
  match: MatchView;
  game: GameDetail;
  rules: HoopsRules;
  rosters: [Roster[], Roster[]];
  clockText: string;
  canEndPeriod: boolean;
  endLabel: string;
  endNote: string;
  complete: boolean;
  onClose: () => void;
  onFoul: (side: number, playerIndex: number | null, kind: string) => void;
  onTimeout: (side: number) => void;
  onSub: () => void;
  onEndPeriod: () => void;
  onMatchMenu: () => void;
}) {
  const { colors } = useTheme();
  const [side, setSide] = useState(0);
  const [player, setPlayer] = useState<number | null>(null);
  const [kind, setKind] = useState<string>('personal');
  const names = match.sides.map((s) => s.name);
  const onCourt = (game.players[side] ?? []).filter((p) => p.onCourt);
  const chosen = player === null ? null : (game.players[side] ?? [])[player];
  const who = player === null ? null : rosters[side]![player];
  const warn = chosen && who ? foulWarning({ name: who.first, number: who.number, fouls: chosen.fouls }, game.teams[side]!.fouls, rules) : null;
  const window = rules.timeoutsPer === 'half' && rules.timed && rules.periods > 1 ? 'this half' : 'this game';
  const hasPlayers = rosters.some((r) => r.length > 0);

  return (
    <Sheet visible onClose={onClose} scroll>
      <Row between>
        <T size={20} w={700}>
          {complete ? 'Match' : 'Foul'}
        </T>
        <T size={13} color={colors.muted}>
          {clockText}
        </T>
      </Row>
      {complete ? null : (
        <>
          <View accessibilityRole="radiogroup" accessibilityLabel="Team" style={{ flexDirection: 'row', padding: 4, borderRadius: 14, backgroundColor: colors.bg, gap: 4 }}>
            {[0, 1].map((s) => (
              <Seg
                key={s}
                on={side === s}
                label={`${shortTeam(names[s]!)} · ${game.teams[s]!.fouls} foul${game.teams[s]!.fouls === 1 ? '' : 's'}`}
                onPress={() => {
                  setSide(s);
                  setPlayer(null);
                }}
              />
            ))}
          </View>
          {onCourt.length ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {onCourt.map((p) => {
                const r = rosters[side]![p.index];
                const on = player === p.index;
                const danger = rules.foulOutAt > 0 && p.fouls >= rules.foulOutAt - 1;
                return (
                  <Pressable
                    key={p.index}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on, disabled: p.fouledOut }}
                    accessibilityLabel={`${r?.name ?? 'Player'}, ${p.fouls} fouls${p.fouledOut ? ', fouled out' : ''}`}
                    disabled={p.fouledOut}
                    onPress={() => setPlayer(on ? null : p.index)}
                    style={{ flex: 1, height: 72, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.bbTint : colors.raised, borderWidth: on ? 2 : 0, borderColor: BLUE, opacity: p.fouledOut ? 0.4 : 1 }}
                  >
                    <D size={26} lh={26}>
                      {r?.number === null || r?.number === undefined ? '–' : String(r.number)}
                    </D>
                    <T size={10} w={700} numberOfLines={1}>
                      {r?.first ?? ''}
                    </T>
                    <T size={10} w={800} color={danger || p.fouledOut ? colors.bad : colors.muted}>
                      {p.fouledOut ? 'OUT' : `${p.fouls}F`}
                    </T>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          {warn ? (
            <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.warnBg }}>
              <Icon name="alert" size={18} color={colors.warnText} />
              <T size={13} lh={18} color={colors.warnText} flex>
                {warn}
              </T>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {KINDS.map(([k, label]) => {
              const on = kind === k;
              return (
                <Pressable
                  key={k}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={label}
                  onPress={() => setKind(k)}
                  style={{ width: '48%', flexGrow: 1, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.primary : colors.raised }}
                >
                  <T size={14} w={on ? 800 : 700} color={on ? colors.onPrimary : colors.fg}>
                    {label}
                  </T>
                </Pressable>
              );
            })}
          </View>
          <View style={{ height: 1, backgroundColor: colors.line }} />
          <View style={{ gap: 8 }}>
            <T size={12} w={700} ls={0.08} color={colors.muted}>
              ALSO
            </T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {[0, 1].map((s) => {
                const left = game.teams[s]!.timeoutsLeft;
                return <Tile key={s} title={`Timeout · ${shortTeam(names[s]!)}`} note={left === 0 ? `None left ${window}` : `${left} left ${window}`} disabled={left === 0} onPress={() => onTimeout(s)} />;
              })}
              <Tile title="Substitution" note="Who’s coming on" disabled={!hasPlayers} onPress={onSub} />
              <Tile title={endLabel} note={endNote} disabled={!canEndPeriod} onPress={onEndPeriod} />
            </View>
          </View>
        </>
      )}
      <Pressable accessibilityRole="button" onPress={onMatchMenu} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
        <Icon name="sliders" size={18} color={colors.muted} />
        <T size={14} w={700} color={colors.muted} flex>
          Match menu · end early, add a scorer, abandon
        </T>
        <Icon name="chevronRight" size={16} color={colors.faint} />
      </Pressable>
      {complete ? null : (
        <Row gap={10}>
          <Pressable accessibilityRole="button" onPress={onClose} style={{ flex: 1, height: 52, borderRadius: 14, backgroundColor: colors.raised, alignItems: 'center', justifyContent: 'center' }}>
            <T size={15} w={700}>
              Cancel
            </T>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Add foul · ${who ? tagName(who) : shortTeam(names[side]!)}`}
            onPress={() => onFoul(side, player, kind)}
            style={{ flex: 1.4, height: 52, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }}
          >
            <T size={15} w={800} color={colors.onPrimary} numberOfLines={1}>
              Add foul · {who ? tagName(who) : shortTeam(names[side]!)}
            </T>
          </Pressable>
        </Row>
      )}
    </Sheet>
  );
}

/** Substitution: who goes off (on court) and who comes on (bench, not fouled out). */
export function SubSheet({ game, rosters, names, onClose, onSub }: { game: GameDetail; rosters: [Roster[], Roster[]]; names: string[]; onClose: () => void; onSub: (side: number, outIndex: number, inIndex: number) => void }) {
  const { colors } = useTheme();
  const [side, setSide] = useState(0);
  const [out, setOut] = useState<number | null>(null);
  const [inn, setIn] = useState<number | null>(null);
  const lines = game.players[side] ?? [];
  const onCourt = lines.filter((p) => p.onCourt);
  const bench = lines.filter((p) => !p.onCourt);
  const chip = (index: number, on: boolean, onPress: () => void, disabled = false, note?: string) => {
    const r = rosters[side]![index];
    return (
      <Pressable
        key={index}
        accessibilityRole="button"
        accessibilityState={{ selected: on, disabled }}
        accessibilityLabel={r?.name ?? 'Player'}
        disabled={disabled}
        onPress={onPress}
        style={{ height: 44, paddingHorizontal: 14, borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: on ? 1.5 : 1, borderColor: on ? BLUE : colors.line2, backgroundColor: on ? colors.bbTint : 'transparent', opacity: disabled ? 0.4 : 1 }}
      >
        <T size={14} w={on ? 700 : 600}>
          {tagName(r)}
        </T>
        {note ? (
          <T size={11} w={800} color={colors.bad}>
            {note}
          </T>
        ) : null}
      </Pressable>
    );
  };
  const outName = out === null ? null : rosters[side]![out];
  const inName = inn === null ? null : rosters[side]![inn];
  return (
    <Sheet visible onClose={onClose} scroll>
      <T size={20} w={700}>
        Substitution
      </T>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', padding: 4, borderRadius: 14, backgroundColor: colors.bg, gap: 4 }}>
        {[0, 1].map((s) => (
          <Seg
            key={s}
            on={side === s}
            label={shortTeam(names[s]!)}
            onPress={() => {
              setSide(s);
              setOut(null);
              setIn(null);
            }}
          />
        ))}
      </View>
      <View style={{ gap: 8 }}>
        <T size={13} w={600} color={colors.muted}>
          Going off
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{onCourt.map((p) => chip(p.index, out === p.index, () => setOut(p.index), false, p.fouledOut ? 'OUT' : undefined))}</View>
      </View>
      <View style={{ gap: 8 }}>
        <T size={13} w={600} color={colors.muted}>
          Coming on
        </T>
        {bench.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{bench.map((p) => chip(p.index, inn === p.index, () => setIn(p.index), p.fouledOut, p.fouledOut ? 'OUT' : undefined))}</View>
        ) : (
          <T size={13} color={colors.muted}>
            Nobody on the bench. Add subs when you set up the teams.
          </T>
        )}
      </View>
      <Row gap={10}>
        <Pressable accessibilityRole="button" onPress={onClose} style={{ flex: 1, height: 52, borderRadius: 14, backgroundColor: colors.raised, alignItems: 'center', justifyContent: 'center' }}>
          <T size={15} w={700}>
            Cancel
          </T>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: out === null || inn === null }}
          accessibilityLabel={outName && inName ? `${tagName(inName)} on for ${tagName(outName)}` : 'Make the sub'}
          disabled={out === null || inn === null}
          onPress={() => out !== null && inn !== null && onSub(side, out, inn)}
          style={{ flex: 1.4, height: 52, borderRadius: 14, backgroundColor: out === null || inn === null ? colors.raised : colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }}
        >
          <T size={15} w={800} color={out === null || inn === null ? colors.faint : colors.onPrimary} numberOfLines={1}>
            {outName && inName ? `${tagName(inName)} on for ${tagName(outName)}` : 'Make the sub'}
          </T>
        </Pressable>
      </Row>
    </Sheet>
  );
}

/** "Who scored?" for the last basket (with an optional assist and and-one), or who fouled. */
export function WhoScoredSheet({
  play,
  game,
  rosters,
  names,
  onClose,
  onSave,
}: {
  play: PlayEntry;
  game: GameDetail;
  rosters: [Roster[], Roster[]];
  names: string[];
  onClose: () => void;
  onSave: (playerIndex: number | null, assistIndex: number | null, andOne: boolean) => void;
}) {
  const { colors } = useTheme();
  const side = play.sideIndex ?? 0;
  const [player, setPlayer] = useState<number | null>(play.playerIndex);
  const [assist, setAssist] = useState<number | null>(play.assistIndex);
  const scoring = play.kind === 'score';
  const lines = (game.players[side] ?? []).filter((p) => p.onCourt || p.index === play.playerIndex);
  const who = player === null ? null : rosters[side]![player];
  const columns = lines.length <= 3 ? 3 : lines.length === 4 ? 2 : 3;
  return (
    <Sheet visible onClose={onClose} scroll>
      <View style={{ gap: 2 }}>
        <T size={12} w={700} ls={0.08} color={colors.tBb}>
          {`${scoring ? `+${play.points ?? 0}` : 'FOUL'} · ${(names[side] ?? '').toUpperCase()}`}
        </T>
        <T size={20} w={700}>
          {scoring ? 'Who scored?' : 'Foul by who?'}
        </T>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {lines.map((p) => {
          const r = rosters[side]![p.index];
          const on = player === p.index;
          const blocked = p.fouledOut && p.index !== play.playerIndex;
          return (
            <Pressable
              key={p.index}
              accessibilityRole="button"
              accessibilityState={{ selected: on, disabled: blocked }}
              accessibilityLabel={r?.name ?? 'Player'}
              disabled={blocked}
              onPress={() => {
                setPlayer(p.index);
                if (assist === p.index) setAssist(null);
              }}
              style={{ width: columns === 3 ? '30%' : '47%', flexGrow: 1, height: 104, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: on ? BLUE : colors.raised, borderWidth: on ? 0 : 1, borderColor: colors.line, opacity: blocked ? 0.4 : 1 }}
            >
              <D size={44} lh={44} color={on ? '#0A0A0A' : colors.fg}>
                {r?.number === null || r?.number === undefined ? '–' : String(r.number)}
              </D>
              <T size={13} w={700} color={on ? '#0A0A0A' : colors.fg} numberOfLines={1}>
                {r?.first ?? ''}
              </T>
              <T size={11} w={700} color={on ? '#0A0A0A' : colors.muted}>
                {blocked ? 'FOULED OUT' : scoring ? `${p.points} pts` : `${p.fouls} fouls`}
              </T>
            </Pressable>
          );
        })}
      </View>
      {scoring && play.points !== 1 ? (
        <View style={{ gap: 8 }}>
          <T size={13} w={600} color={colors.muted}>
            Assist (optional)
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[...lines.filter((p) => p.index !== player).map((p) => p.index), null].map((index) => {
              const on = assist === index;
              return (
                <Pressable
                  key={index ?? 'none'}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={index === null ? 'No assist' : tagName(rosters[side]![index])}
                  onPress={() => setAssist(index)}
                  style={{ height: 40, paddingHorizontal: 14, borderRadius: 20, justifyContent: 'center', borderWidth: on ? 1.5 : 1, borderColor: on ? BLUE : colors.line2, backgroundColor: on ? colors.bbTint : 'transparent' }}
                >
                  <T size={14} w={600} color={index === null && !on ? colors.muted : colors.fg}>
                    {index === null ? 'None' : tagName(rosters[side]![index])}
                  </T>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
      {scoring && play.points !== 1 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="And-one: fouled on the shot, add a free throw"
          onPress={() => onSave(player, assist, true)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: colors.raised }}
        >
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
            <D size={18}>+1</D>
          </View>
          <View style={{ flex: 1 }}>
            <T size={15} w={700}>
              And-one
            </T>
            <T size={12} color={colors.muted}>
              Fouled on the shot, add a free throw
            </T>
          </View>
        </Pressable>
      ) : null}
      <Row gap={10}>
        <Pressable accessibilityRole="button" onPress={onClose} style={{ flex: 1, height: 54, borderRadius: 14, backgroundColor: colors.raised, alignItems: 'center', justifyContent: 'center' }}>
          <T size={15} w={700}>
            Skip
          </T>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: player === null }}
          accessibilityLabel={who ? `Save · ${tagName(who)}` : 'Pick a player'}
          disabled={player === null}
          onPress={() => onSave(player, scoring ? assist : null, false)}
          style={{ flex: 1.4, height: 54, borderRadius: 14, backgroundColor: player === null ? colors.raised : colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }}
        >
          <T size={15} w={800} color={player === null ? colors.faint : colors.onPrimary} numberOfLines={1}>
            {who ? `Save · ${tagName(who)}` : 'Pick a player'}
          </T>
        </Pressable>
      </Row>
      <T size={12} color={colors.muted} center>
        {scoring
          ? `Skip keeps the ${play.points ?? 0} point${play.points === 1 ? '' : 's'} for the team. You can only tag the latest play.`
          : 'Skip keeps it as a team foul. You can only tag the latest play.'}
      </T>
    </Sheet>
  );
}
