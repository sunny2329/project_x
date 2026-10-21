import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { matchApi } from '@/features/match/api/match.api';
import { PlayerSearch } from '@/features/match/components/PlayerSearch';
import { SportGrid } from '@/features/match/components/SportGrid';
import { sportIcon } from '@/features/match/format';
import type { SportSummary } from '@/features/match/types';
import { Card, ChoiceChips, FormMessage, OutlineButton, PrimaryButton, Screen, SectionHeader, TextField, TextLink, TopBar } from '@/shared/components';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { spacing, typography, useTheme } from '@/shared/theme';
import { publicTournamentUrl, tournamentsApi } from '../api/tournaments.api';
import { DRAW_FORMATS, statusText, type Tournament } from '../types';

type Panel = 'event' | 'court' | 'staff' | null;

/** A tournament: its categories, and for organizers courts, staff and a new-category form. */
export default function TournamentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const load = useSubmit();
  const submitLoad = load.submit;
  const action = useSubmit();

  const refresh = useCallback(() => {
    void submitLoad(async () => setTournament((await tournamentsApi.get(id)).tournament));
  }, [submitLoad, id]);
  useFocusEffect(refresh);

  if (!tournament) {
    return (
      <Screen header={<TopBar title="Tournament" />}>
        <View style={styles.top}>
          <FormMessage message={load.formError} />
        </View>
      </Screen>
    );
  }
  const t = tournament;

  async function run(work: () => Promise<{ tournament: Tournament }>) {
    let next: Tournament | null = null;
    const ok = await action.submit(async () => {
      next = (await work()).tournament;
    });
    if (ok && next) {
      setTournament(next);
      setPanel(null);
    }
  }

  return (
    <Screen header={<TopBar title={t.name} />} onRefresh={refresh} refreshing={load.submitting}>
      <View style={styles.top} />
      <Text style={[typography.caption, styles.meta, { color: colors.textMuted }]}>
        {[statusText(t.status), t.startsOn, t.venue?.name].filter(Boolean).join(' · ')}
      </Text>
      <View style={[styles.row, styles.section]}>
        <View style={styles.flex}>
          <OutlineButton title="Share public page" onPress={() => void Share.share({ message: `${t.name}\n${publicTournamentUrl(t.slug)}` })} />
        </View>
        {t.isOrganizer && t.status === 'draft' ? (
          <View style={styles.flex}>
            <OutlineButton title="Open registration" onPress={() => void run(() => tournamentsApi.update(t.id, { status: 'registration_open' }))} />
          </View>
        ) : null}
      </View>
      <FormMessage message={action.formError ?? Object.values(action.serverFieldErrors)[0] ?? null} />

      <View style={styles.section}>
        <SectionHeader title="Categories" action={t.isOrganizer ? { label: panel === 'event' ? 'Cancel' : 'Add', onPress: () => setPanel(panel === 'event' ? null : 'event') } : undefined} />
        {panel === 'event' ? <NewEventForm tournamentId={t.id} onCreated={refresh} onDone={() => setPanel(null)} /> : null}
        <View style={styles.list}>
          {t.events.map((e) => (
            <Pressable
              key={e.id}
              onPress={() => router.push({ pathname: '/tournaments/event/[id]', params: { id: e.id } })}
              accessibilityRole="button"
              style={({ pressed }) => [styles.item, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder, opacity: pressed ? 0.85 : 1 }]}
            >
              <MaterialCommunityIcons name={sportIcon(e.sport)} size={22} color={e.sport.accentColor} />
              <View style={styles.flex}>
                <Text style={[styles.itemTitle, { color: colors.text }]}>{e.name}</Text>
                <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
                  {[e.sport.name, e.format.name, DRAW_FORMATS.find((f) => f.value === e.drawFormat)?.label, `${e.approvedEntries} entries`, statusText(e.status)].join(' · ')}
                </Text>
              </View>
            </Pressable>
          ))}
          {!t.events.length ? <Text style={[typography.caption, { color: colors.textMuted }]}>No categories yet.</Text> : null}
        </View>
      </View>

      {t.isOrganizer ? (
        <>
          <View style={styles.section}>
            <SectionHeader title="Courts" action={{ label: panel === 'court' ? 'Cancel' : 'Add', onPress: () => setPanel(panel === 'court' ? null : 'court') }} />
            {panel === 'court' ? <NameForm placeholder="Court name, e.g. Court 2" busy={action.submitting} onSave={(name) => void run(() => tournamentsApi.addCourt(t.id, name))} /> : null}
            <Card style={styles.list}>
              {t.courts.length ? (
                t.courts.map((c) => (
                  <View key={c.id} style={styles.row}>
                    <Text style={[typography.body, styles.flex, { color: colors.text }]}>{c.name}</Text>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>
                      {c.scorerUserIds.length ? `${c.scorerUserIds.length} scorer${c.scorerUserIds.length > 1 ? 's' : ''}` : 'No scorer'}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={[typography.caption, { color: colors.textMuted }]}>Add courts to schedule fixtures and assign a scorer per court.</Text>
              )}
            </Card>
          </View>

          <View style={styles.section}>
            <SectionHeader title="Staff" action={{ label: panel === 'staff' ? 'Cancel' : 'Add', onPress: () => setPanel(panel === 'staff' ? null : 'staff') }} />
            {panel === 'staff' ? <StaffForm tournament={t} busy={action.submitting} onAdd={(userId, role, courtId) => void run(() => (courtId ? tournamentsApi.assignCourtScorer(courtId, userId) : tournamentsApi.addStaff(t.id, userId, role)))} /> : null}
            <Card style={styles.list}>
              {t.staff.map((s) => (
                <View key={`${s.userId}-${s.role}`} style={styles.row}>
                  <Text style={[typography.body, styles.flex, { color: colors.text }]}>{s.name ?? 'User'}</Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>{statusText(s.role)}</Text>
                </View>
              ))}
            </Card>
          </View>
        </>
      ) : null}
    </Screen>
  );
}

