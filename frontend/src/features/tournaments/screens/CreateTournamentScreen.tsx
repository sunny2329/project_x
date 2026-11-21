import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSports } from '@/features/match/hooks/useSports';
import type { SportSummary } from '@/features/match/types';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { useTheme } from '@/shared/theme';
import { Button, D, DatePicker, Field, Header, Icon, Loading, Notice, RadioCard, Row, Screen, Sheet, Stepper, T, Tap, TextButton } from '@/shared/ui';
import { toDay, weekdayDayMonth } from '@/shared/utils/format';
import { tournamentsApi } from '../api/tournaments.api';
import { categoryMeta, categoryOptions, drawInfo, groupCountFor, multiSummary } from '../setup';
import type { DrawFormat, Visibility } from '../types';

/** Sports a tournament can run (scored by the app, not free-form). */
const SCORED = new Set(['rally', 'side_out', 'tennis', 'overs', 'baskets']);

const FORMATS: { id: DrawFormat; title: string; sub: string; icon: string }[] = [
  { id: 'knockout', title: 'Knockout', sub: 'Lose once and you are out', icon: 'M2 4h8v8H2M2 16h8v8H2M10 8h8v12h-8M18 14h10M30 14h8' },
  { id: 'round_robin', title: 'Round robin', sub: 'Everyone plays everyone', icon: 'M8 4h24v20H8zM8 11h24M8 17h24M16 4v20M24 4v20' },
  { id: 'groups_knockout', title: 'Groups → Knockout', sub: 'Group stage, top 2 advance', icon: 'M2 4h10v8H2zM2 16h10v8H2zM12 8h8M12 20h8M20 8v12M20 14h10M30 10h8v8h-8z' },
];

const VISIBILITY: { value: Visibility; title: string; subtitle: string }[] = [
  { value: 'public', title: 'Public', subtitle: 'Listed in Events, anyone can register' },
  { value: 'unlisted', title: 'Unlisted', subtitle: 'Only people with the link' },
  { value: 'private', title: 'Private', subtitle: 'Only staff and players you add' },
];

interface Category {
  key: number;
  sport: SportSummary;
  name: string;
  format: string;
  draw: DrawFormat;
  entries: number;
}

function nextSaturday(): Date {
  const d = new Date();
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
  return d;
}

const defaultRules = (s: SportSummary) => s.rulesets.find((r) => r.isDefault) ?? s.rulesets[0] ?? null;
const perSide = (s: SportSummary, format: string) => s.formats.find((f) => f.code === format)?.playersPerSide ?? 1;

