import { router } from 'expo-router';
import { useState } from 'react';
import { useResource } from '@/shared/hooks/useResource';
import { Button, Chip, EmptyState, Header, Loading, Notice, Row, Screen } from '@/shared/ui';
import { teamsApi } from '../api/teams.api';
import { TeamRow } from '../components/TeamBits';

/** "Teams": every team I'm in, any sport, with a sport filter once there's more than one sport. */
export default function MyTeamsScreen() {
  const teams = useResource(() => teamsApi.list(), []);
  const [sport, setSport] = useState<string | null>(null);

  const all = teams.data?.teams ?? [];
  const sports = [...new Map(all.map((t) => [t.sport.slug, t.sport])).values()].sort((a, b) => a.name.localeCompare(b.name));
  const shown = sport ? all.filter((t) => t.sport.slug === sport) : all;

  return (
    <Screen gap={14} refreshing={teams.refreshing} onRefresh={teams.refresh}>
      <Header
        display="Teams"
        right={<Button label="New team" icon="plus" height={40} radius={12} size={14} weight={700} inline px={14} onPress={() => router.push('/teams/new')} />}
      />

      {sports.length > 1 ? (
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          <Chip label="All" active={!sport} onPress={() => setSport(null)} />
          {sports.map((s) => (
            <Chip key={s.slug} label={s.name} dot={s.accentColor} active={sport === s.slug} activeColor={s.accentColor} onPress={() => setSport(sport === s.slug ? null : s.slug)} />
          ))}
        </Row>
      ) : null}

      {teams.error ? <Notice tone="error" icon="alert" text={teams.error} /> : null}
      {teams.loading ? <Loading /> : null}
      {shown.map((t) => (
        <TeamRow key={t.id} team={t} />
      ))}
      {!teams.loading && !teams.error && !all.length ? (
        <EmptyState
          title="No teams yet"
          body="Save your doubles partner or your squad once, then pick the team when you start a match. You can be in teams in any sport."
          action={<Button label="Create a team" icon="plus" inline height={44} onPress={() => router.push('/teams/new')} />}
        />
      ) : null}
    </Screen>
  );
}