function NameForm({ placeholder, busy, onSave }: { placeholder: string; busy: boolean; onSave: (name: string) => void }) {
  const [name, setName] = useState('');
  return (
    <Card style={styles.form}>
      <TextField placeholder={placeholder} value={name} onChangeText={setName} maxLength={60} autoFocus />
      <PrimaryButton title="Save" onPress={() => onSave(name.trim())} loading={busy} disabled={!name.trim()} showChevron={false} />
    </Card>
  );
}

/** Add a co-organizer or referee to the tournament, or a scorer for one court. */
function StaffForm({ tournament, busy, onAdd }: { tournament: Tournament; busy: boolean; onAdd: (userId: string, role: 'co_organizer' | 'scorer' | 'referee', courtId: string | null) => void }) {
  const { colors } = useTheme();
  const [role, setRole] = useState<'co_organizer' | 'scorer' | 'referee'>('scorer');
  const [courtId, setCourtId] = useState<string | null>(null);
  return (
    <Card style={styles.form}>
      <ChoiceChips
        accessibilityLabel="Role"
        options={[
          { label: 'Scorer', value: 'scorer' },
          { label: 'Referee', value: 'referee' },
          { label: 'Co-organizer', value: 'co_organizer' },
        ]}
        value={role}
        onChange={setRole}
      />
      {role !== 'co_organizer' && tournament.courts.length ? (
        <ChoiceChips accessibilityLabel="Court" options={[{ label: 'Any court', value: '' }, ...tournament.courts.map((c) => ({ label: c.name, value: c.id }))]} value={courtId ?? ''} onChange={(v) => setCourtId(v || null)} />
      ) : null}
      <Text style={[typography.caption, { color: colors.textMuted }]}>
        {courtId ? 'They can score every match on this court.' : role === 'co_organizer' ? 'Co-organizers can run the whole tournament.' : 'Assign them to a court or to single matches to let them score.'}
      </Text>
      {busy ? null : <PlayerSearch excludeKeys={tournament.staff.map((s) => s.userId)} registeredOnly emptyText="No players found." onPick={(p) => onAdd(p.userId!, role, courtId)} />}
    </Card>
  );
}

