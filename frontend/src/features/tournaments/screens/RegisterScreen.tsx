import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { AddPlayerSheet } from '@/features/match/components/AddPlayerSheet';
import { useSports } from '@/features/match/hooks/useSports';
import type { LineupPlayer } from '@/features/match/lineup';
import type { PlayerOption } from '@/features/match/types';
import { useProfileStore } from '@/features/profile/store/profile.store';
import { useResource } from '@/shared/hooks/useResource';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { useTheme } from '@/shared/theme';
import { Avatar, Button, EmptyState, Header, Icon, Label, Loading, Notice, RadioCard, Row, Screen, T } from '@/shared/ui';
import { firstName, plural, shortName } from '@/shared/utils/format';
import { tournamentsApi } from '../api/tournaments.api';

/** Register: pick an event, pick a partner for doubles, send the entry (the organizer approves it). */
export default function RegisterScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ id: string; event?: string }>();
  const { data, error, loading } = useResource(() => tournamentsApi.get(params.id), [params.id]);
  const { me } = useSports();
  const profile = useProfileStore((s) => s.profile);
  const [eventId, setEventId] = useState<string | null>(params.event ?? null);
  const [partner, setPartner] = useState<{ player: LineupPlayer; option?: PlayerOption } | null>(null);
  const [picking, setPicking] = useState(false);
  const { submit, submitting, formError } = useSubmit();
  useEffect(() => {
    // My rating per sport for the "Combined rating" line.
    if (!profile) void useProfileStore.getState().load().catch(() => undefined);
  }, [profile]);

  if (loading) return <Loading />;
  const t = data?.tournament;
  if (!t) {
    return (
      <Screen>
        <Header title="Register" />
        <EmptyState title="Tournament not found" body={error ?? undefined} />
      </Screen>
    );
  }

  const left = (e: (typeof t.events)[number]) => (e.maxEntries === null ? null : e.maxEntries - e.approvedEntries - e.pendingEntries);
  const openEvents = t.events.filter((e) => e.status === 'registration_open' && !e.myEntry && (left(e) === null || left(e)! > 0));
  const event = t.events.find((e) => e.id === eventId) ?? openEvents[0] ?? null;
  const needsPartner = (event?.format.playersPerSide ?? 1) > 1;
  const myName = profile?.displayName ?? me?.displayName ?? 'You';
  const myRating = profile?.sports.find((s) => s.slug === event?.sport.slug)?.rating ?? null;
  const ratings = [myRating, partner?.option?.rating ?? null].filter((r): r is number => r !== null);
  const players = needsPartner ? 2 : 1;
  const ready = !!event && !!me && (!needsPartner || !!partner);

  const send = () =>
    void submit(async () => {
      if (!event || !me) return;
      await tournamentsApi.addEntry(event.id, [{ playerId: me.playerId }, ...(needsPartner && partner ? [partner.player.input] : [])]);
      router.replace('/tournaments/mine');
    });

  return (
    <Screen
      gap={16}
      footer={
        <View style={{ gap: 10 }}>
          <T size={13} lh={19} color={colors.muted} center>
            The organizer approves entries and sets seeds.
            {needsPartner && partner && !partner.player.isGuest ? ` ${firstName(partner.player.displayName)} sees the entry under My matches.` : ''}
          </T>
          {formError ? <Notice tone="error" icon="alert" text={formError} /> : null}
          <Button label="Send entry" weight={800} disabled={!ready} loading={submitting} onPress={send} />
        </View>
      }
    >
      <Header kicker={t.name} title="Register" />

      <View style={{ gap: 8 }}>
        <Label>1 · Pick an event</Label>
        {t.events.map((e) => {
          const l = left(e);
          const available = openEvents.includes(e);
          const sub = e.myEntry ? `${e.sport.name} · You’re entered` : e.status !== 'registration_open' ? `${e.sport.name} · Registration closed` : l !== null && l <= 0 ? `${e.sport.name} · Full` : `${e.sport.name}${l !== null ? ` · ${plural(l, 'place')} left` : ''}`;
          return (
            <RadioCard
              key={e.id}
              title={e.name}
              subtitle={sub}
              selected={available && e.id === event?.id}
              disabled={!available}
              color={e.sport.accentColor}
              onPress={() => {
                setEventId(e.id);
                if (e.format.playersPerSide < 2) setPartner(null);
              }}
            />
          );
        })}
      </View>

      {needsPartner ? (
        <View style={{ gap: 8 }}>
          <Label>2 · Your partner</Label>
          {partner ? (
            <Row gap={12} style={{ paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
              <Avatar name={partner.player.displayName} id={partner.player.userId ?? partner.player.key} photoUrl={partner.option?.photoUrl} size={40} />
              <View style={{ flex: 1 }}>
                <T size={15} w={700} numberOfLines={1}>
                  {partner.player.displayName}
                </T>
                <T size={13} color={colors.muted} numberOfLines={1}>
                  {partner.player.isGuest ? 'Guest' : partner.option?.rating ? `${event!.sport.name} ${Math.round(partner.option.rating)}` : `@${partner.option?.username ?? ''}`}
                </T>
              </View>
              <Button label="Change" variant="outline" height={34} radius={10} size={13} inline px={12} onPress={() => setPicking(true)} />
            </Row>
          ) : (
            <Button label="Pick your partner" icon="personAdd" variant="outline" height={52} radius={14} onPress={() => setPicking(true)} />
          )}
        </View>
      ) : null}

      {event ? (
        <View style={{ gap: 8, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, backgroundColor: colors.surface }}>
          <Row between>
            <T size={14} color={colors.muted}>
              Entry
            </T>
            <T size={14} w={600}>
              {[shortName(myName), needsPartner ? (partner ? shortName(partner.player.displayName) : '…') : null].filter(Boolean).join(' / ')}
            </T>
          </Row>
          {ratings.length ? (
            <Row between>
              <T size={14} color={colors.muted}>
                {needsPartner ? 'Combined rating' : 'Rating'}
              </T>
              <T size={14} w={600}>
                {Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length)}
                {needsPartner ? ' avg' : ''}
              </T>
            </Row>
          ) : null}
          <Row between>
            <T size={14} color={colors.muted}>
              Fee
            </T>
            <T size={14} w={600}>
              {t.entryFee ? `${t.entryFee} × ${players}` : 'Free'}
            </T>
          </Row>
        </View>
      ) : (
        <Row gap={10}>
          <Icon name="info" size={18} color={colors.muted} />
          <T size={14} color={colors.muted} flex>
            No events are open for entries right now.
          </T>
        </Row>
      )}

      {event ? (
        <AddPlayerSheet
          visible={picking}
          side={0}
          title="Your partner"
          sport={event.sport.slug}
          sportName={event.sport.name}
          taken={me ? [me.userId ?? me.playerId] : []}
          onAdd={(player, option) => setPartner({ player, option })}
          onClose={() => setPicking(false)}
        />
      ) : null}
    </Screen>
  );
}
