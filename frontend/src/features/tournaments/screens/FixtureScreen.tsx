import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useResource } from '@/shared/hooks/useResource';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { useTheme } from '@/shared/theme';
import { Avatar, Badge, Button, D, EmptyState, Header, Icon, type IconName, Label, Loading, Notice, RadioDot, Row, Screen, Segmented, Sheet, T, Tap } from '@/shared/ui';
import { clock } from '@/shared/utils/format';
import { tournamentsApi } from '../api/tournaments.api';
import { CourtPickerSheet, TimePickerSheet } from '../components/ScheduleSheets';
import { fixtureSide } from '../components/TournamentBits';
import { UserPickerSheet } from '../components/UserPickerSheet';
import { fixtureBadge } from '../status';
import type { FixtureView } from '../types';
import { fixtureTag } from './ScheduleScreen';

function OptionRow({ icon, title, sub, onPress, last }: { icon: IconName; title: string; sub: string; onPress: () => void; last?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54, paddingHorizontal: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.raised, backgroundColor: pressed ? colors.raised2 : 'transparent' })}>
      <Icon name={icon} size={20} color={colors.fg} />
      <View style={{ flex: 1, paddingVertical: 8 }}>
        <T size={15} w={600}>
          {title}
        </T>
        <T size={12} color={colors.muted}>
          {sub}
        </T>
      </View>
    </Pressable>
  );
}

/** "Winner plays Neel G or Aarav K in QF 2". */
function nextLine(f: FixtureView): string | null {
  if (!f.next) return null;
  const where = f.next.roundName ? `${f.next.roundName} ${f.next.position}` : 'the next round';
  return `Winner plays ${f.next.opponent ?? 'the winner of the other match'} in ${where}`;
}

