import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Share, View } from 'react-native';
import { useResource } from '@/shared/hooks/useResource';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { useTheme } from '@/shared/theme';
import { Button, D, EmptyState, Header, Icon, IconButton, type IconName, Label, Loading, Notice, Row, Screen, T, Tap } from '@/shared/ui';
import { dateRange, plural } from '@/shared/utils/format';
import { publicTournamentUrl, tournamentsApi } from '../api/tournaments.api';
import { drawSummary } from '../components/TournamentBits';
import { tournamentStatusLabel } from '../status';
import type { EventSummary, Tournament, TournamentStatus } from '../types';

const STEPS: TournamentStatus[] = ['draft', 'registration_open', 'registration_closed', 'in_progress', 'completed'];

const NEXT: Partial<Record<TournamentStatus, { hint: string; action: string | null; to: TournamentStatus | null }>> = {
  draft: { hint: 'Next: add events and open registration', action: 'Open registration', to: 'registration_open' },
  registration_open: { hint: 'Next: close and make the draw', action: 'Close registration', to: 'registration_closed' },
  registration_closed: { hint: 'Next: make the draws and schedule', action: 'Start match day', to: 'in_progress' },
  in_progress: { hint: 'Next: finish when the finals are played', action: 'Finish tournament', to: 'completed' },
  completed: { hint: 'All done. Results stay on the public page.', action: null, to: null },
  cancelled: { hint: 'This tournament was cancelled.', action: null, to: null },
};

function Tile({ icon, title, sub, onPress, primary }: { icon: IconName; title: string; sub: string; onPress: () => void; primary?: boolean }) {
  const { colors } = useTheme();
  const fg = primary ? colors.onPrimary : colors.fg;
  return (
    <Tap label={title} onPress={onPress} style={{ width: '48.5%', flexGrow: 1, gap: 8, padding: 14, borderRadius: 16, backgroundColor: primary ? colors.primary : colors.surface, borderWidth: primary ? 0 : 1, borderColor: colors.line }}>
      <Icon name={icon} size={22} color={fg} />
      <View>
        <T size={15} w={primary ? 800 : 700} color={fg}>
          {title}
        </T>
        <T size={13} color={primary ? colors.onBrightMuted : colors.muted}>
          {sub}
        </T>
      </View>
    </Tap>
  );
}

/** The event row's action: Make draw before the draw, Schedule after. */
function eventAction(e: EventSummary, tournamentId: string): { label: string; go: () => void; primary: boolean } | null {
  const drawn = e.status === 'drawn' || e.status === 'in_progress' || e.status === 'completed';
  if (drawn) return { label: 'Schedule', primary: false, go: () => router.push({ pathname: '/tournament/[id]/schedule', params: { id: tournamentId, event: e.id } }) };
  if (e.status === 'registration_open' || e.status === 'registration_closed') return { label: 'Make draw', primary: true, go: () => router.push({ pathname: '/event/[id]/draw', params: { id: e.id } }) };
  return null;
}

function eventLine(e: EventSummary): string {
  const state = e.status === 'drawn' ? 'Drawn' : e.status === 'in_progress' ? 'In progress' : e.status === 'completed' ? 'Complete' : `${e.approvedEntries}${e.maxEntries ? `/${e.maxEntries}` : ''} approved`;
  return `${drawSummary(e)} · ${state}`;
}

