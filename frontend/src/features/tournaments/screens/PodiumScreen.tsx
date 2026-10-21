import { router, useLocalSearchParams } from 'expo-router';
import { Share, View } from 'react-native';
import { useResource } from '@/shared/hooks/useResource';
import { GOLD, useTheme } from '@/shared/theme';
import { Avatar, Badge, Button, D, EmptyState, Header, Icon, IconButton, Loading, Row, Screen, T } from '@/shared/ui';
import { shortName } from '@/shared/utils/format';
import { publicTournamentUrl, tournamentsApi } from '../api/tournaments.api';
import type { FixtureEntry } from '../types';

const short = (e: FixtureEntry) => e.name.split(' & ').map(shortName).join(' & ');

function Step({ entry, place, height }: { entry: FixtureEntry | null; place: 1 | 2 | 3; height: number }) {
  const { colors } = useTheme();
  const first = place === 1;
  const label = first ? 'CHAMPION' : place === 2 ? 'RUNNER-UP' : 'THIRD';
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 8 }}>
      {first ? <Icon name="crown" size={24} color={GOLD} /> : null}
      {entry ? <Avatar name={entry.name} id={entry.id} size={first ? 72 : 60} display ring={first ? colors.primary : undefined} /> : <View style={{ width: 60, height: 60 }} />}
      <T size={first ? 15 : 14} w={first ? 800 : 700} center numberOfLines={2}>
        {entry ? short(entry) : '—'}
      </T>
      <View style={{ alignSelf: 'stretch', height, borderTopLeftRadius: 14, borderTopRightRadius: 14, backgroundColor: first ? colors.primary : colors.raised, alignItems: 'center', paddingTop: 10 }}>
        <D size={first ? 56 : place === 2 ? 44 : 40} color={first ? colors.onPrimary : colors.soft}>
          {place}
        </D>
        <T size={11} w={first ? 800 : 700} color={first ? colors.onPrimary : colors.muted}>
          {label}
        </T>
      </View>
    </View>
  );
}

/** "Kabir Mehta is champion": the final's score and the podium. */
export default function PodiumScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, loading } = useResource(() => tournamentsApi.event(id), [id]);
  const event = data?.event;

  if (loading) return <Loading />;
  const podium = event?.podium;
  if (!event || !podium?.champion) {
    return (
      <Screen>
        <Header />
        <EmptyState title="No podium yet" body={error ?? 'The podium appears after the final.'} />
      </Screen>
    );
  }

  const champion = podium.champion!;
  const url = publicTournamentUrl(event.tournament.slug);
  const share = () =>
    void Share.share({ message: `${short(champion)} won ${event.name} at ${event.tournament.name}${podium.final.headline ? ` (${podium.final.headline})` : ''}\n${url}`, url });

  return (
    <Screen
      gap={18}
      footer={
        <View style={{ gap: 10 }}>
          <Button label="Full bracket" variant="outline" height={52} radius={14} size={15} onPress={() => router.push({ pathname: '/event/[id]/bracket', params: { id: event.id } })} />
          <Button label="Share the podium" weight={800} onPress={share} />
        </View>
      }
    >
      <Row between>
        <IconButton icon="back" label="Back" onPress={() => router.back()} />
        <Badge label="EVENT COMPLETE" tone="neutral" />
        <IconButton icon="share" label="Share" onPress={share} />
      </Row>

      <View style={{ gap: 4, alignItems: 'center' }}>
        <T size={13} color={colors.muted} center>
          {event.tournament.name} · {event.name}
        </T>
        <D size={52} lh={50} upper center>
          {champion.name.split(' & ').length > 1 ? short(champion) : champion.name}
          {'\n'}
          <D size={52} lh={50} upper color={colors.primary}>
            {champion.name.includes(' & ') ? 'are champions' : 'is champion'}
          </D>
        </D>
        {podium.final.headline ? (
          <D size={22} w={800} color={colors.soft} center>
            Final {podium.final.headline}
          </D>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 8 }}>
        <Step entry={podium.runnerUp} place={2} height={120} />
        <Step entry={champion} place={1} height={170} />
        <Step entry={podium.third[0] ?? null} place={3} height={90} />
      </View>
      {podium.third.length > 1 ? (
        <T size={13} color={colors.muted} center>
          Joint third: {podium.third.map(short).join(' and ')}
        </T>
      ) : null}
    </Screen>
  );
}
