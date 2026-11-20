import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { AddPlayerSheet } from '@/features/match/components/AddPlayerSheet';
import type { LineupPlayer } from '@/features/match/lineup';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useResource } from '@/shared/hooks/useResource';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { displayFont, READY, useTheme } from '@/shared/theme';
import { Avatar, Button, Chip, EmptyState, Header, IconButton, Label, Loading, Notice, Row, Screen, Segmented, Sheet, T } from '@/shared/ui';
import { confirmAction } from '@/shared/utils/confirm';
import { ago, shortName } from '@/shared/utils/format';
import { tournamentsApi } from '../api/tournaments.api';
import { EventHeader } from '../components/TournamentBits';
import type { EntryView, EventDetail } from '../types';

type Tab = 'pending' | 'approved';

const entryName = (e: EntryView) => e.players.map((p) => shortName(p.displayName)).join(' / ');

/**
 * Entries for an event. Organizers approve or decline, set seeds, add entries themselves, then
 * close registration and preview the draw. After the draw they can still add late entries (they go
 * straight into the draw), change an entry's players, and remove or withdraw entries. Everyone
 * else sees the approved list.
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
  /** The entry whose players are being replaced (null = adding a new entry). */
  const [addingFor, setAddingFor] = useState<EntryView | null>(null);
  const [managing, setManaging] = useState<EntryView | null>(null);
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
  const out = e.entries.filter((x) => x.status === 'withdrawn' || x.status === 'disqualified');
  const drawn = e.stages.length > 0;
  const finished = e.status === 'completed' || e.status === 'cancelled';
  const canAdd = organizer && !finished;
  const perSide = e.format.playersPerSide;
  const lateWhere =
    e.drawFormat === 'knockout'
      ? 'A new entry takes a free bye, or plays a play-in match against the lowest-ranked entry still waiting for a first match.'
      : 'A new entry joins the smallest group still playing, with a match against everyone in it.';

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

  // Once the draw is made the organizer can go over the limit; it rises with the entries.
  const left = e.maxEntries === null || drawn ? null : e.maxEntries - approved.length;

  const startAdding = (target: EntryView | null) => {
    setManaging(null);
    setAddingFor(target);
    // Let the manage sheet close before the player picker opens.
    setTimeout(() => setAdding([]), target ? 350 : 0);
  };

  const removeEntry = (x: EntryView) => {
    setManaging(null);
    const who = entryName(x);
    if (x.hasMatches) {
      confirmAction(
        `Withdraw ${who}?`,
        drawn ? 'Results so far stay. Their unplayed matches are cancelled, and in a knockout their next opponent goes through.' : undefined,
        'Withdraw',
        () => apply(() => tournamentsApi.updateEntry(x.id, { status: 'withdrawn' })),
      );
      return;
    }
    confirmAction(
      `Remove ${who}?`,
      drawn ? 'They leave the draw. Their opponent goes through, and any play-in made for them is removed.' : 'They leave the event.',
      'Remove',
      () => apply(() => tournamentsApi.deleteEntry(x.id)),
    );
  };

  return (
    <Screen
      edgeToEdge
      px={0}
      gap={0}
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
      <EventHeader event={e} active="entries" action={canAdd ? { icon: 'plus', label: drawn ? 'Add a late entry' : 'Add an entry', onPress: () => startAdding(null) } : undefined} />
      <View style={{ paddingHorizontal: 16, paddingTop: 14, gap: 14 }}>

      {t && t.events.length > 1 && organizer ? (
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          {t.events.map((x) => (
            <Chip key={x.id} label={`${x.name}${x.pendingEntries ? ` · ${x.pendingEntries}` : ''}`} dot={x.sport.accentColor} active={x.id === e.id} height={34} onPress={() => x.id !== e.id && router.replace({ pathname: '/event/[id]/entries', params: { id: x.id } })} />
          ))}
        </Row>
      ) : null}

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
      {organizer && drawn && !finished ? <Notice tone="info" icon="info" text={`The draw is made, but you can still change it. ${lateWhere} Tap the pencil next to an entry to change its players or remove it.`} /> : null}

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
              {organizer ? <IconButton icon="pen" label={`Change ${entryName(x)}`} size={36} onPress={() => setManaging(x)} /> : null}
            </Row>
          ))}
          {approved.length ? (
            <T size={13} color={colors.muted} style={{ paddingTop: 4 }}>
              {organizer ? (drawn ? 'Seeds are fixed once the draw is made.' : 'Each seed number can be used once. Unseeded players are shuffled.') : 'Numbers are seeds.'}
            </T>
          ) : (
            <EmptyState title="No entries yet" />
          )}
          {out.length ? (
            <View style={{ gap: 6, paddingTop: 12 }}>
              <Label>Withdrawn · {out.length}</Label>
              {out.map((x) => (
                <Row key={x.id} gap={8} style={{ paddingVertical: 6, paddingHorizontal: 4 }}>
                  <T color={colors.muted} flex numberOfLines={1} style={{ textDecorationLine: 'line-through' }}>
                    {entryName(x)}
                  </T>
                  {organizer && !x.hasMatches ? <IconButton icon="trash" label={`Remove ${entryName(x)} for good`} size={36} onPress={() => removeEntry(x)} /> : null}
                </Row>
              ))}
            </View>
          ) : null}
        </View>
      )}

      <Sheet visible={managing !== null} onClose={() => setManaging(null)}>
        {managing ? (
          <View style={{ gap: 14 }}>
            <View style={{ gap: 4 }}>
              <T size={18} w={800} numberOfLines={1}>
                {entryName(managing)}
              </T>
              <T size={13} color={colors.muted}>
                {managing.seed ? `Seed ${managing.seed} · ` : ''}
                {managing.hasMatches ? 'Has played in this event' : drawn ? 'Hasn’t played yet' : 'In the entry list'}
              </T>
            </View>
            <View style={{ gap: 6 }}>
              {managing.players.map((p) => (
                <Row key={p.playerId} gap={10}>
                  <Avatar name={p.displayName} id={p.playerId} size={32} />
                  <T flex numberOfLines={1}>
                    {p.displayName}
                  </T>
                  {p.isGuest ? (
                    <T size={12} color={colors.muted}>
                      Guest
                    </T>
                  ) : null}
                </Row>
              ))}
            </View>
            <Button label={perSide > 1 ? 'Change players' : 'Change player'} icon="people" variant="surface" height={48} radius={14} size={15} onPress={() => startAdding(managing)} />
            <Button
              label={managing.hasMatches ? 'Withdraw from the event' : 'Remove from the event'}
              icon={managing.hasMatches ? 'ban' : 'trash'}
              variant="outline"
              textColor={colors.bad}
              height={48}
              radius={14}
              size={15}
              onPress={() => removeEntry(managing)}
            />
            {managing.hasMatches ? (
              <T size={12} color={colors.muted} center>
                Entries that have played can’t be deleted, so their results stay.
              </T>
            ) : null}
          </View>
        ) : null}
      </Sheet>

      <AddPlayerSheet
        visible={adding !== null}
        side={0}
        title={adding && adding.length ? `Partner for ${adding[0]!.displayName}` : addingFor ? `New player${perSide > 1 ? ' 1' : ''} for ${entryName(addingFor)}` : drawn ? 'Add a late entry' : 'Add an entry'}
        sport={e.sport.slug}
        sportName={e.sport.name}
        taken={[...(adding ?? []).map((p) => p.key), ...e.entries.filter((x) => x.id !== addingFor?.id && x.status !== 'withdrawn').flatMap((x) => x.players.map((p) => p.userId ?? p.playerId))]}
        onAdd={(p) => {
          const players = [...(adding ?? []), p];
          if (players.length < perSide) {
            // Ask for the partner next.
            setTimeout(() => setAdding(players), 350);
            return;
          }
          setAdding(null);
          const target = addingFor;
          setAddingFor(null);
          apply(() => (target ? tournamentsApi.updateEntry(target.id, { players: players.map((x) => x.input) }) : tournamentsApi.addEntry(e.id, players.map((x) => x.input))));
        }}
        onClose={() => {
          setAdding((a) => (a && a.length && a.length < perSide ? a : null));
          if (!adding?.length) setAddingFor(null);
        }}
      />
      </View>
    </Screen>
  );
}
