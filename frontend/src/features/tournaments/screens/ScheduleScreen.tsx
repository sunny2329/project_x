import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useResource } from '@/shared/hooks/useResource';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { useTheme } from '@/shared/theme';
import { Button, Chip, D, EmptyState, Header, Label, Loading, Notice, Row, Screen, T, Tap } from '@/shared/ui';
import { clock12, daysBetween, toDay, weekdayDay } from '@/shared/utils/format';
import { tournamentsApi } from '../api/tournaments.api';
import { CourtPickerSheet, TimePickerSheet } from '../components/ScheduleSheets';
import { fixtureSide } from '../components/TournamentBits';
import type { FixtureView } from '../types';

/** "R1-3" for knockout, "Group A" for groups. */
export function fixtureTag(f: FixtureView): string {
  return f.groupName ?? (f.stageType === 'knockout' ? `R${f.round}-${f.position}` : (f.roundName ?? `Round ${f.round}`));
}

const vs = (f: FixtureView) => `${fixtureSide(f, 0).name} v ${fixtureSide(f, 1).name}`;
const courtNumber = (name: string | undefined) => name?.match(/\d+/)?.[0] ?? name?.slice(0, 2) ?? '—';

/** Match-day schedule by day and start time; fixtures without a court or time wait at the bottom. */
export default function ScheduleScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ id: string; event?: string }>();
  const tournament = useResource(() => tournamentsApi.get(params.id), [params.id]);
  const fixtures = useResource(() => tournamentsApi.fixtures(params.id), [params.id], { poll: 30_000 });
  const [eventId, setEventId] = useState<string | null>(params.event ?? null);
  const [day, setDay] = useState<string | null>(null);
  const [picking, setPicking] = useState<{ fixture: FixtureView; what: 'court' | 'time' } | null>(null);
  const save = useSubmit();

  const t = tournament.data?.tournament;
  const days = useMemo(() => (t?.startsOn ? daysBetween(t.startsOn, t.endsOn) : [toDay(new Date())]), [t]);
  const today = toDay(new Date());
  const selected = day ?? (days.includes(today) ? today : days[0]!);

  const all = (fixtures.data?.fixtures ?? []).filter((f) => f.status !== 'bye' && f.status !== 'cancelled' && (!eventId || f.eventId === eventId));
  const unscheduled = all.filter((f) => (!f.scheduledAt || !f.court) && f.status !== 'completed');
  const onDay = all.filter((f) => f.scheduledAt && f.court && toDay(new Date(f.scheduledAt)) === selected).sort((a, b) => a.scheduledAt!.localeCompare(b.scheduledAt!) || (a.court?.name ?? '').localeCompare(b.court?.name ?? ''));
  const slots: { time: string; items: FixtureView[] }[] = [];
  for (const f of onDay) {
    const time = clock12(f.scheduledAt!);
    if (slots.at(-1)?.time !== time) slots.push({ time, items: [] });
    slots.at(-1)!.items.push(f);
  }

  if (tournament.loading || fixtures.loading) return <Loading />;
  if (!t) {
    return (
      <Screen>
        <Header display="Schedule" />
        <EmptyState title="Tournament not found" body={tournament.error ?? undefined} />
      </Screen>
    );
  }

  const apply = (fixture: FixtureView, body: { courtId?: string | null; scheduledAt?: string | null }) =>
    void save.submit(async () => {
      const { fixture: updated } = await tournamentsApi.schedule(fixture.id, body);
      fixtures.setData((prev) => (prev ? { fixtures: prev.fixtures.map((f) => (f.id === updated.id ? updated : f)) } : prev));
    });

  return (
    <Screen gap={14} refreshing={fixtures.refreshing} onRefresh={fixtures.refresh}>
      <Header kicker={t.name} display="Schedule" right={<Button label="Court board" variant="surface" height={40} radius={12} size={13} inline px={12} onPress={() => router.push({ pathname: '/tournament/[id]/courts', params: { id: t.id } })} />} />

      {t.events.length > 1 ? (
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          <Chip label="All events" active={!eventId} height={34} onPress={() => setEventId(null)} />
          {t.events.map((e) => (
            <Chip key={e.id} label={e.name} dot={e.sport.accentColor} active={eventId === e.id} height={34} onPress={() => setEventId(e.id)} />
          ))}
        </Row>
      ) : null}

      <Row gap={8} style={{ flexWrap: 'wrap' }}>
        {days.map((d) => (
          <Chip key={d} label={weekdayDay(d)} active={d === selected} onPress={() => setDay(d)} />
        ))}
        {unscheduled.length ? (
          <T size={13} w={600} color={colors.warnText} style={{ marginLeft: 'auto', alignSelf: 'center' }}>
            {unscheduled.length} not scheduled
          </T>
        ) : null}
      </Row>

      {save.formError || fixtures.error ? <Notice tone="error" icon="alert" text={(save.formError ?? fixtures.error)!} /> : null}

      {slots.map((s) => (
        <View key={s.time} style={{ gap: 6 }}>
          <Label>{s.time}</Label>
          {s.items.map((f) => (
            <Tap key={f.id} label={vs(f)} onPress={() => router.push({ pathname: '/fixture/[id]', params: { id: f.id } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, backgroundColor: colors.surface }}>
              <View style={{ width: 64, alignItems: 'center', paddingVertical: 6, borderRadius: 10, backgroundColor: colors.raised }}>
                <T size={10} w={700} color={colors.muted}>
                  COURT
                </T>
                <D size={24} lh={24}>
                  {courtNumber(f.court?.name)}
                </D>
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <T size={12} color={colors.muted} numberOfLines={1}>
                  {f.event.name} · {fixtureTag(f)}
                  {f.status === 'live' || f.match?.status === 'live' ? ' · LIVE' : f.status === 'completed' ? ' · Final' : ''}
                </T>
                <T size={14} w={600} numberOfLines={1}>
                  {vs(f)}
                </T>
              </View>
            </Tap>
          ))}
        </View>
      ))}
      {!slots.length ? (
        <T size={14} color={colors.muted}>
          Nothing scheduled on {weekdayDay(selected)} yet.
        </T>
      ) : null}

      {unscheduled.length ? (
        <View style={{ gap: 6 }}>
          <Label color={colors.warnText}>Not scheduled</Label>
          {unscheduled.map((f) => (
            <View key={f.id} style={{ gap: 10, padding: 12, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.warnLine }}>
              <Tap label={vs(f)} onPress={() => router.push({ pathname: '/fixture/[id]', params: { id: f.id } })} style={{ gap: 2 }}>
                <T size={12} color={colors.muted}>
                  {f.event.name} · {fixtureTag(f)}
                </T>
                <T size={14} w={600}>
                  {vs(f)}
                </T>
              </Tap>
              <Row gap={8}>
                <Button label={f.court?.name ?? 'Pick court'} icon="courtHalf" variant="raised" height={40} radius={10} size={13} style={{ flex: 1 }} onPress={() => setPicking({ fixture: f, what: 'court' })} />
                <Button label={f.scheduledAt ? clock12(f.scheduledAt) : 'Pick time'} icon="clock" variant="raised" height={40} radius={10} size={13} style={{ flex: 1 }} onPress={() => setPicking({ fixture: f, what: 'time' })} />
              </Row>
            </View>
          ))}
        </View>
      ) : null}

      {!all.length ? <EmptyState title="No fixtures yet" body="Make the draw for an event and its matches show up here." /> : null}

      <CourtPickerSheet
        visible={picking?.what === 'court'}
        courts={t.courts}
        current={picking?.fixture.court?.id ?? null}
        onClose={() => setPicking(null)}
        onPick={(courtId) => {
          const f = picking!.fixture;
          setPicking(null);
          apply(f, { courtId });
        }}
      />
      <TimePickerSheet
        visible={picking?.what === 'time'}
        day={selected}
        current={picking?.fixture.scheduledAt ?? null}
        onClose={() => setPicking(null)}
        onPick={(iso) => {
          const f = picking!.fixture;
          setPicking(null);
          apply(f, { scheduledAt: iso });
        }}
      />
    </Screen>
  );
}
