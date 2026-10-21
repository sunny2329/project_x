import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useResource } from '@/shared/hooks/useResource';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { LIVE, READY, useTheme } from '@/shared/theme';
import { Badge, Button, EmptyState, Header, Icon, Loading, Notice, Row, Screen, Segmented, T, Tap } from '@/shared/ui';
import { clock } from '@/shared/utils/format';
import { tournamentsApi } from '../api/tournaments.api';
import { FixtureCard, fixtureSide } from '../components/TournamentBits';
import type { FixtureView } from '../types';

type Tab = 'playing' | 'scoring';

function sideText(f: FixtureView, i: number, myId?: string): string {
  const e = f.entries[i];
  if (!e) return fixtureSide(f, i).name;
  return e.players.map((p) => (p.userId === myId ? 'You' : p.displayName)).join(' / ');
}

/** A READY fixture I play in: who, court and time. */
function ReadyCard({ f, myId }: { f: FixtureView; myId?: string }) {
  const { colors } = useTheme();
  return (
    <Tap label="Fixture" onPress={() => router.push({ pathname: '/fixture/[id]', params: { id: f.id } })} style={{ gap: 10, padding: 14, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
      <Row between gap={8}>
        <T size={12} color={colors.muted} flex numberOfLines={1}>
          {[f.event.name, f.groupName ?? f.roundName].filter(Boolean).join(' · ')}
        </T>
        <Badge label="READY" tone="ready" size="xs" />
      </Row>
      <T size={15} w={700}>
        {sideText(f, 0, myId)} vs {sideText(f, 1, myId)}
      </T>
      <Row gap={14}>
        {f.court ? (
          <Row gap={6}>
            <Icon name="court" size={16} color={colors.soft} />
            <T size={13} color={colors.soft}>
              {f.court.name}
            </T>
          </Row>
        ) : null}
        {f.scheduledAt ? (
          <Row gap={6}>
            <Icon name="clock" size={16} color={colors.soft} />
            <T size={13} color={colors.soft}>
              {clock(f.scheduledAt)}
            </T>
          </Row>
        ) : null}
        {!f.court && !f.scheduledAt ? (
          <T size={13} color={colors.soft}>
            Court and time to be announced
          </T>
        ) : null}
      </Row>
    </Tap>
  );
}

/** My tournament matches (Playing) and fixtures I'm the scorer for (Scoring duties). */
export default function MyMatchesScreen() {
  const { colors } = useTheme();
  const me = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<Tab>('playing');
  const { data, setData, error, loading, refreshing, refresh, reload } = useResource(() => tournamentsApi.myMatches(), [], { poll: 15_000 });
  const action = useSubmit();

  if (loading) return <Loading />;
  const d = data ?? { playing: [], pendingEntries: [], scoring: [], courts: [], upcoming: [] };
  const duties = d.scoring.length;

  const start = (f: FixtureView) =>
    void action.submit(async () => {
      if (f.match?.status === 'live') {
        router.push({ pathname: '/match/[id]', params: { id: f.match.id } });
        return;
      }
      const { match } = await tournamentsApi.start(f.id);
      router.push({ pathname: '/match/[id]', params: { id: match.id } });
    });

  return (
    <Screen gap={16} refreshing={refreshing} onRefresh={refresh}>
      <Header display="My matches" displaySize={32} />

      <Segmented<Tab>
        options={[
          { value: 'playing', label: 'Playing' },
          {
            value: 'scoring',
            label: 'Scoring duties',
            badge: duties ? (
              <View style={{ minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: LIVE, alignItems: 'center', justifyContent: 'center' }}>
                <T size={12} w={800} color={colors.ink}>
                  {duties}
                </T>
              </View>
            ) : undefined,
          },
        ]}
        value={tab}
        onChange={setTab}
      />

      {error || action.formError ? <Notice tone="error" icon="alert" text={(error ?? action.formError)!} /> : null}

      {tab === 'playing' ? (
        <View style={{ gap: 10 }}>
          {d.playing.map((f) =>
            f.match?.status === 'live' || f.status === 'live' ? <FixtureCard key={f.id} fixture={f} withEvent mineIds={me ? [me.id] : []} /> : <ReadyCard key={f.id} f={f} myId={me?.id} />,
          )}
          {d.pendingEntries.map((e) => (
            <View key={e.id} style={{ gap: 6, padding: 14, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line2 }}>
              <Row between gap={8}>
                <T size={12} color={colors.muted} flex numberOfLines={1}>
                  {e.event.name} · {e.tournament.name}
                </T>
                <Badge label="PENDING" tone="pending" size="xs" />
              </Row>
              <T size={15} w={600}>
                Entry waiting for organizer approval
              </T>
              <Button
                label="Withdraw"
                variant="outline"
                height={34}
                radius={10}
                size={13}
                inline
                px={12}
                textColor={colors.bad}
                onPress={() =>
                  void action.submit(async () => {
                    await tournamentsApi.updateEntry(e.id, { status: 'withdrawn' });
                    setData({ ...d, pendingEntries: d.pendingEntries.filter((x) => x.id !== e.id) });
                    void reload();
                  })
                }
              />
            </View>
          ))}
          {!d.playing.length && !d.pendingEntries.length ? (
            <EmptyState title="No matches right now" body="Ready and live tournament matches you play in show up here." action={<Button label="Find a tournament" variant="outline" inline height={44} onPress={() => router.navigate('/tournaments')} style={{ marginTop: 8 }} />} />
          ) : null}
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {d.courts.length ? (
            <Row gap={10} style={{ paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: colors.raised }}>
              <Icon name="court" size={18} color={colors.fg} />
              <T size={14} flex>
                You’re the scorer for{' '}
                <T size={14} w={700}>
                  {d.courts.map((c) => c.name).join(', ')}
                </T>{' '}
                today
              </T>
            </Row>
          ) : null}
          {d.scoring.map((f) => {
            const live = f.match?.status === 'live';
            return (
              <View key={f.id} style={{ gap: 10, padding: 14, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: live ? LIVE : READY }}>
                <Row between gap={8}>
                  <T size={12} color={colors.muted} flex numberOfLines={1}>
                    {[f.event.name, f.groupName ?? f.roundName, f.court?.name].filter(Boolean).join(' · ')}
                  </T>
                  <Badge label={live ? 'LIVE' : 'READY'} tone={live ? 'live' : 'ready'} size="xs" />
                </Row>
                <T size={15} w={700}>
                  {sideText(f, 0)} vs {sideText(f, 1)}
                </T>
                <Button label={live ? 'Resume scoring' : 'Start match'} color={f.event.sport.accentColor} height={50} radius={14} size={15} weight={800} loading={action.submitting} onPress={() => start(f)} />
              </View>
            );
          })}
          {d.upcoming.map((f) => (
            <View key={f.id} style={{ gap: 6, padding: 14, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line }}>
              <T size={12} color={colors.muted}>
                Next on {f.court?.name ?? 'your court'} · {f.roundName ?? f.stageName}
              </T>
              <T size={15} w={600} color={colors.soft}>
                {fixtureSide(f, 0).name} vs {fixtureSide(f, 1).name}
              </T>
            </View>
          ))}
          {!duties && !d.upcoming.length ? <EmptyState title="No scoring duties" body={d.courts.length ? `Nothing ready on ${d.courts.length === 1 ? 'your court' : 'your courts'} yet.` : 'When an organizer makes you a court scorer, matches to score show up here.'} /> : null}
        </View>
      )}
    </Screen>
  );
}
