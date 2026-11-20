import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/shared/theme';
import { D, Dot, goBack, Icon, IconButton, Row, Screen, T } from '@/shared/ui';
import { baseRuleset, clampMinutes, formatCode, isPreset, pickMode, pickSize, PRESETS, setupRows, type HoopsSetup, type HoopsSize } from '../basketball';
import { useMatchDraft } from '../store/draft.store';
import type { SportSummary } from '../types';

const BLUE = '#3B82F6';

/**
 * A segmented button (the design's `seg`): primary fill when on. `grow` shares out a full-width bar
 * ("Players a side", "Court"); without it the button is as wide as its label. Never grow inside a
 * row that sizes to its content: Android then measures the button at zero width and the row's text
 * vanishes into a tall empty card.
 */
function Seg({ on, label, onPress, width, grow = false, display = false, size = 14, height = 40 }: { on: boolean; label: string; onPress: () => void; width?: number; grow?: boolean; display?: boolean; size?: number; height?: number }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={label}
      onPress={onPress}
      style={{ height, borderRadius: display ? 10 : 9, paddingHorizontal: width ? 0 : 10, width, ...(grow && !width ? { flex: 1 } : {}), alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.primary : 'transparent' }}
    >
      {display ? (
        <D size={20} color={on ? colors.onPrimary : colors.muted}>
          {label}
        </D>
      ) : (
        <T size={size} w={700} color={on ? colors.onPrimary : colors.muted}>
          {label}
        </T>
      )}
    </Pressable>
  );
}

function SettingRow({ title, note, right, last }: { title: string; note?: string; right: ReactNode; last?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 58, paddingHorizontal: 14, gap: 6, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.raised }}>
      <View style={{ flex: 1 }}>
        <T size={15}>{title}</T>
        {note ? (
          <T size={12} color={colors.muted}>
            {note}
          </T>
        ) : null}
      </View>
      {right}
    </View>
  );
}

/**
 * "Basketball · match setup": quick starts (3V3 / 4V4 / 5V5), players a side, court, how the game
 * ends, and the rules that follow from them. `forResult` (from Enter a result) goes on to teams and
 * back instead of to jersey numbers.
 */
