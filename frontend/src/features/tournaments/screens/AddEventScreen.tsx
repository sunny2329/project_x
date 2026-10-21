import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useSports } from '@/features/match/hooks/useSports';
import { rulesetDetail } from '@/features/match/rules';
import type { SportSummary } from '@/features/match/types';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { displayFont, useTheme } from '@/shared/theme';
import { Button, Chip, D, DragList, Field, Group, GroupRow, Icon, Loading, Notice, RadioCard, RadioDot, Row, Screen, Segmented, Sheet, Stepper, T, TextButton, Toggle } from '@/shared/ui';
import { tournamentsApi } from '../api/tournaments.api';
import { DRAW_FORMATS, type DrawFormat, type Tiebreaker } from '../types';

const SCORED = new Set(['rally', 'side_out', 'tennis']);
const TIEBREAKERS: Tiebreaker[] = ['match_wins', 'head_to_head', 'major_diff', 'minor_diff'];

function tiebreakLabel(t: Tiebreaker, sets: boolean): string {
  return {
    match_wins: 'Matches won',
    head_to_head: 'Head to head',
    major_diff: sets ? 'Sets won minus lost' : 'Games won minus lost',
    minor_diff: sets ? 'Games won minus lost' : 'Points won minus lost',
    major_won: sets ? 'Sets won' : 'Games won',
    minor_won: sets ? 'Games won' : 'Points won',
  }[t];
}

/** Numbers in a ruleset an organizer may change ("points to win, cap…"). */
const EDITABLE: Record<string, { key: string; label: string; min: number; max: number; odd?: boolean }[]> = {
  rally: [
    { key: 'pointsToWin', label: 'Points to win', min: 5, max: 50 },
    { key: 'winBy', label: 'Win by', min: 1, max: 5 },
    { key: 'cap', label: 'Cap', min: 5, max: 60 },
    { key: 'bestOf', label: 'Best of', min: 1, max: 7, odd: true },
  ],
  side_out: [
    { key: 'pointsToWin', label: 'Points to win', min: 5, max: 30 },
    { key: 'winBy', label: 'Win by', min: 1, max: 5 },
    { key: 'bestOf', label: 'Best of', min: 1, max: 5, odd: true },
  ],
  tennis: [
    { key: 'bestOf', label: 'Best of (sets)', min: 1, max: 5, odd: true },
    { key: 'setGames', label: 'Games per set', min: 1, max: 8 },
    { key: 'tiebreakAt', label: 'Tiebreak at', min: 1, max: 8 },
    { key: 'tiebreakPoints', label: 'Tiebreak to', min: 5, max: 15 },
  ],
};

