import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useTheme } from '@/shared/theme';
import { Button, D, EmptyState, Header, Icon, IconButton, Row, Screen, T } from '@/shared/ui';
import { firstName } from '@/shared/utils/format';
import { colorWord, inkOn, setupLine, TEAM_COLORS } from '../basketball';
import { AddPlayerSheet } from '../components/AddPlayerSheet';
import { CourtPlayers, HalfCourt, type CourtSpot } from '../components/basketball/Court';
import { lineupKeys, type LineupPlayer } from '../lineup';
import { useMatchDraft } from '../store/draft.store';

const MAX_TEAM = 12;
/** Half-court spots for the preview: the team with the ball attacks (bottom), the other defends. */
const ATTACK: Record<number, [number, number][]> = {
  3: [
    [50, 82],
    [16, 58],
    [84, 58],
  ],
  4: [
    [30, 82],
    [70, 82],
    [14, 58],
    [86, 58],
  ],
};
const DEFEND: Record<number, [number, number][]> = {
  3: [
    [50, 52],
    [31, 33],
    [69, 33],
  ],
  4: [
    [38, 50],
    [62, 50],
    [25, 30],
    [75, 30],
  ],
};
const STARTING: [number, number][] = [
  [50, 80],
  [15, 52],
  [85, 52],
  [29, 22],
  [71, 22],
];

function TeamName({ side, value, ink, onChange, size = 22 }: { side: number; value: string; ink: string; onChange: (v: string) => void; size?: number }) {
  return (
    <TextInput
      accessibilityLabel={`Team ${side === 0 ? 'A' : 'B'} name`}
      value={value}
      onChangeText={onChange}
      maxLength={40}
      autoCapitalize="words"
      style={{ flex: 1, minWidth: 0, fontFamily: 'BigShouldersDisplay_900Black', fontSize: size, textTransform: 'uppercase', color: ink, padding: 0 }}
    />
  );
}

