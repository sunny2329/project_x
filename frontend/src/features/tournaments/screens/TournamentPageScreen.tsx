import { router, useLocalSearchParams } from 'expo-router';
import { Share, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResource } from '@/shared/hooks/useResource';
import { useTheme } from '@/shared/theme';
import { Badge, Button, D, EmptyState, Header, Icon, IconButton, Label, Loading, Row, Screen, T, Tap } from '@/shared/ui';
import { dayMonth, longDateRange, plural } from '@/shared/utils/format';
import { publicTournamentUrl, tournamentsApi } from '../api/tournaments.api';
import { drawSummary, entriesNoun } from '../components/TournamentBits';
import { statusBadge } from '../status';

/** A tournament for players: dates, venue, organizer, its events; Register in the bar below. */
export default function TournamentPageScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, loading, refreshing, refresh } = useResource(() => tournamentsApi.get(id), [id]);

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

  const badge = statusBadge(t.status);
  const open = t.events.filter((e) => e.status === 'registration_open' && (e.maxEntries === null || e.approvedEntries + e.pendingEntries < e.maxEntries) && !e.myEntry);
  const stripe = t.events.length ? t.events.map((e) => e.sport.accentColor) : [colors.primary];
  const share = () => void Share.share({ message: `${t.name}\n${publicTournamentUrl(t.slug)}`, url: publicTournamentUrl(t.slug) });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 20, paddingBottom: 22, backgroundColor: colors.accentDeep, gap: 16, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, flexDirection: 'row' }}>
          {stripe.map((c, i) => (
            <View key={i} style={{ flex: 1, backgroundColor: c }} />
          ))}
        </View>
        <Row between>
          <IconButton icon="back" label="Back" tone="translucent" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} onPress={() => router.back()} />
          <Row gap={8}>
            {t.isOrganizer || t.isStaff ? (
              <Button label="Manage" variant="outline" height={44} radius={14} size={14} inline onPress={() => router.push({ pathname: '/tournament/[id]/manage', params: { id: t.id } })} />
            ) : null}
            <IconButton icon="share" label="Share tournament" tone="translucent" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} onPress={share} />
          </Row>
        </Row>
        {badge ? <Badge label={badge.label} tone={t.status === 'registration_open' ? 'readySolid' : badge.tone} /> : null}
        <D size={46} lh={44} upper>
          {t.name}
        </D>
        <View style={{ gap: 8 }}>
          {t.startsOn ? (
            <Row gap={10}>
              <Icon name="calendar" size={18} color={colors.soft} />
              <T size={14} color={colors.soft} flex>
                {longDateRange(t.startsOn, t.endsOn)}
                {t.registrationClosesAt ? ` · entries close ${dayMonth(t.registrationClosesAt)}` : ''}
              </T>
            </Row>
          ) : null}
          {t.venue || t.courts.length ? (
            <Row gap={10}>
              <Icon name="pin" size={18} color={colors.soft} />
              <T size={14} color={colors.soft} flex>
                {[t.venue?.name, t.courts.length ? plural(t.courts.length, 'court') : null].filter(Boolean).join(' · ')}
              </T>
            </Row>
          ) : null}
          {t.organizer.name ? (
            <Row gap={10}>
              <Icon name="personSmall" size={18} color={colors.soft} />
              <T size={14} color={colors.soft} flex>
                Run by {t.organizer.name}
              </T>
            </Row>
          ) : null}
        </View>
        {t.description ? (
          <T size={14} color={colors.soft}>
            {t.description}
          </T>
        ) : null}
      </View>

      <Screen
        edgeToEdge
        gap={10}
        contentStyle={{ paddingTop: 18 }}
        refreshing={refreshing}
        onRefresh={refresh}
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
              height={54}
              size={16}
              weight={800}
              inline
              px={28}
              disabled={!open.length && !t.events.some((e) => e.myEntry)}
              onPress={() => (open.length ? router.push({ pathname: '/tournament/[id]/register', params: { id: t.id } }) : router.push('/tournaments/mine'))}
            />
          </Row>
        }
      >
        <Label>{plural(t.events.length, 'event')}</Label>
        {t.events.map((e) => {
          const taken = e.approvedEntries + e.pendingEntries;
          const full = e.maxEntries !== null && taken >= e.maxEntries;
          return (
            <Tap key={e.id} label={e.name} onPress={() => router.push({ pathname: '/event/[id]', params: { id: e.id } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
              <View style={{ width: 4, height: 44, borderRadius: 2, backgroundColor: e.sport.accentColor }} />
              <View style={{ flex: 1, gap: 3 }}>
                <T size={16} w={700} numberOfLines={1}>
                  {e.name}
                </T>
                <T size={13} color={colors.muted} numberOfLines={1}>
                  {[e.sport.name, drawSummary(e), e.maxEntries ? entriesNoun(e.format.playersPerSide, e.maxEntries) : null].filter(Boolean).join(' · ')}
                </T>
                {e.myEntry ? (
                  <Badge label={e.myEntry.status === 'pending' ? 'YOUR ENTRY · PENDING' : 'YOU’RE IN'} tone={e.myEntry.status === 'pending' ? 'pending' : 'good'} size="xs" style={{ marginTop: 2 }} />
                ) : null}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 3 }}>
                {full ? (
                  <>
                    <D size={20} color={colors.bad}>
                      FULL
                    </D>
                    <T size={11} color={colors.muted}>
                      {taken}/{e.maxEntries}
                    </T>
                  </>
                ) : (
                  <>
                    <D size={20}>{e.maxEntries ? `${taken}/${e.maxEntries}` : taken}</D>
                    <T size={11} color={colors.muted}>
                      entries
                    </T>
                  </>
                )}
              </View>
            </Tap>
          );
        })}
        {!t.events.length ? <EmptyState title="No events yet" body="The organizer hasn’t added any events." /> : null}
      </Screen>
    </View>
  );
}
