import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { AddPlayerSheet } from '@/features/match/components/AddPlayerSheet';
import type { LineupPlayer } from '@/features/match/lineup';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useResource } from '@/shared/hooks/useResource';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { displayFont, READY, useTheme } from '@/shared/theme';
import { Avatar, Button, Chip, EmptyState, Header, IconButton, Loading, Notice, Row, Screen, Segmented, T } from '@/shared/ui';
import { ago, shortName } from '@/shared/utils/format';
import { tournamentsApi } from '../api/tournaments.api';
import { EventTabs } from '../components/TournamentBits';
import type { EntryView, EventDetail } from '../types';

type Tab = 'pending' | 'approved';

const entryName = (e: EntryView) => e.players.map((p) => shortName(p.displayName)).join(' / ');

/**
 * Entries for an event. Organizers approve or decline, set seeds, add entries themselves, then
 * close registration and preview the draw. Everyone else sees the approved list.
 */
export default function EntriesScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useAuthStore((s) => s.user);
  const event = useResource(() => tournamentsApi.event(id), [id]);
  const tournament = useResource(() => tournamentsApi.get(event.data!.event.tournament.id), [event.data?.event.tournament.id], { enabled: !!event.data });
  const [tab, setTab] = useState<Tab | null>(null);
  const [seeds, setSeeds] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState<LineupPlayer[] | null>(null);
  const action = useSubmit();

  if (event.loading) return <Loading />;
  const e = event.data?.event;
  if (!e) {
    return (
      <Screen>
        <Header />
        <EmptyState title="Event not found" body={event.error ?? undefined} />
      </Screen>
    );
  }

  const t = tournament.data?.tournament;
  // Organizers and co-organizers run entries; referees and scorers only see the list.
  const organizer = !!t && (t.isOrganizer || t.staff.some((s) => s.role === 'co_organizer' && s.userId === me?.id));
  const pending = e.entries.filter((x) => x.status === 'pending');
  const approved = e.entries.filter((x) => x.status === 'approved').sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999) || b.rating - a.rating);
  const current: Tab = tab ?? (organizer && pending.length ? 'pending' : 'approved');
  const drawn = e.stages.length > 0;
  const perSide = e.format.playersPerSide;

  const apply = (run: () => Promise<{ event: EventDetail }>) =>
    void action.submit(async () => {
      const r = await run();
      event.setData({ event: r.event });
    });

  const saveSeed = (entry: EntryView) => {
    const raw = seeds[entry.id];
    if (raw === undefined) return;
    const seed = raw ? Number(raw) : null;
    if (seed === entry.seed) return;
    apply(() => tournamentsApi.updateEntry(entry.id, { seed }));
    setSeeds((s) => {
      const next = { ...s };
      delete next[entry.id];
      return next;
    });
  };

  const left = e.maxEntries === null ? null : e.maxEntries - approved.length;

  return (
    <Screen
      gap={14}
      refreshing={event.refreshing}
      onRefresh={event.refresh}
      footerBar={organizer && !drawn}
      footer={
        organizer && !drawn ? (
          <Button
            label={e.status === 'registration_open' ? 'Close registration & preview draw' : 'Preview draw'}
            weight={800}
            height={54}
            loading={action.submitting}
            disabled={approved.length < 2}
            onPress={() =>
              void action.submit(async () => {
                if (e.status === 'registration_open') await tournamentsApi.updateEvent(e.id, { status: 'registration_closed' });
                router.push({ pathname: '/event/[id]/draw', params: { id: e.id } });
              })
            }
          />
        ) : undefined
      }
    >
      <Header kicker={e.tournament.name} display={e.name} right={organizer && !drawn ? <IconButton icon="plus" label="Add an entry" onPress={() => setAdding([])} /> : undefined} />

      {t && t.events.length > 1 && organizer ? (
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          {t.events.map((x) => (
            <Chip key={x.id} label={`${x.name}${x.pendingEntries ? ` · ${x.pendingEntries}` : ''}`} dot={x.sport.accentColor} active={x.id === e.id} height={34} onPress={() => x.id !== e.id && router.replace({ pathname: '/event/[id]/entries', params: { id: x.id } })} />
          ))}
        </Row>
      ) : null}

      {!organizer ? <EventTabs event={e} active="entries" /> : null}

      {organizer ? (
        <Segmented<Tab>
          options={[
            { value: 'pending', label: `Pending · ${pending.length}` },
            { value: 'approved', label: `Approved · ${approved.length}${e.maxEntries ? `/${e.maxEntries}` : ''}` },
          ]}
          value={current}
          onChange={setTab}
        />
      ) : null}

      {action.formError ? <Notice tone="error" icon="alert" text={action.formError} /> : null}

      {current === 'pending' && organizer ? (
        <View style={{ gap: 10 }}>
          {pending.map((x) => (
            <View key={x.id} style={{ gap: 10, padding: 14, borderRadius: 16, backgroundColor: colors.surface }}>
              <Row gap={12}>
                <Avatar name={x.name} id={x.id} size={40} />
                <View style={{ flex: 1 }}>
                  <T size={15} w={700} numberOfLines={1}>
                    {entryName(x)}
                  </T>
                  <T size={12} color={colors.muted}>
                    {e.sport.name} {Math.round(x.rating)} · asked {ago(x.createdAt)}
                  </T>
                </View>
              </Row>
              <Row gap={8}>
                <Button label="Decline" variant="outline" height={42} radius={12} size={14} textColor={colors.bad} style={{ flex: 1 }} onPress={() => apply(() => tournamentsApi.updateEntry(x.id, { status: 'withdrawn' }))} />
                <Button label="Approve" color={READY} height={42} radius={12} size={14} weight={800} style={{ flex: 1 }} disabled={left !== null && left <= 0} onPress={() => apply(() => tournamentsApi.updateEntry(x.id, { status: 'approved' }))} />
              </Row>
            </View>
          ))}
          {pending.length ? (
            <T size={13} color={colors.muted} center>
              {left === null ? `${approved.length} approved so far.` : left <= 0 ? 'The event is full. Raise the limit to approve more.' : pending.length >= left ? `Approving ${pending.length === left ? (pending.length === 2 ? 'both' : 'all') : left} fills the event to ${e.maxEntries}.` : `${left} places left.`}
            </T>
          ) : (
            <EmptyState title="Nothing waiting" body="New entries show up here for you to approve." />
          )}
        </View>
      ) : (
        <View style={{ gap: 6 }}>
          <Row style={{ paddingHorizontal: 4 }}>
            {organizer ? (
              <T size={11} w={700} ls={0.06} color={colors.muted} style={{ width: 56 }}>
                SEED
              </T>
            ) : null}
            <T size={11} w={700} ls={0.06} color={colors.muted} flex>
              {perSide > 1 ? 'PAIR' : 'PLAYER'}
            </T>
            <T size={11} w={700} ls={0.06} color={colors.muted} right style={{ width: 64 }}>
              RATING
            </T>
          </Row>
          {approved.map((x, i) => (
            <Row key={x.id} style={{ paddingVertical: 8, paddingHorizontal: 4, borderBottomWidth: i === approved.length - 1 ? 0 : 1, borderBottomColor: colors.raised }}>
              {organizer ? (
                <View style={{ width: 56 }}>
                  <TextInput
                    value={seeds[x.id] ?? (x.seed ? String(x.seed) : '')}
                    onChangeText={(v) => setSeeds((s) => ({ ...s, [x.id]: v.replace(/\D/g, '').slice(0, 3) }))}
                    onEndEditing={() => saveSeed(x)}
                    editable={!drawn}
                    keyboardType="number-pad"
                    placeholder="–"
                    placeholderTextColor={colors.faint}
                    accessibilityLabel={`Seed for ${entryName(x)}`}
                    style={{ width: 40, height: 36, borderRadius: 10, backgroundColor: colors.raised, textAlign: 'center', color: colors.fg, fontFamily: displayFont(900), fontSize: 18, padding: 0 }}
                  />
                </View>
              ) : x.seed ? (
                <T size={13} color={colors.muted} style={{ width: 28 }}>
                  {x.seed}
                </T>
              ) : null}
              <T w={600} flex numberOfLines={1}>
                {entryName(x)}
              </T>
              <T color={colors.soft} right style={{ width: 64 }}>
                {Math.round(x.rating)}
              </T>
            </Row>
          ))}
          {approved.length ? (
            <T size={13} color={colors.muted} style={{ paddingTop: 4 }}>
              {organizer ? (drawn ? 'Seeds are fixed once the draw is made.' : 'Each seed number can be used once. Unseeded players are shuffled.') : 'Numbers are seeds.'}
            </T>
          ) : (
            <EmptyState title="No entries yet" />
          )}
        </View>
      )}

      <AddPlayerSheet
        visible={adding !== null}
        side={0}
        title={adding && adding.length ? `Partner for ${adding[0]!.displayName}` : 'Add an entry'}
        sport={e.sport.slug}
        sportName={e.sport.name}
        taken={(adding ?? []).map((p) => p.key)}
        onAdd={(p) => {
          const players = [...(adding ?? []), p];
          if (players.length < perSide) {
            // Ask for the partner next.
            setTimeout(() => setAdding(players), 350);
            return;
          }
          setAdding(null);
          apply(() => tournamentsApi.addEntry(e.id, players.map((x) => x.input)));
        }}
        onClose={() => setAdding((a) => (a && a.length && a.length < perSide ? a : null))}
      />
    </Screen>
  );
}
