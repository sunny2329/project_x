import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useResource } from '@/shared/hooks/useResource';
import { Button, EmptyState, Header, Label, Loading, Notice, Row, Screen } from '@/shared/ui';
import { parseDay } from '@/shared/utils/format';
import { tournamentsApi } from '../api/tournaments.api';
import { drawSummary, EventTabs, FixtureCard, InfoChip } from '../components/TournamentBits';
import { statusBadge } from '../status';
import type { FixtureView } from '../types';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ORDER: Record<string, number> = { live: 0, ready: 1, pending: 3, completed: 2, bye: 4, cancelled: 5 };

/** "SATURDAY · GROUP STAGE" sections, live and ready fixtures first inside each. */
export function sectionFixtures(fixtures: FixtureView[]): { title: string; items: FixtureView[] }[] {
  const sorted = [...fixtures].sort(
    (a, b) =>
      (a.scheduledAt ?? '9').localeCompare(b.scheduledAt ?? '9') ||
      a.round - b.round ||
      (ORDER[a.match?.status === 'live' ? 'live' : a.status] ?? 9) - (ORDER[b.match?.status === 'live' ? 'live' : b.status] ?? 9) ||
      a.position - b.position,
  );
  const out: { title: string; items: FixtureView[] }[] = [];
  for (const f of sorted) {
    const day = f.scheduledAt ? DAYS[parseDay(f.scheduledAt.slice(0, 10)).getDay()]! : null;
    const title = [day, f.stageType === 'knockout' ? (f.roundName ?? f.stageName) : f.stageName].filter(Boolean).join(' · ').toUpperCase();
    if (out.at(-1)?.title !== title) out.push({ title, items: [] });
    out.at(-1)!.items.push(f);
  }
  return out;
}

/** An event: status, rules, draw format; tabs for Matches, Groups, Bracket and Entries. */
export default function EventPageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useAuthStore((s) => s.user);
  const { data, error, loading, refreshing, refresh } = useResource(() => tournamentsApi.event(id), [id], { poll: 15_000 });
  const event = data?.event;
  const sections = useMemo(() => (event ? sectionFixtures(event.fixtures.filter((f) => f.status !== 'bye')) : []), [event]);

  if (loading) return <Loading />;
  if (!event) {
    return (
      <Screen>
        <Header />
        <EmptyState title="Event not found" body={error ?? undefined} />
      </Screen>
    );
  }

  const badge = statusBadge(event.status, 'event');
  const canRegister = event.status === 'registration_open' && !event.myEntryId;

  return (
    <Screen gap={14} refreshing={refreshing} onRefresh={refresh}>
      <Header kicker={event.tournament.name} display={event.name} />

      <Row gap={6} style={{ flexWrap: 'wrap' }}>
        {badge ? <InfoChip label={badge.label} tone={event.status === 'in_progress' ? 'progress' : event.status === 'registration_open' ? 'ready' : undefined} /> : null}
        <InfoChip label={event.ruleset.name} dot={event.sport.accentColor} />
        <InfoChip label={drawSummary(event)} />
      </Row>

      <EventTabs event={event} active="matches" />

      {error ? <Notice tone="error" icon="alert" text={error} /> : null}

      {sections.map((s) => (
        <View key={s.title} style={{ gap: 8 }}>
          {s.title ? <Label>{s.title}</Label> : null}
          {s.items.map((f) => (
            <FixtureCard key={f.id} fixture={f} mineIds={me ? [me.id] : []} />
          ))}
        </View>
      ))}

      {!event.fixtures.length ? (
        <EmptyState
          title="The draw isn’t out yet"
          body={`${event.entries.filter((e) => e.status === 'approved').length} entries so far. Matches show up here once the organizer makes the draw.`}
          action={canRegister ? <Button label="Register" inline height={44} onPress={() => router.push({ pathname: '/tournament/[id]/register', params: { id: event.tournament.id, event: event.id } })} style={{ marginTop: 8 }} /> : undefined}
        />
      ) : null}
      {event.podium?.champion ? <Button label="Podium" variant="outline" icon="trophy" height={48} onPress={() => router.push({ pathname: '/event/[id]/podium', params: { id: event.id } })} /> : null}
    </Screen>
  );
}