/** "Teams": names, jersey colours and players for each side; 5v5 also picks the starting five. */
export default function BasketballTeamsScreen() {
  const { colors } = useTheme();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const me = useAuthStore((s) => s.user);
  const { sport, lineup, hoops, add, remove, setHoops, swap } = useMatchDraft();
  const [adding, setAdding] = useState<number | null>(null);
  const [tab, setTab] = useState<0 | 1>(0);
  const [selected, setSelected] = useState<number | null>(null);

  if (!sport) {
    return (
      <Screen>
        <Header />
        <EmptyState title="Pick a sport first" action={<Button label="Choose a sport" inline onPress={() => router.replace('/match/new')} />} />
      </Screen>
    );
  }

  const forResult = mode === 'result';
  const size = hoops.setup.size;
  const nameOf = (p: LineupPlayer) => (p.userId && p.userId === me?.id ? 'You' : p.displayName);
  const short = (p: LineupPlayer) => firstName(p.userId && p.userId === me?.id ? (me?.fullName ?? p.displayName) : p.displayName);
  const number = (p: LineupPlayer) => hoops.jerseys[p.key];
  const setName = (side: number, v: string) => setHoops({ names: side === 0 ? [v, hoops.names[1]] : [hoops.names[0], v] });
  const setColor = (side: number, c: string) => setHoops({ colors: side === 0 ? [c, hoops.colors[1]] : [hoops.colors[0], c] });
  const empty = lineup.some((players) => players.length === 0);
  const next = () => {
    if (forResult) router.dismissTo('/match/enter');
    else router.push('/match/jerseys');
  };
  const cta = (
    <View style={{ gap: 8 }}>
      <T size={size === 5 ? 12 : 13} color={colors.muted} center>
        {empty
          ? 'Each team needs at least one player'
          : size === 5
            ? 'Up to 12 a team · swap anytime during timeouts'
            : `First ball: ${hoops.names[0]} (coin toss). You can change it before the first point.`}
      </T>
      <Button label={forResult ? 'Done' : 'Next: jersey numbers'} weight={800} disabled={empty} onPress={next} />
    </View>
  );
  const header = (
    <Row gap={12}>
      <IconButton icon="back" label="Back" onPress={() => router.back()} />
      <View style={{ flex: 1 }}>
        <T size={12} color={colors.muted}>
          {setupLine(hoops.setup)}
        </T>
        <T size={17} w={700}>
          Teams
        </T>
      </View>
      {size === 5 ? (
        <T size={12} w={700} color={colors.muted}>
          {lineup[0]!.length + lineup[1]!.length} players
        </T>
      ) : null}
    </Row>
  );
  const sheet = (
    <AddPlayerSheet
      visible={adding !== null}
      side={adding ?? 1}
      sport={sport.slug}
      sportName={sport.name}
      taken={lineupKeys(lineup)}
      onAdd={(p) => add(adding ?? 1, p)}
      onClose={() => setAdding(null)}
    />
  );

  // ------------------------------------------------------------------ 3v3 / 4v4
  if (size < 5) {
    const spots: CourtSpot[] = ([0, 1] as const).flatMap((side) =>
      lineup[side]!.slice(0, size).map((p, i) => {
        const [x, y] = (side === 0 ? ATTACK[size]! : DEFEND[size]!)[i]!;
        const n = number(p);
        return { key: p.key, x, y, number: typeof n === 'number' ? String(n) : '?', label: short(p), color: hoops.colors[side], empty: typeof n !== 'number', accessibilityLabel: nameOf(p) };
      }),
    );
    return (
      <Screen gap={14} footer={cta}>
        {header}
        <View style={{ gap: 6 }}>
          <Row between>
            <T size={11} w={800} ls={0.08} color={colors.muted}>
              ON COURT · {hoops.setup.court === 'half' ? 'HALF COURT' : 'FULL COURT'}
            </T>
            <Row gap={10}>
              <Row gap={4}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: hoops.colors[0] }} />
                <T size={11} w={700} color={colors.muted}>
                  Ball first
                </T>
              </Row>
              <Row gap={4}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: hoops.colors[1], borderWidth: 1, borderColor: colors.faint }} />
                <T size={11} w={700} color={colors.muted}>
                  Defending
                </T>
              </Row>
            </Row>
          </Row>
          <View style={{ alignItems: 'center' }}>
            <HalfCourt>
              <CourtPlayers spots={spots} small />
            </HalfCourt>
          </View>
        </View>

        {([0, 1] as const).map((side) => {
          const fill = hoops.colors[side];
          const ink = inkOn(fill);
          return (
            <View key={side} style={{ borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: fill }}>
                <TeamName side={side} value={hoops.names[side]} ink={ink} onChange={(v) => setName(side, v)} />
                <Row gap={6}>
                  {TEAM_COLORS[side].map((c) => (
                    <Pressable
                      key={c}
                      accessibilityRole="button"
                      accessibilityLabel={`Jersey colour ${colorWord(c).toLowerCase()}`}
                      accessibilityState={{ selected: c === fill }}
                      onPress={() => setColor(side, c)}
                      style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: c, borderWidth: c === fill ? 2 : c === '#F2EDE7' ? 1 : 0, borderColor: c === fill ? '#0A0A0A' : '#D2C8BE' }}
                    />
                  ))}
                </Row>
              </View>
              <View style={{ paddingVertical: 4, paddingHorizontal: 14 }}>
                {lineup[side]!.map((p) => {
                  const n = number(p);
                  return (
                    <Pressable
                      key={p.key}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${nameOf(p)}`}
                      onPress={() => remove(p.key)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.raised }}
                    >
                      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: side === 0 ? colors.bbTint : colors.raised, alignItems: 'center', justifyContent: 'center' }}>
                        <D size={18} color={side === 0 ? colors.tBb : colors.fg}>
                          {typeof n === 'number' ? String(n) : '–'}
                        </D>
                      </View>
                      <T size={15} w={600} flex numberOfLines={1}>
                        {p.userId && p.userId === me?.id ? (me?.fullName ?? p.displayName) : p.displayName}
                      </T>
                      {p.userId && p.userId === me?.id ? (
                        <T size={12} color={colors.muted}>
                          You
                        </T>
                      ) : p.isGuest ? (
                        <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: colors.raised }}>
                          <T size={11} w={700} color={colors.muted}>
                            GUEST
                          </T>
                        </View>
                      ) : null}
                      <Icon name="close" size={14} color={colors.faint} />
                    </Pressable>
                  );
                })}
                {lineup[side]!.length < MAX_TEAM ? (
                  <Pressable accessibilityRole="button" accessibilityLabel={`Add player to ${hoops.names[side]}`} onPress={() => setAdding(side)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
                    <View style={{ width: 34, height: 34, borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.faint, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="plus" size={14} color={colors.fg} strokeWidth={2.6} />
                    </View>
                    <T size={14} w={700}>
                      {lineup[side]!.length < size ? 'Add player' : 'Add sub'}
                    </T>
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        })}

        <View style={{ gap: 8 }}>
          <T size={13} w={600} color={colors.muted}>
            While scoring
          </T>
          <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', padding: 4, borderRadius: 14, backgroundColor: colors.surface, gap: 4 }}>
            {(
              [
                [false, 'Team score only', 'Fastest'],
                [true, 'Who scored too', 'Builds player stats'],
              ] as const
            ).map(([tag, title, note]) => {
              const on = hoops.tagPlayers === tag;
              return (
                <Pressable
                  key={title}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={title}
                  onPress={() => setHoops({ tagPlayers: tag })}
                  style={{ flex: 1, padding: 8, borderRadius: 11, alignItems: 'center', gap: 2, backgroundColor: on ? colors.primary : 'transparent' }}
                >
                  <T size={14} w={700} color={on ? colors.onPrimary : colors.muted}>
                    {title}
                  </T>
                  <T size={11} color={on ? colors.onPrimary : colors.muted} style={{ opacity: 0.8 }}>
                    {note}
                  </T>
                </Pressable>
              );
            })}
          </View>
        </View>
        {sheet}
      </Screen>
    );
  }

  // ------------------------------------------------------------------ 5v5: starting five + bench
  const team = lineup[tab]!;
  const starters = team.slice(0, 5);
  const bench = team.slice(5);
  const fill = hoops.colors[tab];
  const ink = inkOn(fill);
  const cycleColor = () => {
    const options = TEAM_COLORS[tab];
    setColor(tab, options[(options.indexOf(fill) + 1) % options.length]!);
  };
  const spots: CourtSpot[] = STARTING.map(([x, y], i) => {
    const p = starters[i];
    if (!p) return { key: `open-${i}`, x, y, number: '+', label: 'Open spot', color: fill, open: true, onPress: () => setAdding(tab), accessibilityLabel: 'Open spot: add a player' };
    const n = number(p);
    return {
      key: p.key,
      x,
      y,
      number: typeof n === 'number' ? String(n) : '?',
      label: short(p) + (i === 0 ? ' (C)' : ''),
      color: fill,
      empty: typeof n !== 'number',
      selected: selected === i,
      onPress: () => setSelected(selected === i ? null : i),
      accessibilityLabel: `Swap ${nameOf(p)}`,
    };
  });

  return (
    <Screen gap={12} footer={cta}>
      {header}
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', padding: 4, borderRadius: 14, backgroundColor: colors.surface, gap: 4 }}>
        {([0, 1] as const).map((side) => (
          <Pressable
            key={side}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === side }}
            accessibilityLabel={hoops.names[side]}
            onPress={() => {
              setTab(side);
              setSelected(null);
            }}
            style={{ flex: 1, height: 40, borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: tab === side ? colors.raised : 'transparent' }}
          >
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: hoops.colors[side], borderWidth: 1, borderColor: colors.faint }} />
            <T size={14} w={700} numberOfLines={1}>
              {hoops.names[side]}
            </T>
          </Pressable>
        ))}
      </View>

      <View style={{ borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: fill }}>
          <TeamName side={tab} value={hoops.names[tab]} ink={ink} onChange={(v) => setName(tab, v)} />
          <Pressable accessibilityRole="button" accessibilityLabel="Change jersey colour" onPress={cycleColor}>
            <T size={11} w={800} ls={0.06} color={ink} style={{ opacity: 0.75 }}>
              {colorWord(fill) || 'COLOUR'}
            </T>
          </Pressable>
        </View>
        <View style={{ paddingTop: 10, alignItems: 'center', gap: 6 }}>
          <Row between style={{ width: 322 }}>
            <T size={11} w={800} ls={0.08} color={colors.muted}>
              STARTING 5
            </T>
            <T size={11} w={700} color={selected === null ? colors.muted : colors.accentText}>
              {selected === null ? 'Tap a jersey to sub out' : 'Now pick who comes in ↓'}
            </T>
          </Row>
          <HalfCourt width={322}>
            <CourtPlayers spots={spots} width={322} />
          </HalfCourt>
        </View>
        <Row between style={{ paddingTop: 12, paddingHorizontal: 14, paddingBottom: 2 }}>
          <T size={11} w={800} ls={0.08} color={colors.muted}>
            BENCH
          </T>
          <T size={11} color={colors.muted}>
            Subs can come on any time
          </T>
        </Row>
        <View style={{ paddingHorizontal: 14, paddingBottom: 4 }}>
          {bench.map((p) => {
            const n = number(p);
            const out = selected === null ? null : starters[selected];
            return (
              <Pressable
                key={p.key}
                accessibilityRole="button"
                accessibilityLabel={out ? `Swap ${nameOf(p)} in for ${nameOf(out)}` : `Remove ${nameOf(p)}`}
                onPress={() => {
                  if (out) {
                    swap(tab, out.key, p.key);
                    setSelected(null);
                  } else remove(p.key);
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, height: 42, borderBottomWidth: 1, borderBottomColor: colors.raised }}
              >
                <View style={{ width: 32, height: 32, borderRadius: 9, borderWidth: 1.5, borderColor: colors.line2, alignItems: 'center', justifyContent: 'center' }}>
                  <D size={18} color={colors.muted}>
                    {typeof n === 'number' ? String(n) : '–'}
                  </D>
                </View>
                <T size={15} w={600} color={colors.soft} flex numberOfLines={1}>
                  {nameOf(p)}
                </T>
                <T size={12} w={800} color={out ? colors.accentText : colors.faint}>
                  {out ? 'SWAP IN' : p.isGuest ? 'GUEST' : 'SUB'}
                </T>
              </Pressable>
            );
          })}
          {team.length < MAX_TEAM ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Add player by name or phone" onPress={() => setAdding(tab)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, height: 46 }}>
              <View style={{ width: 32, height: 32, borderRadius: 9, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.faint, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="plus" size={14} color={colors.fg} strokeWidth={2.6} />
              </View>
              <T size={14} w={700}>
                Add player by name or phone
              </T>
            </Pressable>
          ) : null}
        </View>
      </View>
      {sheet}
    </Screen>
  );
}
