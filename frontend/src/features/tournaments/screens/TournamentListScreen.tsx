import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useResource } from '@/shared/hooks/useResource';
import { useTheme, withAlpha } from '@/shared/theme';
import { Badge, Button, Chip, D, EmptyState, Icon, Loading, Notice, Row, Screen, sportIcon, T, Tap } from '@/shared/ui';
import { dateRange, dayMonth, plural } from '@/shared/utils/format';
import { tournamentsApi } from '../api/tournaments.api';
import { statusBadge, tournamentStatusLabel } from '../status';
import type { TournamentListItem } from '../types';

type Filter = 'open' | 'live' | 'mine';

/** The big orange card for a tournament open for entries. */
function FeaturedCard({ t }: { t: TournamentListItem }) {
  const { colors } = useTheme();
  const badge = statusBadge(t.status);
  const year = t.startsOn ? t.startsOn.slice(2, 4) : '';
  return (
    <Tap label={t.name} onPress={() => router.push({ pathname: '/tournament/[id]', params: { id: t.id } })} style={{ gap: 14, padding: 18, borderRadius: 22, backgroundColor: colors.accentDeep, borderWidth: 1, borderColor: colors.accentLine, overflow: 'hidden' }}>
      {year ? (
        <D size={150} lh={150} color={colors.accentTint} style={{ position: 'absolute', right: -10, top: -26 }}>
          {year}
        </D>
      ) : null}
      <Row gap={8}>
        {badge ? <Badge label={badge.label} tone={t.status === 'registration_open' ? 'readySolid' : badge.tone} /> : null}
        {t.registrationClosesAt && t.status === 'registration_open' ? (
          <T size={12} color={colors.soft}>
            Closes {dayMonth(t.registrationClosesAt)}
          </T>
        ) : null}
      </Row>
      <View style={{ gap: 4 }}>
        <D size={36} lh={34} upper>
          {t.name}
        </D>
        <T size={14} color={colors.soft}>
          {[dateRange(t.startsOn, t.endsOn), t.venue?.name].filter(Boolean).join(' · ')}
        </T>
      </View>
      {t.events.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {t.events.map((e) => (
            <View key={e.id} style={{ height: 28, paddingHorizontal: 10, borderRadius: 8, backgroundColor: withAlpha(e.sport.accentColor, 0.18), flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: e.sport.accentColor }} />
              <T size={12} w={600}>
                {e.name}
              </T>
            </View>
          ))}
        </View>
      ) : null}
      <Row between>
        <T size={13} color={colors.soft}>
          {t.capacity ? `${t.entries} of ${t.capacity} places taken` : plural(t.entries, 'entry', 'entries')}
        </T>
        <T size={13} w={700}>
          View →
        </T>
      </Row>
    </Tap>
  );
}

function RowCard({ t }: { t: TournamentListItem }) {
  const { colors } = useTheme();
  const sport = t.sports[0];
  const color = sport?.accentColor ?? colors.primary;
  const liveEvent = t.live && t.events.length === 1 ? t.events[0] : null;
  return (
    <Tap
      label={t.name}
      onPress={() => (liveEvent ? router.push({ pathname: '/event/[id]/bracket', params: { id: liveEvent.id } }) : router.push({ pathname: '/tournament/[id]', params: { id: t.id } }))}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}
    >
      <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: withAlpha(color, 0.16), alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={sport ? sportIcon(sport.slug) : 'trophy'} size={24} color={color} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <T size={15} w={700} numberOfLines={1}>
          {t.name}
        </T>
        {t.live ? (
          <Row gap={6}>
            <Badge label="LIVE" tone="live" size="xs" />
            <T size={13} color={colors.muted} numberOfLines={1} flex>
              {[t.live.rounds.join(', '), t.live.courtsInUse ? plural(t.live.courtsInUse, 'court') : null].filter(Boolean).join(' · ')}
            </T>
          </Row>
        ) : (
          <T size={13} color={colors.muted} numberOfLines={1}>
            {[dateRange(t.startsOn, t.endsOn), t.venue?.name, t.visibility === 'public' ? 'Open' : t.visibility === 'unlisted' ? 'Unlisted' : 'Private'].filter(Boolean).join(' · ')}
          </T>
        )}
      </View>
      <Icon name="chevronRight" size={20} color={colors.muted} />
    </Tap>
  );
}

/** Tournaments tab: open for entries, live now, mine; My matches; create; what I organize. */
export default function TournamentListScreen() {
  const { colors } = useTheme();
  const [filter, setFilter] = useState<Filter>('open');
  const list = useResource(() => tournamentsApi.list(filter), [filter]);
  const mine = useResource(() => tournamentsApi.list('mine'), []);

  const items = list.data?.tournaments ?? [];
  const organizing = (mine.data?.tournaments ?? []).filter((t) => t.isOrganizer);
  const featured = filter === 'open' ? items.find((t) => t.status === 'registration_open') : undefined;
  const rest = items.filter((t) => t !== featured);

  return (
    <Screen gap={14} refreshing={list.refreshing} onRefresh={list.refresh}>
      <Row between>
        <D size={40} upper accessibilityRole="header">
          Tournaments
        </D>
        <Button label="Create" icon="plus" height={40} radius={12} size={14} weight={700} inline px={14} onPress={() => router.push('/tournament/new')} />
      </Row>

      <Row gap={8}>
        <Chip label="Open" active={filter === 'open'} onPress={() => setFilter('open')} />
        <Chip label="Live now" active={filter === 'live'} onPress={() => setFilter('live')} />
        <Chip label="Mine" active={filter === 'mine'} onPress={() => setFilter('mine')} />
        <Chip label="My matches" onPress={() => router.push('/tournaments/mine')} style={{ marginLeft: 'auto', paddingHorizontal: 12 }} />
      </Row>

      {list.error ? <Notice tone="error" icon="alert" text={list.error} /> : null}
      {list.loading ? <Loading /> : null}

      {featured ? <FeaturedCard t={featured} /> : null}
      {rest.map((t) => (
        <RowCard key={t.id} t={t} />
      ))}
      {!list.loading && !items.length ? (
        <EmptyState
          title={filter === 'live' ? 'Nothing live right now' : filter === 'mine' ? 'No tournaments yet' : 'No open tournaments'}
          body={filter === 'mine' ? 'Tournaments you enter, run or score show up here.' : 'Check back soon, or run your own.'}
        />
      ) : null}

      {organizing.length && filter !== 'mine' ? (
        <Tap
          label={`You’re organizing ${organizing.length}`}
          onPress={() => (organizing.length === 1 ? router.push({ pathname: '/tournament/[id]/manage', params: { id: organizing[0]!.id } }) : setFilter('mine'))}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line2 }}
        >
          <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: colors.raised, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="sliders" size={22} color={colors.fg} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <T size={15} w={700}>
              You’re organizing {organizing.length}
            </T>
            <T size={13} color={colors.muted} numberOfLines={1}>
              {organizing.map((t) => `${t.name} · ${tournamentStatusLabel(t.status)}`).join(', ')}
            </T>
          </View>
          <Icon name="chevronRight" size={20} color={colors.muted} />
        </Tap>
      ) : null}
    </Screen>
  );
}