/** A grey select box ("Badminton ⌄"). */
function SelectBox({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <T size={13} w={700}>
        {label}
      </T>
      <Tap label={`${label}: ${value}`} onPress={onPress} style={{ height: 48, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <T size={15} flex numberOfLines={1}>
          {value}
        </T>
        <Icon name="chevronDown" size={16} color={colors.muted} />
      </Tap>
    </View>
  );
}

/** A picker sheet: a list of radio rows. */
function PickSheet<T extends string>({ visible, title, options, value, onPick, onClose }: { visible: boolean; title: string; options: { value: T; label: string }[]; value: T | null; onPick: (v: T) => void; onClose: () => void }) {
  return (
    <Sheet visible={visible} onClose={onClose} scroll>
      <D size={24}>{title}</D>
      <View style={{ gap: 8 }}>
        {options.map((o) => (
          <RadioCard
            key={o.value}
            title={o.label}
            selected={o.value === value}
            onPress={() => {
              onPick(o.value);
              onClose();
            }}
          />
        ))}
      </View>
    </Sheet>
  );
}

function FormatCards({ value, onChange }: { value: DrawFormat; onChange: (f: DrawFormat) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      {FORMATS.map((f) => {
        const on = f.id === value;
        const fg = on ? colors.onPrimary : colors.fg;
        return (
          <Pressable
            key={f.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${f.title}, ${f.sub}`}
            onPress={() => onChange(f.id)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 58, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 14, backgroundColor: on ? colors.primary : colors.card, borderWidth: 1, borderColor: on ? colors.primary : colors.line }}
          >
            <Svg width={40} height={28} viewBox="0 0 40 28" fill="none" stroke={fg} strokeWidth={1.8} strokeLinecap="round">
              <Path d={f.icon} />
            </Svg>
            <View style={{ flex: 1 }}>
              <T size={15} w={700} color={fg}>
                {f.title}
              </T>
              <T size={12} color={on ? colors.onPrimary : colors.muted}>
                {f.sub}
              </T>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function EntriesCard({ value, onChange, info }: { value: number; onChange: (n: number) => void; info: string }) {
  const { colors } = useTheme();
  return (
    <Row gap={12} style={{ padding: 14, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
      <View style={{ flex: 1 }}>
        <T size={15} w={700}>
          Entries
        </T>
        <T size={12} color={colors.muted}>
          {info}
        </T>
      </View>
      <Stepper value={value} onChange={onChange} min={2} max={128} label="entries" />
    </Row>
  );
}

function SoftChip({ label, onPress }: { label: string; onPress?: () => void }) {
  const { colors } = useTheme();
  const body = (
    <T size={13} w={600} color={colors.accentText}>
      {label}
    </T>
  );
  const style = { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 99, backgroundColor: colors.accentSoft };
  return onPress ? (
    <Tap label={label} onPress={onPress} style={style}>
      {body}
    </Tap>
  ) : (
    <View style={style}>{body}</View>
  );
}

/**
 * Create a tournament (design v2 "Create tournament" and "Multi-sport categories"): name, then one
 * category (single sport) or a list of categories across sports (multi-sport). Creating opens entries.
 */
export default function CreateTournamentScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ multi?: string }>();
  const { sports: all } = useSports();
  const sports = useMemo(() => (all ?? []).filter((s) => s.rulesets.some((r) => SCORED.has(r.scoringModel))), [all]);
  const [multi, setMulti] = useState(params.multi === '1');
  const [name, setName] = useState('');
  const [date, setDate] = useState(nextSaturday);
  const [venue, setVenue] = useState('');
  const [fee, setFee] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('public');
  // Single sport: one category being set up.
  const [sportId, setSportId] = useState<string | null>(null);
  const [catName, setCatName] = useState<string | null>(null);
  const [draw, setDraw] = useState<DrawFormat>('knockout');
  const [entries, setEntries] = useState(16);
  // Multi-sport: the list, the sport the Add button adds for, and the category being edited.
  const [cats, setCats] = useState<Category[]>([]);
  const [addSport, setAddSport] = useState<string | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [sheet, setSheet] = useState<'sport' | 'category' | 'details' | 'date' | null>(null);
  const { submit, submitting, formError, serverFieldErrors } = useSubmit();

  if (!all) return <Loading />;

  const sport = sports.find((s) => s.id === sportId) ?? sports[0] ?? null;
  const options = sport ? categoryOptions(sport.formats) : [];
  const category = options.find((o) => o.name === catName) ?? options[0] ?? null;
  const rules = sport ? defaultRules(sport) : null;

  const adder = sports.find((s) => s.id === addSport) ?? sports[0] ?? null;
  const nextFor = (s: SportSummary) => {
    const used = new Set(cats.filter((c) => c.sport.id === s.id).map((c) => c.name));
    return categoryOptions(s.formats).find((o) => !used.has(o.name)) ?? null;
  };
  const adderNext = adder ? nextFor(adder) : null;
  const edit = cats.find((c) => c.key === editing) ?? null;
  const patch = (key: number, p: Partial<Category>) => setCats((list) => list.map((c) => (c.key === key ? { ...c, ...p } : c)));

  const plan: Omit<Category, 'key'>[] = multi ? cats : sport && category ? [{ sport, name: category.name, format: category.format, draw, entries }] : [];
  const ok = name.trim().length >= 3 && plan.length > 0 && plan.every((c) => c.entries >= (c.draw === 'round_robin' ? 3 : c.draw === 'groups_knockout' ? 4 : 2));

  const create = () =>
    void submit(async () => {
      const { tournament } = await tournamentsApi.create({
        name: name.trim(),
        startsOn: toDay(date),
        endsOn: toDay(date),
        visibility,
        ...(venue.trim() ? { venueName: venue.trim() } : {}),
        ...(fee.trim() ? { entryFee: fee.trim() } : {}),
      });
      for (const c of plan) {
        const r = defaultRules(c.sport);
        const { event } = await tournamentsApi.addEvent(tournament.id, {
          name: c.name,
          sport: c.sport.slug,
          format: c.format,
          ...(r ? { rulesetId: r.id } : {}),
          drawFormat: c.draw,
          drawConfig: c.draw === 'knockout' ? { thirdPlaceMatch: false } : c.draw === 'round_robin' ? { legs: 1 } : { groupCount: groupCountFor(c.entries), qualifiersPerGroup: 2, thirdPlaceMatch: false, legs: 1 },
          maxEntries: c.entries,
        });
        await tournamentsApi.updateEvent(event.id, { status: 'registration_open' });
      }
      await tournamentsApi.update(tournament.id, { status: 'registration_open' });
      router.replace({ pathname: '/tournament/[id]/manage', params: { id: tournament.id } });
    });

  const details = `${weekdayDayMonth(date)}${venue.trim() ? ` · ${venue.trim()}` : ''} · ${VISIBILITY.find((v) => v.value === visibility)!.title}`;

  return (
    <Screen
      gap={16}
      footer={
        <View style={{ gap: 10 }}>
          {formError ? <Notice tone="error" icon="alert" text={formError} /> : null}
          <Button label={multi ? 'Create event & open entries' : 'Create & open entries'} weight={700} disabled={!ok} loading={submitting} onPress={create} />
          <TextButton
            label={multi ? 'Just one sport? Set up a single category' : 'Running several sports? Make it multi-sport'}
            size={14}
            color={colors.accentText}
            style={{ alignSelf: 'center' }}
            onPress={() => {
              if (!multi && sport && category && !cats.length) setCats([{ key: 1, sport, name: category.name, format: category.format, draw, entries }]);
              setMulti((m) => !m);
            }}
          />
        </View>
      }
    >
      <Header kicker={`New tournament · ${multi ? 'Multi-sport' : 'Single sport'}`} />

      {multi ? (
        <View style={{ gap: 2 }}>
          <D size={32} lh={34} accessibilityRole="header" numberOfLines={2}>
            {name.trim() || 'Name your event'}
          </D>
          <T size={13} color={colors.muted}>
            {multiSummary(cats.map((c) => ({ sport: c.sport.id })))} · {weekdayDayMonth(date)}
          </T>
        </View>
      ) : (
        <D size={34} lh={36} accessibilityRole="header">
          Set up your event
        </D>
      )}

      <Field label="Tournament name" value={name} onChangeText={setName} placeholder={multi ? 'Corporate Sports Day' : 'Jaipur Smash Open'} height={52} maxLength={120} error={serverFieldErrors.name} />

      {!multi && sport && category ? (
        <>
          <Row gap={10} style={{ alignItems: 'flex-start' }}>
            <SelectBox label="Sport" value={sport.name} onPress={() => setSheet('sport')} />
            <SelectBox label="Category" value={category.name} onPress={() => setSheet('category')} />
          </Row>
          <View style={{ gap: 8 }}>
            <T size={13} w={700}>
              Format
            </T>
            <FormatCards value={draw} onChange={setDraw} />
          </View>
          <EntriesCard value={entries} onChange={setEntries} info={drawInfo(draw, entries)} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <SoftChip label="Seeded by rating" />
            {rules ? <SoftChip label={rules.name} /> : null}
            <SoftChip label={details} onPress={() => setSheet('details')} />
          </View>
          <PickSheet visible={sheet === 'sport'} title="Sport" options={sports.map((s) => ({ value: s.id, label: s.name }))} value={sport.id} onPick={(v) => (setSportId(v), setCatName(null))} onClose={() => setSheet(null)} />
          <PickSheet visible={sheet === 'category'} title="Category" options={options.map((o) => ({ value: o.name, label: o.name }))} value={category.name} onPick={setCatName} onClose={() => setSheet(null)} />
        </>
      ) : null}

      {multi ? (
        <>
          <View style={{ flexDirection: 'row' }}>
            <SoftChip label={details} onPress={() => setSheet('details')} />
          </View>
          <View style={{ gap: 8 }}>
            <T size={13} w={700}>
              Add a category
            </T>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {sports.map((s) => {
                const on = s.id === adder?.id;
                return (
                  <Pressable key={s.id} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => setAddSport(s.id)} style={{ height: 40, paddingHorizontal: 14, borderRadius: 20, justifyContent: 'center', backgroundColor: on ? colors.fg : colors.card, borderWidth: 1, borderColor: on ? colors.fg : colors.line }}>
                    <T size={14} w={700} color={on ? colors.bg : colors.fg}>
                      {s.name}
                    </T>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Tap
              label={adderNext ? `Add ${adder!.name} · ${adderNext.name}` : `Every ${adder?.name ?? ''} category added`}
              disabled={!adderNext}
              onPress={() => adder && adderNext && setCats((list) => [...list, { key: (list.at(-1)?.key ?? 0) + 1, sport: adder, name: adderNext.name, format: adderNext.format, draw: 'knockout', entries: 16 }])}
              style={{ height: 52, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.primary, backgroundColor: colors.accentSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: adderNext ? 1 : 0.5 }}
            >
              <Icon name="plus" size={18} color={colors.accentText} />
              <T size={15} w={700} color={colors.accentText}>
                {adderNext ? `Add ${adder!.name} · ${adderNext.name}` : `Every ${adder?.name ?? ''} category added`}
              </T>
            </Tap>
          </View>

          {sports
            .filter((s) => cats.some((c) => c.sport.id === s.id))
            .map((s) => {
              const mine = cats.filter((c) => c.sport.id === s.id);
              return (
                <View key={s.id} style={{ gap: 8 }}>
                  <Row between>
                    <D size={20}>{s.name}</D>
                    <T size={12} color={colors.muted}>
                      {mine.length} {mine.length === 1 ? 'category' : 'categories'}
                    </T>
                  </Row>
                  {mine.map((c) => (
                    <Tap key={c.key} label={`Edit ${c.name}`} onPress={() => setEditing(c.key)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line }}>
                      <View style={{ flex: 1 }}>
                        <T size={15} w={700}>
                          {c.name}
                        </T>
                        <T size={12} color={colors.muted}>
                          {categoryMeta({ drawFormat: c.draw, maxEntries: c.entries, playersPerSide: perSide(c.sport, c.format), rules: defaultRules(c.sport)?.name })}
                        </T>
                      </View>
                      <Tap label={`Remove ${c.name}`} onPress={() => setCats((list) => list.filter((x) => x.key !== c.key))} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="close" size={18} color={colors.muted} />
                      </Tap>
                    </Tap>
                  ))}
                </View>
              );
            })}

          <Sheet visible={!!edit} onClose={() => setEditing(null)} scroll>
            {edit ? (
              <>
                <D size={24}>
                  {edit.sport.name} · {edit.name}
                </D>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {categoryOptions(edit.sport.formats)
                    .filter((o) => o.name === edit.name || !cats.some((c) => c.sport.id === edit.sport.id && c.name === o.name))
                    .map((o) => (
                      <Pressable key={o.name} accessibilityRole="radio" accessibilityState={{ selected: o.name === edit.name }} onPress={() => patch(edit.key, { name: o.name, format: o.format })} style={{ height: 38, paddingHorizontal: 12, borderRadius: 19, justifyContent: 'center', backgroundColor: o.name === edit.name ? colors.primary : colors.card, borderWidth: 1, borderColor: o.name === edit.name ? colors.primary : colors.line }}>
                        <T size={13} w={700} color={o.name === edit.name ? colors.onPrimary : colors.fg}>
                          {o.name}
                        </T>
                      </Pressable>
                    ))}
                </View>
                <FormatCards value={edit.draw} onChange={(d) => patch(edit.key, { draw: d })} />
                <EntriesCard value={edit.entries} onChange={(n) => patch(edit.key, { entries: n })} info={drawInfo(edit.draw, edit.entries)} />
                <Button label="Done" height={50} radius={14} onPress={() => setEditing(null)} />
              </>
            ) : null}
          </Sheet>
        </>
      ) : null}

      <Sheet visible={sheet === 'details'} onClose={() => setSheet(null)} scroll>
        <D size={24}>When and where</D>
        <View style={{ gap: 6 }}>
          <T size={13} w={700}>
            Date
          </T>
          <Tap label="Date" onPress={() => setSheet('date')} style={{ height: 52, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, justifyContent: 'center' }}>
            <T size={16} w={600}>
              {weekdayDayMonth(date)}
            </T>
          </Tap>
        </View>
        <Field label="Venue (optional)" value={venue} onChangeText={setVenue} height={52} size={16} maxLength={120} error={serverFieldErrors.venueName} />
        <Field label="Entry fee per player (optional)" value={fee} onChangeText={setFee} placeholder="Free" height={52} size={16} maxLength={40} />
        <View style={{ gap: 8 }}>
          <T size={13} w={700}>
            Who can find it
          </T>
          {VISIBILITY.map((v) => (
            <RadioCard key={v.value} title={v.title} subtitle={v.subtitle} selected={visibility === v.value} onPress={() => setVisibility(v.value)} />
          ))}
        </View>
        <Button label="Done" height={50} radius={14} onPress={() => setSheet(null)} />
      </Sheet>
      {sheet === 'date' ? (
        <DatePicker
          value={date}
          mode="date"
          minimumDate={new Date()}
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(_, d) => {
            setSheet('details');
            if (d) setDate(d);
          }}
        />
      ) : null}
    </Screen>
  );
}
