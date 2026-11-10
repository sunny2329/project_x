import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { useTheme } from '@/shared/theme';
import { Button, D, EmptyState, Header, Icon, IconButton, Notice, Row, Screen, T } from '@/shared/ui';
import { firstName } from '@/shared/utils/format';
import { matchApi } from '../api/match.api';
import { configFromSetup, formatCode, jerseyClash, pressDigit, setupLine, SPOTS } from '../basketball';
import { AddPlayerSheet } from '../components/AddPlayerSheet';
import { CourtPlayers, HalfCourt, type CourtSpot } from '../components/basketball/Court';
import { lineupKeys, type LineupPlayer } from '../lineup';
import { useMatchDraft } from '../store/draft.store';

const ORANGE = '#E85D04';
const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

/**
 * "Jersey numbers": tap a shirt on the court (or a bench chip), type its number on the pad. Numbers
 * are unique per team. "Tip off" creates the match with names, colours and numbers.
 */
export default function JerseyNumbersScreen() {
  const { colors } = useTheme();
  const me = useAuthStore((s) => s.user);
  const { sport, rulesetId, lineup, hoops, add, setJersey, autoJerseys, swap } = useMatchDraft();
  const [tab, setTab] = useState<0 | 1>(0);
  const [selKey, setSelKey] = useState<string | null>(null);
  const [buf, setBuf] = useState('');
  const [warn, setWarn] = useState('');
  const [adding, setAdding] = useState(false);
  const { submit, submitting, formError } = useSubmit();

  if (!sport) {
    return (
      <Screen>
        <Header />
        <EmptyState title="Set up the match first" action={<Button label="New match" inline onPress={() => router.replace('/match/new')} />} />
      </Screen>
    );
  }

  const s = hoops.setup;
  const size = s.size;
  const team = lineup[tab]!;
  const keys = team.map((p) => p.key);
  const starters = team.slice(0, size);
  const bench = team.slice(size);
  const fill = hoops.colors[tab];
  const cur = team.find((p) => p.key === selKey) ?? team[0];
  const curOn = !!cur && starters.includes(cur);
  const num = (p: LineupPlayer) => hoops.jerseys[p.key];
  const fullName = (p: LineupPlayer) => (p.userId && p.userId === me?.id ? (me?.fullName ?? p.displayName) : p.displayName);
  const short = (p: LineupPlayer) => firstName(fullName(p));
  const value = buf === '' ? null : Number(buf);
  const clash = !!cur && value !== null && jerseyClash(keys, hoops.jerseys, cur.key, value);
  const warnText = clash ? `#${buf} is already taken on this team` : warn;
  const canSave = !!cur && buf !== '' && !clash;
  const pick = (key: string) => {
    setSelKey(key);
    setBuf('');
    setWarn('');
  };

  const save = () => {
    if (!cur || !canSave) return;
    setJersey(cur.key, value);
    const after = { ...hoops.jerseys, [cur.key]: value };
    const next = team.find((p) => typeof after[p.key] !== 'number');
    setBuf('');
    if (next) setSelKey(next.key);
  };
  /** Starters are the first N players: moving one to the bench brings the first sub on, and the other way round. */
  const toggle = () => {
    if (!cur) return;
    if (curOn) {
      const sub = bench[0];
      if (!sub) return setWarn(`Add a sub first: ${size} need to be on court.`);
      swap(tab, cur.key, sub.key);
    } else {
      const out = starters[starters.length - 1];
      if (out) swap(tab, out.key, cur.key);
    }
    setWarn('');
  };
  const missing = lineup.flat().filter((p) => typeof num(p) !== 'number').length;
  const timed = s.mode === 'time';

  const tipOff = () =>
    void submit(async () => {
      const { match } = await matchApi.create({
        sport: sport.slug,
        format: formatCode(s),
        ...(rulesetId ? { rulesetId } : {}),
        rulesOverride: configFromSetup(s, hoops.tagPlayers, 0),
        sides: lineup.map((players, side) => ({
          name: hoops.names[side]!.trim() || `Team ${side === 0 ? 'A' : 'B'}`,
          color: hoops.colors[side],
          players: players.map((p) => {
            const n = num(p);
            return typeof n === 'number' ? { ...p.input, jerseyNumber: n } : p.input;
          }),
        })),
      });
      useMatchDraft.getState().reset();
      router.dismissAll();
      router.push({ pathname: '/match/[id]', params: { id: match.id } });
    });

  const spots: CourtSpot[] = SPOTS[size]!.map(([x, y], i) => {
    const p = starters[i];
    if (!p) return { key: `open-${i}`, x, y, number: '+', label: 'Open spot', color: fill, open: true, onPress: () => setAdding(true), accessibilityLabel: 'Open spot on court: add a player' };
    const n = num(p);
    return {
      key: p.key,
      x,
      y,
      number: typeof n === 'number' ? String(n) : '?',
      label: short(p),
      color: fill,
      empty: typeof n !== 'number',
      selected: p.key === cur?.key,
      onPress: () => pick(p.key),
      accessibilityLabel: `Set jersey number for ${fullName(p)}`,
    };
  });

  const padKeys = [
    ...DIGITS.map((d) => ({ text: d, label: `Digit ${d}`, press: () => (setBuf(pressDigit(buf, d)), setWarn('')), on: false, size: 22 })),
    { text: '⌫', label: 'Delete', press: () => setBuf(buf.slice(0, -1)), on: false, size: 18 },
    { text: 'OK', label: 'Save number', press: save, on: canSave, size: 18 },
  ];

  return (
    <Screen
      gap={12}
      footer={
        <View style={{ gap: 2 }}>
          {formError ? <Notice tone="error" icon="alert" text={formError} /> : null}
          <Pressable accessibilityRole="button" onPress={autoJerseys} style={{ height: 30, alignItems: 'center', justifyContent: 'center' }}>
            <T size={13} w={700} color={colors.muted}>
              No jerseys? Give everyone a number (1, 2, 3…)
            </T>
          </Pressable>
          <Button
            label={timed ? `Tip off · start ${s.fmt === 'q' ? 'Q1' : s.fmt === 'h' ? 'H1' : 'the game'}` : 'Tip off'}
            color="#3B82F6"
            height={56}
            radius={16}
            weight={800}
            loading={submitting}
            onPress={tipOff}
          />
          {missing > 0 ? (
            <T size={11} color={colors.muted} center>
              {missing === 1 ? '1 player has no number yet: you can still start.' : `${missing} players have no number yet: you can still start.`}
            </T>
          ) : null}
        </View>
      }
    >
      <Row gap={12}>
        <IconButton icon="back" label="Back" onPress={() => router.back()} />
        <View style={{ flex: 1 }}>
          <T size={17} w={700}>
            {size === 5 ? 'Jersey numbers · 5v5' : 'Jersey numbers'}
          </T>
          <T size={12} color={colors.muted}>
            {size === 5 ? 'Full court' : setupLine(s).split(' · ').slice(0, 2).join(' · ')} · you’ll tap these to log points
          </T>
        </View>
      </Row>

      <View accessibilityRole="tablist" style={{ flexDirection: 'row', padding: 4, borderRadius: 14, backgroundColor: colors.surface, gap: 4 }}>
        {([0, 1] as const).map((side) => {
          const on = tab === side;
          return (
            <Pressable
              key={side}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={hoops.names[side]}
              onPress={() => {
                setTab(side);
                setSelKey(lineup[side]!.find((p) => typeof num(p) !== 'number')?.key ?? null);
                setBuf('');
                setWarn('');
              }}
              style={{ flex: 1, height: 40, borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: on ? colors.primary : 'transparent' }}
            >
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: hoops.colors[side], borderWidth: 1, borderColor: '#ABA39B' }} />
              <T size={14} w={700} color={on ? colors.onPrimary : colors.muted} numberOfLines={1}>
                {hoops.names[side]}
              </T>
            </Pressable>
          );
        })}
      </View>

      <View style={{ alignItems: 'center' }}>
        <HalfCourt
          overlay={
            <>
              <View style={{ position: 'absolute', left: 10, bottom: 8, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: 'rgba(10,10,10,0.72)' }}>
                <T size={10} w={800} ls={0.06} color="#FFFFFF">
                  {Math.min(size, team.length)} OF {size} ON COURT
                </T>
              </View>
              <View style={{ position: 'absolute', right: 10, bottom: 8, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: 'rgba(10,10,10,0.72)' }}>
                <T size={10} w={700} color="#FFFFFF">
                  Tap a jersey to set its number
                </T>
              </View>
            </>
          }
        >
          <CourtPlayers spots={spots} />
        </HalfCourt>
      </View>

      <View style={{ gap: 6 }}>
        <T size={11} w={800} ls={0.08} color={colors.muted}>
          BENCH
        </T>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {bench.map((p) => {
            const n = num(p);
            const has = typeof n === 'number';
            const sel = p.key === cur?.key;
            return (
              <Pressable
                key={p.key}
                accessibilityRole="button"
                accessibilityState={{ selected: sel }}
                accessibilityLabel={`Set jersey number for ${fullName(p)}`}
                onPress={() => pick(p.key)}
                style={{ height: 46, paddingLeft: 6, paddingRight: 12, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderWidth: sel ? 2 : 1, borderColor: sel ? ORANGE : colors.line }}
              >
                <View style={{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: has ? fill : 'transparent', borderWidth: has ? 0 : 1.5, borderStyle: 'dashed', borderColor: colors.bad }}>
                  <D size={18} color={has ? '#0A0A0A' : colors.bad}>
                    {has ? String(n) : '?'}
                  </D>
                </View>
                <View>
                  <T size={13} w={700}>
                    {short(p)}
                  </T>
                  <T size={10} w={700} color={has ? colors.muted : colors.bad}>
                    {has ? (p.isGuest ? 'GUEST · BENCH' : 'BENCH') : 'NO NUMBER'}
                  </T>
                </View>
              </Pressable>
            );
          })}
          {team.length < 12 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add a player by name or phone"
              onPress={() => setAdding(true)}
              style={{ height: 46, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.faint, flexDirection: 'row', alignItems: 'center', gap: 6 }}
            >
              <Icon name="plus" size={14} color={colors.fg} strokeWidth={2.6} />
              <T size={13} w={700}>
                Add
              </T>
            </Pressable>
          ) : null}
        </ScrollView>
      </View>

      {cur ? (
        <View style={{ borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: 10, gap: 8 }}>
          <Row gap={8} style={{ paddingHorizontal: 2 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T size={13} w={700} numberOfLines={1}>
                Number for {short(cur)}
              </T>
              <T size={11} color={colors.muted}>
                {(cur.isGuest ? 'Guest · ' : '') + (curOn ? 'On court' : 'On the bench')}
              </T>
            </View>
            <Pressable accessibilityRole="button" onPress={toggle} style={{ height: 32, paddingHorizontal: 10, borderRadius: 16, backgroundColor: colors.raised, justifyContent: 'center' }}>
              <T size={11} w={800}>
                {curOn ? 'TO BENCH' : 'PUT ON COURT'}
              </T>
            </Pressable>
            <View style={{ minWidth: 52, height: 36, paddingHorizontal: 10, borderRadius: 10, backgroundColor: colors.bbTint, alignItems: 'center', justifyContent: 'center' }}>
              <D size={22} color={colors.tBb}>
                {buf !== '' ? buf : typeof num(cur) === 'number' ? String(num(cur)) : '–'}
              </D>
            </View>
          </Row>
          {warnText ? (
            <T size={12} w={700} color={colors.bad} style={{ paddingHorizontal: 2 }}>
              {warnText}
            </T>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {padKeys.map((k) => (
              <Pressable
                key={k.text}
                accessibilityRole="button"
                accessibilityLabel={k.label}
                onPress={k.press}
                style={{ width: '15.2%', flexGrow: 1, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: k.text === 'OK' && k.on ? colors.primary : colors.raised }}
              >
                <D size={k.size} color={k.text === 'OK' ? (k.on ? colors.onPrimary : colors.faint) : colors.fg}>
                  {k.text}
                </D>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <AddPlayerSheet
        visible={adding}
        side={tab}
        sport={sport.slug}
        sportName={sport.name}
        taken={lineupKeys(lineup)}
        onAdd={(p) => add(tab, p)}
        onClose={() => setAdding(false)}
      />
    </Screen>
  );
}