/** Add an event: sport, format, ruleset (optionally changed), draw format and its settings, tiebreak order, max entries. */
export default function AddEventScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { sports: all } = useSports();
  const sports = useMemo(() => (all ?? []).filter((s) => s.rulesets.some((r) => SCORED.has(r.scoringModel))), [all]);
  // Unset = the sport's defaults (first sport, doubles if it has it, its default rules).
  const [sportId, setSportId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [pickedFormat, setFormatCode] = useState<string | null>(null);
  const [pickedRuleset, setRulesetId] = useState<string | null>(null);
  const [override, setOverride] = useState<Record<string, number>>({});
  const [maxEntries, setMaxEntries] = useState('16');
  const [draw, setDraw] = useState<DrawFormat>('knockout');
  const [groupCount, setGroupCount] = useState(4);
  const [qualifiers, setQualifiers] = useState(2);
  const [legs, setLegs] = useState<'1' | '2'>('1');
  const [thirdPlace, setThirdPlace] = useState(false);
  const [tiebreakers, setTiebreakers] = useState<Tiebreaker[]>(TIEBREAKERS);
  const [pickingRules, setPickingRules] = useState(false);
  const [editingRules, setEditingRules] = useState(false);
  const { submit, submitting, formError, serverFieldErrors } = useSubmit();

  const sport: SportSummary | null = sports.find((s) => s.id === sportId) ?? sports[0] ?? null;
  const formatCode = pickedFormat ?? (sport?.formats.find((f) => f.code === 'doubles') ?? sport?.formats[0])?.code ?? null;
  const rulesetId = pickedRuleset ?? (sport?.rulesets.find((r) => r.isDefault) ?? sport?.rulesets[0])?.id ?? null;

  const choose = (s: SportSummary) => {
    setSportId(s.id);
    setFormatCode(null);
    setRulesetId(null);
    setOverride({});
  };

  if (!all) return <Loading />;
  const ruleset = sport?.rulesets.find((r) => r.id === rulesetId) ?? null;
  const sets = ruleset?.scoringModel === 'tennis';
  const editable = ruleset ? (EDITABLE[ruleset.scoringModel] ?? []) : [];
  const config = { ...(ruleset?.config ?? {}), ...override } as Record<string, unknown>;
  const minEntries = draw === 'knockout' ? 2 : draw === 'round_robin' ? 3 : groupCount * Math.max(2, qualifiers + 1);
  const drawConfig = draw === 'knockout' ? { thirdPlaceMatch: thirdPlace } : draw === 'round_robin' ? { legs: Number(legs) } : { groupCount, qualifiersPerGroup: qualifiers, thirdPlaceMatch: thirdPlace, legs: Number(legs) };
  const max = Number(maxEntries) || undefined;
  const ok = !!sport && !!formatCode && name.trim().length >= 2 && (!max || max >= minEntries);

  const save = () =>
    void submit(async () => {
      if (!sport || !formatCode) return;
      await tournamentsApi.addEvent(id, {
        name: name.trim(),
        sport: sport.slug,
        format: formatCode,
        ...(rulesetId ? { rulesetId } : {}),
        drawFormat: draw,
        drawConfig,
        tiebreakers,
        ...(Object.keys(override).length ? { rulesOverride: override } : {}),
        ...(max ? { maxEntries: max } : {}),
      });
      router.back();
    });

  const stepperRow = (label: string, value: number, set: (v: number) => void, min: number, maxV: number, last = false) => (
    <GroupRow minHeight={56} last={last}>
      <T size={15} flex>
        {label}
      </T>
      <Stepper value={value} onChange={set} min={min} max={maxV} label={label.toLowerCase()} />
    </GroupRow>
  );

  return (
    <Screen gap={18}>
      <Row between>
        <TextButton label="Cancel" size={16} weight={600} color={colors.muted} onPress={() => router.back()} />
        <T size={17} w={700}>
          Add event
        </T>
        <Button label="Save" height={40} radius={12} size={15} weight={700} inline px={18} disabled={!ok} loading={submitting} onPress={save} />
      </Row>

      <Field label="Event name" value={name} onChangeText={setName} placeholder={`Men’s ${formatCode === 'singles' ? 'Singles' : 'Doubles'}`} height={52} maxLength={80} error={serverFieldErrors.name} />

      <View style={{ gap: 8 }}>
        <T size={13} w={600} color={colors.muted}>
          Sport
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {sports.map((s) => (
            <Chip key={s.id} label={s.name} dot={s.accentColor} active={s.id === sport?.id} activeColor={s.accentColor} height={38} onPress={() => choose(s)} />
          ))}
        </View>
      </View>

      <Row gap={10} style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: 6 }}>
          <T size={13} w={600} color={colors.muted}>
            Format
          </T>
          {sport && sport.formats.length > 1 ? (
            <Segmented options={sport.formats.map((f) => ({ value: f.code, label: f.name }))} value={formatCode ?? ''} onChange={setFormatCode} height={40} radius={12} size={14} />
          ) : (
            <View style={{ height: 48, borderRadius: 12, backgroundColor: colors.surface, justifyContent: 'center', paddingHorizontal: 14 }}>
              <T size={14} w={600}>
                {sport?.formats[0]?.name ?? '—'}
              </T>
            </View>
          )}
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <T size={13} w={600} color={colors.muted}>
            Max entries
          </T>
          <TextInput
            value={maxEntries}
            onChangeText={(v) => setMaxEntries(v.replace(/\D/g, '').slice(0, 3))}
            keyboardType="number-pad"
            accessibilityLabel="Max entries"
            placeholder="No limit"
            placeholderTextColor={colors.faint}
            style={{ height: 48, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, color: colors.fg, fontFamily: displayFont(900), fontSize: 24 }}
          />
        </View>
      </Row>

      <View style={{ gap: 6 }}>
        <T size={13} w={600} color={colors.muted}>
          Rules
        </T>
        <Pressable accessibilityRole="button" accessibilityLabel="Rules" onPress={() => setPickingRules(true)} style={{ flexDirection: 'row', alignItems: 'center', height: 52, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14 }}>
          <T size={16} w={600} flex numberOfLines={1}>
            {ruleset?.name ?? 'Pick the rules'}
            {Object.keys(override).length ? ' · changed' : ''}
          </T>
          <Icon name="chevronDown" size={20} color={colors.muted} />
        </Pressable>
        {editable.length ? <TextButton label="Change a rule (points to win, cap…)" size={13} color={colors.soft} onPress={() => setEditingRules(true)} /> : null}
      </View>

      <View style={{ gap: 8 }}>
        <T size={13} w={600} color={colors.muted}>
          Draw format
        </T>
        <Row gap={8} style={{ alignItems: 'stretch' }}>
          {DRAW_FORMATS.map((f) => {
            const on = f.value === draw;
            return (
              <Pressable
                key={f.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={f.label}
                onPress={() => setDraw(f.value)}
                style={{ flex: 1, gap: 6, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 14, backgroundColor: on ? colors.accentTint : colors.surface, borderWidth: on ? 1.5 : 1, borderColor: on ? colors.primary : colors.line }}
              >
                <RadioDot on={on} />
                <T size={13} w={on ? 700 : 600}>
                  {f.label}
                </T>
              </Pressable>
            );
          })}
        </Row>
        <Group>
          {draw === 'groups_knockout' ? (
            <>
              {stepperRow('Groups', groupCount, setGroupCount, 1, 16)}
              {stepperRow('Go through per group', qualifiers, setQualifiers, 1, 4)}
            </>
          ) : null}
          {draw !== 'knockout' ? (
            <GroupRow minHeight={56}>
              <T size={15} flex>
                {draw === 'round_robin' ? 'Each pair plays' : 'Group games'}
              </T>
              <Segmented
                options={[
                  { value: '1', label: 'Once' },
                  { value: '2', label: 'Home & away' },
                ]}
                value={legs}
                onChange={setLegs}
                height={32}
                radius={10}
                size={13}
                tray={colors.bg}
                style={{ width: 190 }}
              />
            </GroupRow>
          ) : null}
          {draw !== 'round_robin' ? (
            <GroupRow minHeight={56} last>
              <T size={15} flex>
                3rd-place match
              </T>
              <Toggle label="3rd-place match" value={thirdPlace} onChange={setThirdPlace} />
            </GroupRow>
          ) : null}
        </Group>
        <T size={13} color={max && max < minEntries ? colors.bad : colors.muted}>
          Needs at least {minEntries} entries.
          {draw === 'groups_knockout' ? ' Group winners meet runners-up from other groups.' : draw === 'knockout' ? ' Top seeds get byes when the draw isn’t full.' : ' Everyone plays everyone.'}
        </T>
      </View>

      {draw !== 'knockout' ? (
        <View style={{ gap: 8 }}>
          <T size={13} w={600} color={colors.muted}>
            Tiebreakers, in order
          </T>
          <DragList
            items={tiebreakers}
            keyOf={(t) => t}
            onChange={setTiebreakers}
            render={(t, i) => (
              <>
                <D size={18} color={colors.primary} style={{ width: 18 }}>
                  {i + 1}
                </D>
                <T size={15} flex>
                  {tiebreakLabel(t, sets)}
                </T>
              </>
            )}
          />
          <T size={13} color={colors.muted}>
            Drag to reorder. Anyone still level is split by seed.
          </T>
        </View>
      ) : null}

      {formError ? <Notice tone="error" icon="alert" text={formError} /> : null}
      <Button label="Save event" weight={800} disabled={!ok} loading={submitting} onPress={save} style={{ marginTop: 'auto' }} />

      <Sheet visible={pickingRules} onClose={() => setPickingRules(false)} scroll>
        <T size={18} w={700}>
          Rules
        </T>
        {sport?.rulesets.map((r) => (
          <RadioCard
            key={r.id}
            title={r.name}
            subtitle={rulesetDetail(r)}
            selected={r.id === rulesetId}
            color={sport.accentColor}
            background={colors.bg}
            onPress={() => {
              setRulesetId(r.id);
              setOverride({});
              setPickingRules(false);
            }}
          />
        ))}
      </Sheet>

      <Sheet visible={editingRules} onClose={() => setEditingRules(false)}>
        <T size={18} w={700}>
          Change a rule
        </T>
        <T size={13} color={colors.muted}>
          Starts from {ruleset?.name}. Only what you change is saved with this event.
        </T>
        <View style={{ borderRadius: 16, backgroundColor: colors.bg, overflow: 'hidden' }}>
          {editable.map((e, i) => {
            const raw = config[e.key];
            // No cap set yet: start from points-to-win + 9 (21 -> 30, as in badminton).
            const value = typeof raw === 'number' ? raw : e.key === 'cap' ? Number(config.pointsToWin ?? 21) + 9 : e.min;
            return (
              <GroupRow key={e.key} minHeight={56} last={i === editable.length - 1} style={{ backgroundColor: colors.bg }}>
                <T size={15} flex>
                  {e.label}
                </T>
                <Stepper
                  value={value}
                  min={e.min}
                  max={e.max}
                  label={e.label.toLowerCase()}
                  onChange={(v) => {
                    // Best of stays odd: step by two.
                    const next = e.odd ? (v > value ? Math.min(e.max, value + 2) : Math.max(e.min, value - 2)) : v;
                    setOverride((o) => ({ ...o, [e.key]: next }));
                  }}
                />
              </GroupRow>
            );
          })}
        </View>
        <Row gap={10}>
          <Button label="Reset" variant="raised" height={50} style={{ flex: 1 }} onPress={() => setOverride({})} />
          <Button label="Done" height={50} style={{ flex: 1 }} onPress={() => setEditingRules(false)} />
        </Row>
      </Sheet>
    </Screen>
  );
}