/** New category: sport, format (singles / doubles), rules and the draw format. */
function NewEventForm({ tournamentId, onCreated, onDone }: { tournamentId: string; onCreated: () => void; onDone: () => void }) {
  const { colors } = useTheme();
  const [sports, setSports] = useState<SportSummary[]>([]);
  const [sportId, setSportId] = useState<string | null>(null);
  const [formatCode, setFormatCode] = useState<string | null>(null);
  const [rulesetId, setRulesetId] = useState<string | null>(null);
  const [drawFormat, setDrawFormat] = useState<string>('knockout');
  const [groupCount, setGroupCount] = useState(2);
  const [name, setName] = useState('');
  const save = useSubmit();
  const loadSports = useSubmit();
  const submitSports = loadSports.submit;

  useFocusEffect(
    useCallback(() => {
      void submitSports(async () => setSports((await matchApi.sports()).sports));
    }, [submitSports]),
  );

  const sport = sports.find((s) => s.id === sportId) ?? sports[0] ?? null;
  const format = sport?.formats.find((f) => f.code === formatCode) ?? sport?.formats[0] ?? null;
  const ruleset = sport?.rulesets.find((r) => r.id === rulesetId) ?? sport?.rulesets.find((r) => r.isDefault) ?? null;

  async function create() {
    if (!sport || !format) return;
    const ok = await save.submit(async () => {
      await tournamentsApi.addEvent(tournamentId, {
        name: name.trim() || `${sport.name} ${format.name}`,
        sport: sport.slug,
        format: format.code,
        ...(ruleset ? { rulesetId: ruleset.id } : {}),
        drawFormat,
        drawConfig: drawFormat === 'groups_knockout' ? { groupCount, qualifiersPerGroup: 2 } : {},
      });
    });
    if (ok) {
      onCreated();
      onDone();
    }
  }

  return (
    <Card style={styles.form}>
      <TextField placeholder="Name, e.g. Men’s Doubles (optional)" value={name} onChangeText={setName} maxLength={80} />
      <SportGrid sports={sports} selectedId={sport?.id ?? null} onSelect={(sid) => {
          setSportId(sid);
          setFormatCode(null);
          setRulesetId(null);
        }} />
      {sport && sport.formats.length > 1 ? (
        <ChoiceChips accessibilityLabel="Format" options={sport.formats.map((f) => ({ label: f.name, value: f.code }))} value={format?.code} onChange={setFormatCode} />
      ) : null}
      {sport ? <ChoiceChips accessibilityLabel="Rules" options={sport.rulesets.map((r) => ({ label: r.name, value: r.id }))} value={ruleset?.id} onChange={setRulesetId} /> : null}
      <ChoiceChips accessibilityLabel="Draw" options={DRAW_FORMATS.map((f) => ({ label: f.label, value: f.value }))} value={drawFormat} onChange={setDrawFormat} />
      {drawFormat === 'groups_knockout' ? (
        <View style={styles.form}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>Groups (top 2 of each go through)</Text>
          <ChoiceChips accessibilityLabel="Groups" options={[2, 3, 4, 8].map((n) => ({ label: String(n), value: n }))} value={groupCount} onChange={setGroupCount} />
        </View>
      ) : null}
      <FormMessage message={save.formError ?? Object.values(save.serverFieldErrors)[0] ?? null} />
      <PrimaryButton title="Add category" onPress={() => void create()} loading={save.submitting} disabled={!sport || !format} showChevron={false} />
      <TextLink title="Cancel" onPress={onDone} />
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { paddingTop: spacing.lg },
  meta: { marginBottom: spacing.md },
  section: { marginBottom: spacing.xl },
  list: { gap: spacing.md },
  form: { gap: spacing.md, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderRadius: 16, padding: spacing.lg },
  itemTitle: { fontSize: 16, fontWeight: '700' },
});
