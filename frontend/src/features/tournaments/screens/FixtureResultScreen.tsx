import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { checkResult, ResultGrid } from '@/features/match/components/ResultGrid';
import { useSports } from '@/features/match/hooks/useSports';
import { useResource } from '@/shared/hooks/useResource';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { useTheme } from '@/shared/theme';
import { Button, Dot, EmptyState, Header, Loading, Notice, Row, Screen, T } from '@/shared/ui';
import { tournamentsApi } from '../api/tournaments.api';
import { fixtureSide } from '../components/TournamentBits';

/** A tournament result typed in afterwards (played but not scored live). Staff only; no confirmation step. */
export default function FixtureResultScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const fixture = useResource(() => tournamentsApi.fixture(id), [id]);
  const f = fixture.data?.fixture;
  const event = useResource(() => tournamentsApi.event(f!.eventId), [f?.eventId], { enabled: !!f });
  const { sports } = useSports();
  const [cells, setCells] = useState<string[][]>([]);
  const { submit, submitting, formError } = useSubmit();

  if (fixture.loading || (f && event.loading) || !sports) return <Loading />;
  const e = event.data?.event;
  const ruleset = sports.find((s) => s.slug === e?.sport.slug)?.rulesets.find((r) => r.id === e?.ruleset.id);
  if (!f || !e || !ruleset) {
    return (
      <Screen>
        <Header title="Enter result" />
        <EmptyState title="Couldn’t load this match" body={fixture.error ?? event.error ?? undefined} />
      </Screen>
    );
  }

  const names: [string, string] = [fixtureSide(f, 0).name, fixtureSide(f, 1).name];
  const perSide = f.entries.map((x) => x?.players.length ?? 1);
  const check = checkResult(ruleset, cells, perSide);

  const save = () =>
    void submit(async () => {
      await tournamentsApi.result(f.id, check.filled);
      router.back();
    });

  return (
    <Screen
      gap={18}
      footer={
        <View style={{ gap: 10 }}>
          <T size={13} color={colors.muted} center>
            The winner moves on straight away. Standings and the bracket update.
          </T>
          {formError ? <Notice tone="error" icon="alert" text={formError} /> : null}
          <Button label="Save result" weight={800} disabled={!check.complete} loading={submitting} onPress={save} />
        </View>
      }
    >
      <Header kicker={`${e.name} · ${f.roundName ?? f.groupName ?? f.stageName}`} title="Enter result" />
      <Row gap={10} style={{ paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: colors.surface }}>
        <Dot color={e.sport.accentColor} />
        <T size={14} w={600} flex numberOfLines={1}>
          {[e.sport.name, e.format.name, e.ruleset.name].join(' · ')}
        </T>
      </Row>
      <ResultGrid ruleset={ruleset} names={names} cells={cells} onChange={setCells} check={check} />
    </Screen>
  );
}