/** Organizer home for one tournament: where it is in its lifecycle and every setup task. */
export default function OrgDashboardScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, setData, error, loading, refreshing, refresh } = useResource(() => tournamentsApi.get(id), [id]);
  const step = useSubmit();

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

  const at = Math.max(0, STEPS.indexOf(t.status));
  const next = NEXT[t.status];
  const pendingEvent = t.events.find((e) => e.pendingEntries > 0) ?? t.events[0];

  const advance = (to: TournamentStatus) =>
    void step.submit(async () => {
      // Events carry their own registration status; move them with the tournament.
      if (to === 'registration_open') {
        for (const e of t.events.filter((x) => x.status === 'draft')) await tournamentsApi.updateEvent(e.id, { status: 'registration_open' });
      }
      if (to === 'registration_closed') {
        for (const e of t.events.filter((x) => x.status === 'registration_open')) await tournamentsApi.updateEvent(e.id, { status: 'registration_closed' });
      }
      const { tournament } = await tournamentsApi.update(t.id, { status: to });
      setData({ tournament: tournament as Tournament });
    });

  const confirmAdvance = () => {
    if (!next?.to) return;
    if (next.to === 'registration_open' && !t.events.length) {
      Alert.alert('Add an event first', 'Players register for events, so add at least one.');
      return;
    }
    Alert.alert(`${next.action}?`, next.to === 'registration_open' ? 'Players can find the tournament and send entries.' : next.to === 'registration_closed' ? 'No new entries after this. You can still add players yourself.' : undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: next.action!, onPress: () => advance(next.to!) },
    ]);
  };

  return (
    <Screen gap={16} refreshing={refreshing} onRefresh={refresh}>
      <Row between>
        <IconButton icon="back" label="Back" onPress={() => router.back()} />
        <T size={12} w={700} ls={0.08} color={colors.primary}>
          ORGANIZER
        </T>
        <IconButton icon="share" label="Share public page" onPress={() => void Share.share({ message: `${t.name}\n${publicTournamentUrl(t.slug)}`, url: publicTournamentUrl(t.slug) })} />
      </Row>

      <View style={{ gap: 4 }}>
        <D size={38} lh={38} upper>
          {t.name}
        </D>
        <T size={14} color={colors.muted}>
          {[dateRange(t.startsOn, t.endsOn), t.venue?.name, t.visibility[0]!.toUpperCase() + t.visibility.slice(1)].filter(Boolean).join(' · ')}
        </T>
      </View>

      <View style={{ gap: 8, padding: 14, borderRadius: 16, backgroundColor: colors.surface }}>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {STEPS.map((s, i) => (
            <View key={s} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i <= at ? colors.primary : colors.line }} />
          ))}
        </View>
        <Row between gap={8}>
          <T size={15} w={700}>
            {tournamentStatusLabel(t.status)}
          </T>
          <T size={13} color={colors.muted} right flex>
            {next?.hint}
          </T>
        </Row>
        {next?.action && t.isOrganizer ? <Button label={next.action} height={44} radius={12} size={14} variant={t.status === 'draft' ? 'primary' : 'outline'} loading={step.submitting} onPress={confirmAdvance} /> : null}
      </View>
      {step.formError ? <Notice tone="error" icon="alert" text={step.formError} /> : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Tile
          icon="people"
          title="Entries"
          sub={t.pendingEntries ? `${t.pendingEntries} waiting for you` : `${t.events.reduce((n, e) => n + e.approvedEntries, 0)} approved`}
          primary={t.pendingEntries > 0}
          onPress={() => (pendingEvent ? router.push({ pathname: '/event/[id]/entries', params: { id: pendingEvent.id } }) : router.push({ pathname: '/tournament/[id]/event/new', params: { id: t.id } }))}
        />
        <Tile icon="plus" title="Add event" sub="Sport, rules, draw" onPress={() => router.push({ pathname: '/tournament/[id]/event/new', params: { id: t.id } })} />
        <Tile icon="court" title="Staff & courts" sub={`${plural(t.staff.length, 'staff', 'staff')} · ${plural(t.courts.length, 'court')}`} onPress={() => router.push({ pathname: '/tournament/[id]/staff', params: { id: t.id } })} />
        <Tile icon="pulse" title="Court board" sub="Match day view" onPress={() => router.push({ pathname: '/tournament/[id]/courts', params: { id: t.id } })} />
      </View>

      <View style={{ gap: 8 }}>
        <Label>Events</Label>
        {t.events.map((e) => {
          const action = eventAction(e, t.id);
          return (
            <Tap key={e.id} label={e.name} onPress={() => router.push({ pathname: '/event/[id]', params: { id: e.id } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.surface }}>
              <View style={{ width: 4, height: 40, borderRadius: 2, backgroundColor: e.sport.accentColor }} />
              <View style={{ flex: 1, gap: 2 }}>
                <T size={15} w={700} numberOfLines={1}>
                  {e.name}
                </T>
                <T size={12} color={colors.muted} numberOfLines={1}>
                  {eventLine(e)}
                </T>
              </View>
              {action ? <Button label={action.label} variant={action.primary ? 'primary' : 'outline'} height={36} radius={10} size={13} weight={action.primary ? 800 : 700} inline px={12} onPress={action.go} /> : null}
            </Tap>
          );
        })}
        {!t.events.length ? (
          <EmptyState title="No events yet" body="Add an event for each sport and format you run." action={<Button label="Add event" icon="plus" inline height={44} onPress={() => router.push({ pathname: '/tournament/[id]/event/new', params: { id: t.id } })} style={{ marginTop: 8 }} />} />
        ) : null}
      </View>
    </Screen>
  );
}