export function BasketballSetup({ sport, forResult }: { sport: SportSummary; forResult: boolean }) {
  const { colors } = useTheme();
  const hoops = useMatchDraft((s) => s.hoops);
  const s = hoops.setup;
  const set = (setup: HoopsSetup) => useMatchDraft.getState().setHoops({ setup });
  const rows = setupRows(s);
  const card = (on: boolean) => ({ backgroundColor: on ? colors.bbTint : colors.surface, borderWidth: on ? 2 : 1, borderColor: on ? BLUE : colors.line });

  const next = () => {
    const draft = useMatchDraft.getState();
    const base = baseRuleset(sport, s);
    if (base) draft.setRuleset(base.id);
    draft.setFormat(formatCode(s));
    router.push({ pathname: '/match/teams', params: forResult ? { mode: 'result' } : {} });
  };

  const stepper = (label: string, onPress: () => void, text: string) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.raised, alignItems: 'center', justifyContent: 'center' }}>
      <T size={18} w={700}>
        {text}
      </T>
    </Pressable>
  );

  return (
    <Screen
      gap={18}
      footer={
        <View style={{ gap: 10 }}>
          <View style={{ paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: colors.bbTint }}>
            <T size={14} lh={20} w={700}>
              {rows.summaryTitle}
            </T>
            <T size={14} lh={20} color={colors.soft}>
              {rows.summary}
            </T>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Next: teams" onPress={next} style={{ height: 56, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
            <T size={16} w={800} color={colors.onPrimary}>
              Next: teams
            </T>
          </Pressable>
        </View>
      }
    >
      <Row gap={12}>
        <IconButton icon="back" label="Back" onPress={() => goBack('/match/new')} />
        <Dot color={BLUE} size={10} />
        <D size={28} upper flex numberOfLines={1}>
          {sport.name}
        </D>
      </Row>

      <View style={{ gap: 8 }}>
        <T size={12} w={700} ls={0.08} color={colors.muted}>
          QUICK START
        </T>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {([3, 4, 5] as HoopsSize[]).map((n) => (
            <Pressable
              key={n}
              accessibilityRole="button"
              accessibilityState={{ selected: isPreset(s, n) }}
              accessibilityLabel={`${n} v ${n} quick start`}
              onPress={() => set(PRESETS[n])}
              style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 14, gap: 4, ...card(isPreset(s, n)) }}
            >
              <D size={22}>{`${n}V${n}`}</D>
              <T size={12} lh={16} color={colors.muted}>
                {n === 3 ? 'Half court · first to 21' : n === 4 ? 'Half court · 2 × 10 min' : 'Full court · 4 × 10 min'}
              </T>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1, gap: 6 }}>
          <T size={13} w={600} color={colors.muted}>
            Players a side
          </T>
          <View style={{ flexDirection: 'row', padding: 4, borderRadius: 12, backgroundColor: colors.surface, gap: 4 }}>
            {([3, 4, 5] as HoopsSize[]).map((n) => (
              <Seg key={n} grow on={s.size === n} label={String(n)} size={15} onPress={() => set(pickSize(s, n))} />
            ))}
          </View>
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <T size={13} w={600} color={colors.muted}>
            Court
          </T>
          <View style={{ flexDirection: 'row', padding: 4, borderRadius: 12, backgroundColor: colors.surface, gap: 4 }}>
            <Seg grow on={s.court === 'half'} label="Half" onPress={() => set({ ...s, court: 'half' })} />
            <Seg grow on={s.court === 'full'} label="Full" onPress={() => set({ ...s, court: 'full' })} />
          </View>
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <T size={13} w={600} color={colors.muted}>
          How does the game end?
        </T>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(
            [
              ['score', 'cup', 'First to points', 'Ends when a team reaches the target'],
              ['time', 'clock', 'Timed', 'Highest score when the clock runs out'],
            ] as const
          ).map(([mode, icon, title, note]) => (
            <Pressable
              key={mode}
              accessibilityRole="button"
              accessibilityState={{ selected: s.mode === mode }}
              accessibilityLabel={title}
              onPress={() => set(pickMode(s, mode))}
              style={{ flex: 1, padding: 14, borderRadius: 16, gap: 6, ...card(s.mode === mode) }}
            >
              <Icon name={icon} size={24} color={colors.fg} />
              <T size={15} w={700}>
                {title}
              </T>
              <T size={12} lh={16} color={colors.muted}>
                {note}
              </T>
            </Pressable>
          ))}
        </View>
      </View>

      {s.mode === 'score' ? (
        <View style={{ borderRadius: 16, backgroundColor: colors.surface, overflow: 'hidden' }}>
          <SettingRow
            title="Play to"
            right={
              <Row gap={6}>
                {[11, 15, 21].map((t) => (
                  <Seg key={t} on={s.target === t} label={String(t)} width={48} height={38} display onPress={() => set({ ...s, target: t })} />
                ))}
              </Row>
            }
          />
          <SettingRow title="Time limit" note="If nobody gets there, highest score wins" right={<D size={22}>10:00</D>} />
          <SettingRow
            title="Must win by 2"
            last
            right={
              <T size={14} w={700} color={colors.muted}>
                Off
              </T>
            }
          />
        </View>
      ) : (
        <View style={{ borderRadius: 16, backgroundColor: colors.surface, overflow: 'hidden' }}>
          <SettingRow
            title="Periods"
            right={
              <Row gap={6}>
                <Seg on={s.fmt === 'q'} label="4 quarters" size={13} height={38} onPress={() => set({ ...s, fmt: 'q' })} />
                <Seg on={s.fmt === 'h'} label="2 halves" size={13} height={38} onPress={() => set({ ...s, fmt: 'h' })} />
                <Seg on={s.fmt === 'one'} label="1 game" size={13} height={38} onPress={() => set({ ...s, fmt: 'one' })} />
              </Row>
            }
          />
          <SettingRow
            title="Minutes each"
            right={
              <Row gap={4}>
                {stepper('Fewer minutes', () => set({ ...s, mins: clampMinutes(s.mins - 1) }), '−')}
                <D size={24} center style={{ width: 36 }}>
                  {s.mins}
                </D>
                {stepper('More minutes', () => set({ ...s, mins: clampMinutes(s.mins + 1) }), '+')}
              </Row>
            }
          />
          <SettingRow
            title="Clock stops on whistle"
            note="Off = running clock, faster for pickup"
            right={
              <T size={14} w={700} color={colors.muted}>
                Off
              </T>
            }
          />
          <SettingRow
            title="If tied"
            note="Overtime"
            last
            right={
              <T size={14} w={700}>
                5 min OT
              </T>
            }
          />
        </View>
      )}

      <View style={{ borderRadius: 16, backgroundColor: colors.surface, overflow: 'hidden' }}>
        <SettingRow
          title="Points per basket"
          note={rows.pointsNote}
          right={
            <Row gap={6}>
              <Seg on={s.pts === '12'} label="1 · 2" size={13} height={38} onPress={() => set({ ...s, pts: '12' })} />
              <Seg on={s.pts === '123'} label="1 · 2 · 3" size={13} height={38} onPress={() => set({ ...s, pts: '123' })} />
            </Row>
          }
        />
        <SettingRow
          title="Shot clock"
          right={
            <T size={14} w={700}>
              {rows.shotClock}
            </T>
          }
        />
        <SettingRow
          title="Team foul limit"
          note="After this, every foul gives free throws"
          right={
            <T size={14} w={700}>
              {rows.foulLimit}
            </T>
          }
        />
        <SettingRow
          title="Timeouts per team"
          last
          right={
            <T size={14} w={700}>
              {rows.timeouts}
            </T>
          }
        />
      </View>
    </Screen>
  );
}
