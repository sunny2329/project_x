import { router, useLocalSearchParams } from 'expo-router';
import { useResource } from '@/shared/hooks/useResource';
import { EmptyState, Header, Loading, Screen } from '@/shared/ui';
import { matchApi } from '../api/match.api';
import { QuarterBreakView } from '../components/basketball/QuarterBreak';

/** /match/[id]/break: the break between periods, opened on its own (the scoreboard also shows it inline). */
export default function QuarterBreakScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, loading } = useResource(() => matchApi.get(id), [id]);
  if (loading) return <Loading />;
  const m = data?.match;
  if (!m || !m.score.game) {
    return (
      <Screen>
        <Header />
        <EmptyState title="Couldn’t load the game" body={error ?? undefined} />
      </Screen>
    );
  }
  return (
    <Screen scroll={false}>
      <QuarterBreakView
        match={m}
        score={m.score}
        onBack={() => router.back()}
        onStart={() => router.back()}
        onBoxScore={() => router.push({ pathname: '/match/[id]/timeline', params: { id, tab: 'box' } })}
      />
    </Screen>
  );
}
