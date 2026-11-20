import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AddPlayerSheet } from '@/features/match/components/AddPlayerSheet';
import { useSports } from '@/features/match/hooks/useSports';
import type { LineupPlayer } from '@/features/match/lineup';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { useTheme } from '@/shared/theme';
import { Avatar, Button, Chip, Field, Header, Icon, Label, Loading, Notice, Row, Screen, T } from '@/shared/ui';
import { teamsApi } from '../api/teams.api';

/** "New team": sport, name, and the other players (you're in it as captain). `?sport=` preselects one. */
export default function CreateTeamScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ sport?: string }>();
  const me = useAuthStore((s) => s.user);
  const { sports, error: sportsError } = useSports();
  const [sportSlug, setSportSlug] = useState<string | null>(params.sport ?? null);
  const [name, setName] = useState('');
  const [players, setPlayers] = useState<LineupPlayer[]>([]);
  const [adding, setAdding] = useState(false);
  const { submit, submitting, formError, serverFieldErrors } = useSubmit();

  if (!sports && !sportsError) return <Loading />;
  const sport = sports?.find((s) => s.slug === sportSlug) ?? null;
  const taken = [...(me ? [me.id] : []), ...players.map((p) => p.key)];
  const problem = !sport ? 'Pick a sport' : !name.trim() ? 'Give the team a name' : null;

  const create = () =>
    submit(async () => {
      const { team } = await teamsApi.create({ sport: sport!.slug, name: name.trim(), ...(players.length ? { members: players.map((p) => p.input) } : {}) });
      router.replace({ pathname: '/team/[id]', params: { id: team.id } });
    });

  return (
    <Screen
      gap={18}
      footer={
        <View style={{ gap: 10 }}>
          {formError ? <Notice tone="error" icon="alert" text={formError} /> : null}
          {problem ? (
            <T size={13} color={colors.muted} center>
              {problem}
            </T>
          ) : null}
          <Button label="Create team" weight={700} disabled={!!problem} loading={submitting} onPress={() => void create()} />
        </View>
      }
    >
      <Header display="New team" kicker="You’ll be the captain" />
      {sportsError ? <Notice tone="error" icon="alert" text={sportsError} /> : null}

      <View style={{ gap: 8 }}>
        <Label>Sport</Label>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          {(sports ?? []).map((s) => (
            <Chip key={s.slug} label={s.name} dot={s.accentColor} active={s.slug === sportSlug} activeColor={s.accentColor} onPress={() => setSportSlug(s.slug)} />
          ))}
        </Row>
        {serverFieldErrors.sport ? (
          <T size={13} color={colors.bad}>
            {serverFieldErrors.sport}
          </T>
        ) : null}
      </View>

      <Field label="Team name" value={name} onChangeText={setName} placeholder="e.g. Smash Bros" maxLength={80} autoCapitalize="words" error={serverFieldErrors.name} />

      <View style={{ gap: 8 }}>
        <Label>Players</Label>
        <Row gap={12} style={{ minHeight: 36 }}>
          <Avatar name={me?.fullName ?? 'You'} id={me?.id} size={36} />
          <T size={15} w={600} flex>
            You
          </T>
          <T size={12} w={800} color={colors.muted}>
            CAPTAIN
          </T>
        </Row>
        {players.map((p) => (
          <Pressable
            key={p.key}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${p.displayName}`}
            onPress={() => setPlayers(players.filter((x) => x.key !== p.key))}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 36 }}
          >
            <Avatar name={p.displayName} id={p.userId ?? p.key} size={36} />
            <T size={15} w={600} flex numberOfLines={1}>
              {p.displayName}
            </T>
            {p.isGuest ? (
              <T size={12} w={800} color={colors.faint}>
                GUEST
              </T>
            ) : null}
            <Icon name="close" size={16} color={colors.faint} />
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add player"
          disabled={!sport}
          onPress={() => setAdding(true)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, height: 44, opacity: sport ? 1 : 0.4 }}
        >
          <View style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.faint, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="personAdd" size={16} color={colors.fg} />
          </View>
          <T size={14} w={700}>
            {sport ? 'Add player' : 'Pick a sport to add players'}
          </T>
        </Pressable>
        {serverFieldErrors.members ? (
          <T size={13} color={colors.bad}>
            {serverFieldErrors.members}
          </T>
        ) : null}
        <T size={13} color={colors.muted}>
          You can add more players later. Teammates see the team on their profile.
        </T>
      </View>

      {sport ? (
        <AddPlayerSheet
          visible={adding}
          side={0}
          title="Add to the team"
          sport={sport.slug}
          sportName={sport.name}
          taken={taken}
          onAdd={(p) => setPlayers((current) => (current.some((x) => x.key === p.key) ? current : [...current, p]))}
          onClose={() => setAdding(false)}
        />
      ) : null}
    </Screen>
  );
}
