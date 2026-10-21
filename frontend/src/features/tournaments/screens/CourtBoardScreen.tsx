import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { useNow } from '@/shared/hooks/useNow';
import { useResource } from '@/shared/hooks/useResource';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { LIVE, READY, sportText, useTheme } from '@/shared/theme';
import { Badge, Button, D, EmptyState, Header, Loading, Notice, Row, Screen, T, Tap } from '@/shared/ui';
import { clock, clock12, weekdayDayMonth } from '@/shared/utils/format';
import { tournamentsApi } from '../api/tournaments.api';
import { fixtureSide } from '../components/TournamentBits';
import type { FixtureView } from '../types';
import { fixtureTag } from './ScheduleScreen';

const isLive = (f: FixtureView) => f.match?.status === 'live' || f.status === 'live';
const short = (f: FixtureView, i: number) => fixtureSide(f, i).name.split(' / ').map((p) => p.split(' ')[0]).join(' / ');

/** Match day at a glance: every court with what's on it now, what's ready, and what's next. */
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

  return (
    <Screen gap={14} refreshing={fixtures.refreshing} onRefresh={fixtures.refresh}>
      <Header kicker={`${weekdayDayMonth(new Date(now))} · ${clock12(new Date(now))}`} display="Court board" right={<Button label="Schedule" variant="surface" height={40} radius={12} size={13} inline px={12} onPress={() => router.push({ pathname: '/tournament/[id]/schedule', params: { id: t.id } })} />} />

      <Row gap={8}>
        {[
          { n: counts.live, label: 'Live', bg: 'rgba(255,84,104,0.12)', fg: colors.bad },
          { n: counts.ready, label: 'Ready to start', bg: 'rgba(74,222,128,0.1)', fg: colors.good },
          { n: counts.free, label: 'Free', bg: colors.surface, fg: colors.fg },
        ].map((s) => (
          <View key={s.label} style={{ flex: 1, padding: 10, borderRadius: 12, backgroundColor: s.bg }}>
            <D size={26} lh={26} color={s.fg}>
              {s.n}
            </D>
            <T size={12} color={colors.soft}>
              {s.label}
            </T>
          </View>
        ))}
      </Row>

      {start.formError || fixtures.error ? <Notice tone="error" icon="alert" text={(start.formError ?? fixtures.error)!} /> : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {courts.map(({ court, live, ready, next }) => {
          const scorer = court.scorers.length ? court.scorers.map((s) => s.name).join(', ') : 'any staff';
          const nextLine = next ? `Next: ${fixtureTag(next)} · ${clock(next.scheduledAt!)}` : null;
          const card = { width: '48%' as const, flexGrow: 1, minHeight: 196, gap: 10, padding: 12, borderRadius: 16 };
          if (live) {
            const segs = live.match?.segments ?? [];
            return (
              <Tap key={court.id} label={`${court.name}, live`} onPress={() => live.match && router.push({ pathname: '/match/[id]/watch', params: { id: live.match.id } })} style={{ ...card, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: LIVE }}>
                <Row between>
                  <D size={22} upper>
                    {court.name}
                  </D>
                  <Badge label="LIVE" tone="live" size="xs" />
                </Row>
                <View style={{ gap: 6 }}>
                  {[0, 1].map((i) => (
                    <Row key={i} between gap={6}>
                      <T size={13} w={i === 0 ? 700 : 400} color={i === 0 ? colors.fg : colors.soft} flex numberOfLines={1}>
                        {short(live, i)}
                      </T>
                      <D size={22} color={i === 0 ? colors.fg : colors.soft}>
                        {segs.map((s) => s[i]).join(' ')}
                        {live.match?.sides[i]?.current ? (
                          <D size={22} color={i === 0 ? sportText(colors, live.event.sport.slug) : colors.soft}>
                            {segs.length ? ' ' : ''}
                            {live.match.sides[i]!.current}
                          </D>
                        ) : null}
                      </D>
                    </Row>
                  ))}
                </View>
                <T size={12} color={colors.muted} style={{ marginTop: 'auto' }}>
                  Scorer · {scorer}
                  {nextLine ? `\n${nextLine}` : ''}
                </T>
              </Tap>
            );
          }
          if (ready) {
            return (
              <Tap key={court.id} label={`${court.name}, ready`} onPress={() => router.push({ pathname: '/fixture/[id]', params: { id: ready.id } })} style={{ ...card, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: READY }}>
                <Row between>
                  <D size={22} upper>
                    {court.name}
                  </D>
                  <Badge label="READY" tone="ready" size="xs" />
                </Row>
                <T size={13} w={600} lh={19}>
                  {short(ready, 0)}
                  {'\n'}v {short(ready, 1)}
                </T>
                <Button label="Start" color={READY} height={38} radius={10} size={13} weight={800} style={{ marginTop: 'auto' }} loading={start.submitting} onPress={() => go(ready)} />
              </Tap>
            );
          }
          return (
            <View key={court.id} style={{ ...card, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line2 }}>
              <Row between>
                <D size={22} upper>
                  {court.name}
                </D>
                <T size={10} w={800} color={colors.muted}>
                  FREE
                </T>
              </Row>
              <T size={13} lh={19} color={colors.muted}>
                {next && Date.parse(next.scheduledAt!) > now ? `Nothing scheduled until ${clock(next.scheduledAt!)}` : 'Nothing scheduled'}
              </T>
              <Button label="Move a match here" variant="outline" height={38} radius={10} size={13} style={{ marginTop: 'auto' }} onPress={() => router.push({ pathname: '/tournament/[id]/schedule', params: { id: t.id } })} />
            </View>
          );
        })}
      </View>
      {!t.courts.length ? <EmptyState title="No courts yet" body="Add courts under Staff & courts." action={<Button label="Staff & courts" inline height={44} onPress={() => router.push({ pathname: '/tournament/[id]/staff', params: { id: t.id } })} style={{ marginTop: 8 }} />} /> : null}
    </Screen>
  );
}