/** One tournament fixture for staff: players, court & time, scorer, start, walkover, enter result. */
export default function FixtureScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, setData, error, loading, refresh, refreshing } = useResource(() => tournamentsApi.fixture(id), [id], { poll: 10_000 });
  const f = data?.fixture;
  const event = useResource(() => tournamentsApi.event(f!.eventId), [f?.eventId], { enabled: !!f });
  const tournament = useResource(() => tournamentsApi.get(event.data!.event.tournament.id), [event.data?.event.tournament.id], { enabled: !!event.data });
  const [sheet, setSheet] = useState<null | 'court' | 'time' | 'scorer' | 'walkover'>(null);
  const [wo, setWo] = useState<{ absent: number | null; reason: 'walkover' | 'no_show' }>({ absent: null, reason: 'no_show' });
  const action = useSubmit();

  if (loading) return <Loading />;
  if (!f) {
    return (
      <Screen>
        <Header />
        <EmptyState title="Fixture not found" body={error ?? undefined} />
      </Screen>
    );
  }

  const t = tournament.data?.tournament;
  const staff = !!t && (t.isOrganizer || t.isStaff);
  const live = f.match?.status === 'live' || f.status === 'live';
  const badge = fixtureBadge(f.status, f.match?.status);
  const color = f.event.sport.accentColor;
  const court = t?.courts.find((c) => c.id === f.court?.id) ?? null;
  const known = f.entries.every(Boolean);

  const update = (body: { courtId?: string | null; scheduledAt?: string | null }) =>
    void action.submit(async () => {
      const r = await tournamentsApi.schedule(f.id, body);
      setData(r);
    });

  const startMatch = () =>
    void action.submit(async () => {
      if (f.match && live) {
        router.push({ pathname: '/match/[id]', params: { id: f.match.id } });
        return;
      }
      const { match } = await tournamentsApi.start(f.id);
      router.push({ pathname: '/match/[id]', params: { id: match.id } });
    });

  const walkover = () =>
    void action.submit(async () => {
      const winner = wo.absent === -1 ? null : f.entries[1 - wo.absent!]!.id;
      await tournamentsApi.walkover(f.id, winner, wo.reason);
      setSheet(null);
      await refresh();
    });

  return (
    <Screen
      gap={16}
      refreshing={refreshing}
      onRefresh={refresh}
      footer={
        f.status === 'completed' && f.match ? (
          <Button label="View result" weight={800} onPress={() => router.push({ pathname: '/match/[id]/result', params: { id: f.match!.id } })} />
        ) : live && f.match ? (
          staff ? (
            <Button label="Resume scoring" color={color} height={58} radius={18} size={17} weight={800} onPress={startMatch} />
          ) : (
            <Button label="Watch live" weight={800} onPress={() => router.push({ pathname: '/match/[id]/watch', params: { id: f.match!.id } })} />
          )
        ) : staff && known ? (
          <Button label="Start match" color={color} height={58} radius={18} size={17} weight={800} disabled={f.status !== 'ready'} loading={action.submitting} onPress={startMatch} />
        ) : undefined
      }
    >
      <Header
        kicker={[f.event.name, f.stageType === 'knockout' ? f.roundName : f.stageName].filter(Boolean).join(' · ')}
        display={f.stageType === 'knockout' ? `Match ${fixtureTag(f)}` : `${f.groupName ?? 'Group'} match`}
        right={badge ? <Badge label={badge.label} tone={badge.tone} /> : undefined}
      />

      <View style={{ borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' }}>
        {[0, 1].map((i) => {
          const e = f.entries[i];
          const side = fixtureSide(f, i);
          return (
            <View key={i}>
              {i === 1 ? (
                <Row gap={10} style={{ paddingHorizontal: 16 }}>
                  <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
                  <D size={16} color={colors.muted}>
                    VS
                  </D>
                  <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
                </Row>
              ) : null}
              <Row gap={12} style={{ padding: 16 }}>
                {e ? <Avatar name={e.name} id={e.id} size={44} /> : <View style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.line2 }} />}
                <View style={{ flex: 1 }}>
                  <T size={17} w={700} italic={side.placeholder} color={side.placeholder ? colors.faint : colors.fg} numberOfLines={1}>
                    {side.name}
                  </T>
                  {e ? (
                    <T size={12} color={colors.muted}>
                      {e.seed ? `Seed ${e.seed}` : 'Unseeded'} · {Math.round(e.rating)}
                    </T>
                  ) : null}
                </View>
                {f.match && (f.status === 'completed' || live) ? (
                  <D size={22} color={f.winnerEntryId && e?.id !== f.winnerEntryId ? colors.muted : colors.fg}>
                    {f.match.segments.map((s) => s[i]).join(' ')}
                    {live && f.match.sides[i]?.current ? ` ${f.match.sides[i]!.current}` : ''}
                  </D>
                ) : null}
              </Row>
            </View>
          );
        })}
      </View>

      <Row gap={8} style={{ alignItems: 'stretch' }}>
        <Tap label="Court and time" onPress={staff ? () => setSheet('court') : undefined} style={{ flex: 1, padding: 12, borderRadius: 14, backgroundColor: colors.surface, gap: 2 }}>
          <T size={12} color={colors.muted}>
            Court & time
          </T>
          <T size={15} w={700}>
            {[f.court?.name ?? 'No court', f.scheduledAt ? clock(f.scheduledAt) : null].filter(Boolean).join(' · ')}
          </T>
        </Tap>
        <Tap label="Scorer" onPress={staff && court ? () => setSheet('scorer') : undefined} style={{ flex: 1, padding: 12, borderRadius: 14, backgroundColor: colors.surface, gap: 2 }}>
          <T size={12} color={colors.muted}>
            Scorer
          </T>
          <T size={15} w={700} numberOfLines={1}>
            {f.court?.scorers.length ? f.court.scorers.map((s) => s.name).join(', ') : f.court ? 'Any staff' : 'Pick a court first'}
          </T>
        </Tap>
      </Row>
      {staff && f.status !== 'completed' ? (
        <Row gap={8}>
          <Button label={f.scheduledAt ? 'Change time' : 'Pick time'} icon="clock" variant="raised" height={40} radius={10} size={13} style={{ flex: 1 }} onPress={() => setSheet('time')} />
          <Button label={f.court ? 'Change court' : 'Pick court'} icon="courtHalf" variant="raised" height={40} radius={10} size={13} style={{ flex: 1 }} onPress={() => setSheet('court')} />
        </Row>
      ) : null}

      {nextLine(f) ? (
        <Row gap={10}>
          <Icon name="arrowRight" size={18} color={colors.muted} />
          <T size={13} color={colors.muted} flex>
            {nextLine(f)}
          </T>
        </Row>
      ) : null}

      {action.formError ? <Notice tone="error" icon="alert" text={action.formError} /> : null}

      {staff && known && f.status !== 'completed' && !live ? (
        <View style={{ gap: 8 }}>
          <Label>If they don’t play</Label>
          <View style={{ borderRadius: 16, backgroundColor: colors.surface, overflow: 'hidden' }}>
            <OptionRow icon="flag" title="Walkover or no-show" sub="Pick who didn’t turn up. Ratings don’t change." onPress={() => setSheet('walkover')} />
            <OptionRow icon="pen" title="Enter result" sub="If it was played but not scored live" onPress={() => router.push({ pathname: '/fixture/[id]/result', params: { id: f.id } })} last />
          </View>
        </View>
      ) : null}

      {t ? (
        <>
          <CourtPickerSheet
            visible={sheet === 'court'}
            courts={t.courts}
            current={f.court?.id ?? null}
            onClose={() => setSheet(null)}
            onPick={(courtId) => {
              setSheet(null);
              update({ courtId });
            }}
          />
          <TimePickerSheet
            visible={sheet === 'time'}
            day={(f.scheduledAt ?? t.startsOn ?? new Date().toISOString()).slice(0, 10)}
            current={f.scheduledAt}
            onClose={() => setSheet(null)}
            onPick={(iso) => {
              setSheet(null);
              update({ scheduledAt: iso });
            }}
          />
        </>
      ) : null}
      {court ? (
        <UserPickerSheet
          visible={sheet === 'scorer'}
          title={`Scorer for ${court.name}`}
          sub="They score every match on this court."
          actionLabel="Assign"
          onClose={() => setSheet(null)}
          onPick={(u) => {
            setSheet(null);
            void action.submit(async () => {
              await tournamentsApi.assignCourtScorer(court.id, u.id, true);
              await Promise.all([tournament.reload(), refresh()]);
            });
          }}
        />
      ) : null}

      <Sheet visible={sheet === 'walkover'} onClose={() => setSheet(null)}>
        <D size={30} upper>
          Didn’t play
        </D>
        <Segmented
          options={[
            { value: 'no_show', label: 'No-show' },
            { value: 'walkover', label: 'Walkover' },
          ]}
          value={wo.reason}
          onChange={(reason) => setWo((w) => ({ ...w, reason }))}
          tray={colors.bg}
          height={42}
          size={14}
        />
        {[0, 1, -1].map((i) => {
          const on = wo.absent === i;
          const label = i === -1 ? 'Neither turned up' : `${fixtureSide(f, i).name} didn’t turn up`;
          return (
            <Tap key={i} label={label} onPress={() => setWo((w) => ({ ...w, absent: i }))} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, backgroundColor: colors.bg, borderWidth: on ? 1.5 : 1, borderColor: on ? colors.primary : colors.line }}>
              <RadioDot on={on} />
              <T size={15} w={600} flex>
                {label}
              </T>
            </Tap>
          );
        })}
        {wo.absent !== null && wo.absent >= 0 ? (
          <T size={13} color={colors.muted}>
            {fixtureSide(f, 1 - wo.absent).name} go through. Counts in standings, not in ratings.
          </T>
        ) : null}
        <Button label="Record it" disabled={wo.absent === null} loading={action.submitting} onPress={walkover} />
      </Sheet>
    </Screen>
  );
}
