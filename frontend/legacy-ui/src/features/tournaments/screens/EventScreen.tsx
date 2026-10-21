import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SideEditor } from '@/features/match/components/SideEditor';
import { addPlayer, lineupKeys, removePlayer, type Lineup } from '@/features/match/lineup';
import { Card, ChoiceChips, FormMessage, OutlineButton, PrimaryButton, Screen, SectionHeader, TextLink, TopBar } from '@/shared/components';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { spacing, typography, useTheme } from '@/shared/theme';
import { tournamentsApi } from '../api/tournaments.api';
import { Bracket, FixtureCard, StandingsTable } from '../components/FixtureCard';
import { DRAW_FORMATS, statusText, type EventDetail, type FixtureView } from '../types';

type Tab = 'draw' | 'entries';

/** A category: entries (add, approve, seed), the draw, fixtures, bracket and standings. */
export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [tab, setTab] = useState<Tab>('draw');
  const [adding, setAdding] = useState(false);
  const [entry, setEntry] = useState<Lineup>([[]]);
  const [searching, setSearching] = useState(false);
  const load = useSubmit();
  const submitLoad = load.submit;
  const action = useSubmit();

  const refresh = useCallback(() => {
    void submitLoad(async () => {
      const next = (await tournamentsApi.event(id)).event;
      setEvent(next);
      const t = (await tournamentsApi.get(next.tournament.id)).tournament;
      setIsOrganizer(t.isOrganizer);
      if (!next.stages.length) setTab((prev) => (prev === 'draw' && !next.fixtures.length ? 'entries' : prev));
    });
  }, [submitLoad, id]);
  useFocusEffect(refresh);

  if (!event) {
    return (
      <Screen header={<TopBar title="Category" />}>
        <View style={styles.top}>
          <FormMessage message={load.formError} />
        </View>
      </Screen>
    );
  }
  const ev = event;
  const drawn = ev.stages.length > 0;
  const approved = ev.entries.filter((e) => e.status === 'approved');

  async function run(work: () => Promise<{ event: EventDetail }>) {
    let next: EventDetail | null = null;
    const ok = await action.submit(async () => {
      next = (await work()).event;
    });
    if (ok && next) setEvent(next);
    return ok;
  }

  function openFixture(f: FixtureView) {
    if (f.match) router.push({ pathname: '/match/[id]', params: { id: f.match.id } });
    else if (isOrganizer && (f.status === 'ready' || f.status === 'pending')) router.push({ pathname: '/tournaments/fixture/[id]', params: { id: f.id } });
  }

  function confirmDraw() {
    Alert.alert('Make the draw?', `${approved.length} approved entries. Seeds are placed first; unseeded entries are drawn at random. Entries can't be changed afterwards.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Draw', onPress: () => void run(() => tournamentsApi.draw(ev.id)).then((ok) => ok && setTab('draw')) },
    ]);
  }

  return (
    <Screen header={<TopBar title={ev.name} />} onRefresh={refresh} refreshing={load.submitting}>
      <View style={styles.top} />
      <TextLink title={ev.tournament.name} onPress={() => router.push({ pathname: '/tournaments/[id]', params: { id: ev.tournament.id } })} />
      <Text style={[typography.caption, styles.meta, { color: colors.textMuted }]}>
        {[ev.sport.name, ev.format.name, ev.ruleset.name, DRAW_FORMATS.find((f) => f.value === ev.drawFormat)?.label, statusText(ev.status)].join(' · ')}
      </Text>
      <View style={styles.section}>
        <ChoiceChips
          accessibilityLabel="View"
          options={[
            { label: drawn ? 'Draw & results' : 'Draw', value: 'draw' },
            { label: `Entries (${approved.length})`, value: 'entries' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>
      <FormMessage message={action.formError ?? Object.values(action.serverFieldErrors)[0] ?? null} />

      {tab === 'entries' ? (
        <View style={styles.section}>
          {isOrganizer && !drawn ? (
            adding ? (
              <View style={styles.list}>
                <SideEditor
                  title="New entry"
                  players={entry[0]!}
                  maxPlayers={ev.format.playersPerSide}
                  searching={searching}
                  excludeKeys={lineupKeys(entry)}
                  onToggleSearch={() => setSearching((s) => !s)}
                  onAdd={(p) => setEntry((prev) => addPlayer(prev, 0, p, ev.format.playersPerSide))}
                  onRemove={(key) => setEntry((prev) => removePlayer(prev, key))}
                />
                <PrimaryButton
                  title="Add entry"
                  showChevron={false}
                  loading={action.submitting}
                  disabled={entry[0]!.length !== ev.format.playersPerSide}
                  onPress={() =>
                    void run(() => tournamentsApi.addEntry(ev.id, entry[0]!.map((p) => p.input))).then((ok) => {
                      if (ok) {
                        setEntry([[]]);
                        setSearching(false);
                      }
                    })
                  }
                />
                <TextLink title="Done" onPress={() => setAdding(false)} />
              </View>
            ) : (
              <PrimaryButton title="Add entries" onPress={() => setAdding(true)} />
            )
          ) : null}

          <Card style={[styles.list, styles.entries]}>
            {ev.entries.length ? (
              ev.entries.map((e) => (
                <View key={e.id} style={styles.entryRow}>
                  <Text style={[styles.seed, { color: colors.primary }]}>{e.seed ? `[${e.seed}]` : ''}</Text>
                  <View style={styles.flex}>
                    <Text style={[typography.body, { color: colors.text, fontWeight: '600' }]}>{e.name}</Text>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>
                      {statusText(e.status)}
                      {e.players.some((p) => p.isGuest) ? ' · guest' : ''}
                    </Text>
                  </View>
                  {isOrganizer && !drawn ? (
                    e.status === 'pending' ? (
                      <TextLink title="Approve" onPress={() => void run(() => tournamentsApi.updateEntry(e.id, { status: 'approved' }))} />
                    ) : e.status === 'approved' ? (
                      <TextLink
                        title={e.seed ? 'Unseed' : 'Seed'}
                        onPress={() => {
                          const used = new Set(ev.entries.map((x) => x.seed).filter(Boolean));
                          let next = 1;
                          while (used.has(next)) next += 1;
                          void run(() => tournamentsApi.updateEntry(e.id, { seed: e.seed ? null : next }));
                        }}
                      />
                    ) : null
                  ) : null}
                </View>
              ))
            ) : (
              <Text style={[typography.caption, { color: colors.textMuted }]}>No entries yet. Players and pairs can be guests.</Text>
            )}
          </Card>
        </View>
      ) : null}

      {tab === 'draw' ? (
        <View style={styles.section}>
          {!drawn ? (
            <Card style={styles.list}>
              <Text style={[typography.body, { color: colors.textMuted }]}>The draw hasn’t been made yet.</Text>
              {isOrganizer ? <PrimaryButton title="Make the draw" onPress={confirmDraw} disabled={approved.length < 2} loading={action.submitting} /> : null}
            </Card>
          ) : null}
          {ev.stages.map((stage) => {
            const fixtures = ev.fixtures.filter((f) => f.stageId === stage.id);
            return (
              <View key={stage.id} style={styles.section}>
                <SectionHeader title={stage.name} />
                {stage.type === 'knockout' ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <Bracket fixtures={fixtures} onPressFixture={openFixture} />
                  </ScrollView>
                ) : (
                  stage.groups.map((g) => (
                    <Card key={g.id} style={[styles.list, styles.group]}>
                      <Text style={[styles.groupTitle, { color: colors.text }]}>{g.name}</Text>
                      {g.standings ? <StandingsTable rows={g.standings} /> : null}
                      {fixtures
                        .filter((f) => f.groupId === g.id)
                        .map((f) => (
                          <FixtureCard key={f.id} fixture={f} onPress={() => openFixture(f)} />
                        ))}
                    </Card>
                  ))
                )}
              </View>
            );
          })}
          {isOrganizer && drawn && !ev.fixtures.some((f) => f.match) ? (
            <OutlineButton title="Reset draw" destructive onPress={() => void run(() => tournamentsApi.resetDraw(ev.id))} />
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { paddingTop: spacing.lg },
  meta: { marginBottom: spacing.md, marginTop: spacing.xs },
  section: { marginBottom: spacing.xl },
  list: { gap: spacing.md },
  entries: { marginTop: spacing.md },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  seed: { width: 32, fontWeight: '800' },
  flex: { flex: 1 },
  group: { marginBottom: spacing.md },
  groupTitle: { fontSize: 15, fontWeight: '700' },
});
