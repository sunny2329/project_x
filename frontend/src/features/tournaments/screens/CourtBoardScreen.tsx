import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { useNow } from '@/shared/hooks/useNow';
import { useResource } from '@/shared/hooks/useResource';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { useTheme } from '@/shared/theme';
import { Button, D, EmptyState, Header, Loading, Notice, Row, Screen, T } from '@/shared/ui';
import { clock12 } from '@/shared/utils/format';
import { tournamentsApi } from '../api/tournaments.api';
import { fixtureSide } from '../components/TournamentBits';
import { EventHero } from '../components/TournamentV2';
import { roundCode } from '../rounds';
import type { FixtureView } from '../types';

const isLive = (f: FixtureView) => f.match?.status === 'live' || f.status === 'live';

/** Court control (design v2): every court with what's on it now, what's ready or next, its scorer and the one action that moves it on. */
export default function CourtBoardScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const tournament = useResource(() => tournamentsApi.get(id), [id]);
  const fixtures = useResource(() => tournamentsApi.fixtures(id), [id], { poll: 8_000 });
  const start = useSubmit();
  const now = useNow(30_000);

  if (tournament.loading || fixtures.loading) return <Loading />;
  const t = tournament.data?.tournament;
  if (!t) {
    return (
      <Screen>
        <Header display="Court board" />
        <EmptyState title="Tournament not found" body={tournament.error ?? undefined} />
      </Screen>
    );
  }

  const list = fixtures.data?.fixtures ?? [];
  const courts = t.courts.map((c) => {
    const here = list.filter((f) => f.court?.id === c.id);
    const live = here.find(isLive) ?? null;
    const ready = live ? null : (here.filter((f) => f.status === 'ready').sort((a, b) => (a.scheduledAt ?? '9').localeCompare(b.scheduledAt ?? '9'))[0] ?? null);
    const next = here
      .filter((f) => f !== live && f !== ready && (f.status === 'pending' || f.status === 'ready') && f.scheduledAt)
      .sort((a, b) => a.scheduledAt!.localeCompare(b.scheduledAt!))[0];
    return { court: c, live, ready, next };
  });
  const counts = { live: courts.filter((c) => c.live).length, ready: courts.filter((c) => c.ready).length, free: courts.filter((c) => !c.live && !c.ready).length };

  const go = (f: FixtureView) =>
    void start.submit(async () => {
      const { match } = await tournamentsApi.start(f.id);
      router.push({ pathname: '/match/[id]', params: { id: match.id } });
    });

  const events = new Set(list.filter((f) => f.status !== 'completed' && f.status !== 'bye' && f.status !== 'cancelled').map((f) => f.eventId)).size;
  const vs = (f: FixtureView) => `${fixtureSide(f, 0).name} vs ${fixtureSide(f, 1).name}`;
  const pill = (text: string, tone: 'live' | 'good' | 'plain') => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4, paddingHorizontal: 9, borderRadius: 99, backgroundColor: tone === 'live' ? colors.liveBg : tone === 'good' ? colors.goodBg : colors.surface }}>
      {tone === 'live' ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.live }} /> : null}
      <T size={11} w={700} color={tone === 'live' ? colors.liveText : tone === 'good' ? colors.good : colors.fg}>
        {text}
      </T>
    </View>
  );

  return (
    <Screen edgeToEdge px={0} gap={0} refreshing={fixtures.refreshing} onRefresh={fixtures.refresh}>
      <EventHero
        title="Court control"
        sub={`Organizer view · ${t.courts.length} ${t.courts.length === 1 ? 'court' : 'courts'} · ${events} ${events === 1 ? 'event' : 'events'} running · ${clock12(new Date(now))}`}
        fallback={`/tournament/${t.id}`}
        action={{ icon: 'calendar', label: 'Schedule', onPress: () => router.push({ pathname: '/tournament/[id]/schedule', params: { id: t.id } }) }}
      />
      <View style={{ paddingHorizontal: 16, paddingTop: 14, gap: 12 }}>
        <T size={12} color={colors.muted}>
          {counts.live} live · {counts.ready} ready to start · {counts.free} free
        </T>

        {start.formError || fixtures.error ? <Notice tone="error" icon="alert" text={(start.formError ?? fixtures.error)!} /> : null}

        {courts.map(({ court, live, ready, next }) => {
          const f = live ?? ready ?? next ?? null;
          const scorer = court.scorers.length ? `Scorer: ${court.scorers.map((x) => x.name).join(', ')}` : 'No scorer yet';
          const segs = live?.match?.segments ?? [];
          const unit = live ? (live.event.sport.slug === 'tennis' || live.event.sport.slug === 'padel' ? 'S' : 'G') : 'G';
          const right = live
            ? pill(`LIVE · ${unit}${segs.length + 1} ${(live.match?.sides ?? []).map((x) => x.current ?? x.primary).join('–')}`, 'live')
            : ready
              ? pill(ready.scheduledAt ? `Starting ${clock12(ready.scheduledAt)}` : 'Ready', 'plain')
              : next
                ? pill(`Next · ${clock12(next.scheduledAt!)}`, 'plain')
                : pill('Free', 'good');
          const action = live
            ? { label: 'Open score', outline: true, onPress: () => live.match && router.push({ pathname: '/match/[id]/watch', params: { id: live.match.id } }) }
            : ready && court.scorers.length
              ? { label: 'Start match', outline: false, onPress: () => go(ready) }
              : ready
                ? { label: 'Assign scorer', outline: false, onPress: () => router.push({ pathname: '/tournament/[id]/staff', params: { id: t.id } }) }
                : next
                  ? { label: 'Open match', outline: true, onPress: () => router.push({ pathname: '/fixture/[id]', params: { id: next.id } }) }
                  : { label: 'Assign match', outline: false, onPress: () => router.push({ pathname: '/tournament/[id]/schedule', params: { id: t.id } }) };
          return (
            <View key={court.id} style={{ gap: 6, padding: 16, borderRadius: 18, backgroundColor: live ? colors.accentSoft : colors.card, borderWidth: live ? 2 : 1, borderColor: live ? colors.primary : colors.line }}>
              <Row between gap={8}>
                <D size={22} lh={24}>
                  {court.name}
                </D>
                {right}
              </Row>
              {f ? (
                <>
                  <T size={12} color={colors.muted} numberOfLines={1}>
                    {[f.event.name, f.groupName ?? roundCode(f)].filter(Boolean).join(' · ')}
                  </T>
                  <T size={16} w={700} numberOfLines={2}>
                    {vs(f)}
                  </T>
                </>
              ) : (
                <T size={13} color={colors.muted}>
                  Nothing scheduled on this court.
                </T>
              )}
              <Row between gap={10} style={{ marginTop: 6 }}>
                <T size={13} color={colors.muted} flex numberOfLines={1}>
                  {scorer}
                </T>
                <Button
                  label={action.label}
                  variant={action.outline ? 'outline' : undefined}
                  height={44}
                  radius={12}
                  size={14}
                  weight={700}
                  inline
                  px={16}
                  loading={!action.outline && action.label === 'Start match' && start.submitting}
                  onPress={action.onPress}
                />
              </Row>
            </View>
          );
        })}
        {!t.courts.length ? <EmptyState title="No courts yet" body="Add courts under Staff & courts." action={<Button label="Staff & courts" inline height={44} onPress={() => router.push({ pathname: '/tournament/[id]/staff', params: { id: t.id } })} style={{ marginTop: 8 }} />} /> : null}
      </View>
    </Screen>
  );
}
