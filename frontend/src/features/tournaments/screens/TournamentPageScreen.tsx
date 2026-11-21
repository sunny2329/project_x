import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useResource } from '@/shared/hooks/useResource';
import { useTheme } from '@/shared/theme';
import { Badge, Button, D, EmptyState, Header, Loading, Row, Screen, T, Tap } from '@/shared/ui';
import { dayMonth, longDateRange, plural } from '@/shared/utils/format';
import { tournamentsApi } from '../api/tournaments.api';
import { drawSummary } from '../components/TournamentBits';
import { EventHero, shareTournament } from '../components/TournamentV2';
import { categoryStatus, type HubTone, progress } from '../hub';
import { statusBadge } from '../status';

/**
 * Tournament hub (design v2 "Multi-sport event hub"): orange header with event progress, sport
 * filter, a card per category with what's happening in it; Register in the bar below.
 */
export default function TournamentPageScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, loading, refreshing, refresh } = useResource(() => tournamentsApi.get(id), [id]);
  const fixtures = useResource(() => tournamentsApi.fixtures(id).catch(() => ({ fixtures: [] })), [id], { poll: 20_000 });
  const [sport, setSport] = useState('all');

  if (loading) return <Loading />;
  const t = data?.tournament;
  if (!t) {
    return (
      <Screen>
        <Header />
        <EmptyState title="Tournament not found" body={error ?? undefined} />
      </Screen>
    );
  }

  const list = fixtures.data?.fixtures ?? [];
  const open = t.events.filter((e) => e.status === 'registration_open' && (e.maxEntries === null || e.approvedEntries + e.pendingEntries < e.maxEntries) && !e.myEntry);
  const sports = [...new Map(t.events.map((e) => [e.sport.slug, e.sport.name])).entries()];
  const shown = sport === 'all' ? t.events : t.events.filter((e) => e.sport.slug === sport);
  const done = progress(list);
  const badge = statusBadge(t.status);
  const sub = [
    t.startsOn ? longDateRange(t.startsOn, t.endsOn) : null,
    sports.length > 1 ? plural(sports.length, 'sport') : sports[0]?.[1],
    plural(t.events.length, 'category', 'categories'),
    t.courts.length ? plural(t.courts.length, 'court') : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const tone = (x: HubTone) =>
    ({
      live: { bg: colors.liveBg, fg: colors.liveText },
      progress: { bg: colors.accentSoft, fg: colors.accentText },
      next: { bg: colors.accentSoft, fg: colors.accentText },
      open: { bg: colors.goodBg, fg: colors.good },
      done: { bg: colors.goodBg, fg: colors.good },
      plain: { bg: colors.surface, fg: colors.muted },
    })[x];

  return (
    <Screen
      edgeToEdge
      px={0}
      gap={0}
      refreshing={refreshing || fixtures.refreshing}
      onRefresh={() => {
        refresh();
        fixtures.refresh();
      }}
      footerBar
      footer={
        <Row gap={12}>
          <View style={{ flex: 1 }}>
            <T size={13} color={colors.muted}>
              Entry fee
            </T>
            <T size={15} w={700}>
              {t.entryFee ? `${t.entryFee} per player` : 'Free'}
            </T>
          </View>
          <Button
            label={t.events.some((e) => e.myEntry) && !open.length ? 'My matches' : 'Register'}
            height={52}
            size={16}
            weight={700}
            inline
            px={28}
            disabled={!open.length && !t.events.some((e) => e.myEntry)}
            onPress={() => (open.length ? router.push({ pathname: '/tournament/[id]/register', params: { id: t.id } }) : router.push('/tournaments/mine'))}
          />
        </Row>
      }
    >
      <EventHero title={t.name} sub={sub} action={{ icon: 'share', label: 'Share tournament', onPress: () => shareTournament(t.name, t.slug) }}>
        <View style={{ gap: 8, paddingHorizontal: 4, paddingBottom: 6 }}>
          {done ? (
            <>
              <Row between>
                <T size={13} color={colors.heroMuted}>
                  Event progress
                </T>
                <T size={13} w={700} color={colors.onHero}>
                  {done.text}
                </T>
              </Row>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.heroChip, overflow: 'hidden' }}>
                <View style={{ width: `${Math.round((done.done / done.total) * 100)}%`, height: 8, borderRadius: 4, backgroundColor: colors.onHero }} />
              </View>
            </>
          ) : (
            <Row gap={8} style={{ flexWrap: 'wrap' }}>
              {badge ? (
                <View style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 99, backgroundColor: colors.heroChip }}>
                  <T size={12} w={700} color={colors.onHero}>
                    {badge.label}
                  </T>
                </View>
              ) : null}
              {t.venue ? (
                <T size={13} color={colors.heroMuted}>
                  {t.venue.name}
                </T>
              ) : null}
              {t.registrationClosesAt ? (
                <T size={13} color={colors.heroMuted}>
                  Entries close {dayMonth(t.registrationClosesAt)}
                </T>
              ) : null}
            </Row>
          )}
          {t.isOrganizer || t.isStaff ? (
            <Row gap={8}>
              {[
                { label: 'Manage', go: () => router.push({ pathname: '/tournament/[id]/manage', params: { id: t.id } }) },
                ...(t.courts.length ? [{ label: 'Court control', go: () => router.push({ pathname: '/tournament/[id]/courts', params: { id: t.id } }) }] : []),
              ].map((b) => (
                <Tap key={b.label} label={b.label} onPress={b.go} style={{ height: 34, paddingHorizontal: 14, borderRadius: 17, justifyContent: 'center', backgroundColor: colors.heroChip }}>
                  <T size={13} w={700} color={colors.onHero}>
                    {b.label}
                  </T>
                </Tap>
              ))}
            </Row>
          ) : null}
        </View>
      </EventHero>

      <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 10 }}>
        {t.description ? (
          <T size={14} lh={20} color={colors.muted}>
            {t.description}
          </T>
        ) : null}
        {sports.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {[['all', 'All'] as [string, string], ...sports].map(([slug, label]) => {
              const on = slug === sport;
              return (
                <Pressable key={slug} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => setSport(slug)} style={{ height: 44, paddingHorizontal: 16, borderRadius: 22, justifyContent: 'center', backgroundColor: on ? colors.primary : colors.card, borderWidth: 1, borderColor: on ? colors.primary : colors.line }}>
                  <T size={14} w={700} color={on ? colors.onPrimary : colors.fg}>
                    {label}
                  </T>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {shown.map((e) => {
          const st = categoryStatus(e, list);
          const c = tone(st.tone);
          return (
            <Tap key={e.id} label={e.name} onPress={() => router.push({ pathname: '/event/[id]', params: { id: e.id } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line }}>
              <View style={{ flex: 1, gap: 2 }}>
                <T size={12} color={colors.muted} numberOfLines={1}>
                  {e.sport.name} · {drawSummary(e)}
                </T>
                <D size={20} lh={22} numberOfLines={1}>
                  {e.name}
                </D>
                <T size={13} color={colors.muted} numberOfLines={1}>
                  {st.line}
                </T>
                {e.myEntry ? <Badge label={e.myEntry.status === 'pending' ? 'Your entry · pending' : 'You’re in'} tone={e.myEntry.status === 'pending' ? 'pending' : 'good'} size="xs" style={{ marginTop: 4 }} /> : null}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4, paddingHorizontal: 9, borderRadius: 99, backgroundColor: c.bg }}>
                {st.tone === 'live' ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.live }} /> : null}
                <T size={11} w={700} color={c.fg}>
                  {st.badge}
                </T>
              </View>
            </Tap>
          );
        })}
        {!t.events.length ? <EmptyState title="No categories yet" body="The organizer hasn’t added any categories." /> : null}
        {t.organizer.name ? (
          <T size={12} color={colors.muted} center style={{ marginTop: 6 }}>
            Run by {t.organizer.name}
          </T>
        ) : null}
      </View>
    </Screen>
  );
}
