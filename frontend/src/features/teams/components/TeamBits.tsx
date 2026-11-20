import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { errorMessage } from '@/shared/hooks/useResource';
import { useOpened } from '@/shared/hooks/useSearch';
import { useTheme, withAlpha } from '@/shared/theme';
import { Avatar, Badge, Button, Icon, IconButton, Notice, Row, Sheet, sportIcon, T, Tap } from '@/shared/ui';
import { plural } from '@/shared/utils/format';
import { teamsApi } from '../api/teams.api';
import type { TeamDetail, TeamRecord, TeamSummary } from '../types';

/** "3 played · 2 won" or "No matches yet". */
export function recordLine(r: TeamRecord): string {
  if (!r.played) return 'No matches yet';
  return [plural(r.played, 'played', 'played'), `${r.won} won`, r.drawn ? `${r.drawn} drawn` : null].filter(Boolean).join(' · ');
}

/** Overlapping member avatars, captains first. */
export function AvatarStack({ people, total, size = 28 }: { people: TeamSummary['preview']; total: number; size?: number }) {
  const { colors } = useTheme();
  const extra = total - people.length;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }} accessibilityLabel={plural(total, 'player')}>
      {people.map((p, i) => (
        <View key={`${p.userId ?? p.displayName}-${i}`} style={{ marginLeft: i ? -Math.round(size / 6) : 0 }}>
          <Avatar name={p.displayName} id={p.userId ?? p.displayName} photoUrl={p.photoUrl} size={size} border={colors.surface} />
        </View>
      ))}
      {extra > 0 ? (
        <View style={{ marginLeft: -Math.round(size / 6), width: size, height: size, borderRadius: size / 2, backgroundColor: colors.raised, borderWidth: 2, borderColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
          <T size={10} w={700} color={colors.soft}>
            +{extra}
          </T>
        </View>
      ) : null}
    </View>
  );
}

/** A team in a list: sport tile, name, record, avatars. */
export function TeamRow({ team, onPress }: { team: TeamSummary; onPress?: () => void }) {
  const { colors } = useTheme();
  const color = team.sport.accentColor;
  return (
    <Tap
      label={`${team.name}, ${team.sport.name}`}
      onPress={onPress ?? (() => router.push({ pathname: '/team/[id]', params: { id: team.id } }))}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}
    >
      <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: withAlpha(color, 0.16), alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={sportIcon(team.sport.slug)} size={24} color={color} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Row gap={6}>
          <T size={15} w={700} numberOfLines={1} style={{ flexShrink: 1 }}>
            {team.name}
          </T>
          {team.myRole === 'captain' ? <Badge label="CAPTAIN" tone="neutral" size="xs" /> : null}
        </Row>
        <T size={13} color={colors.muted} numberOfLines={1}>
          {team.sport.name} · {recordLine(team.record)}
        </T>
      </View>
      <AvatarStack people={team.preview.slice(0, 3)} total={team.memberCount} />
      <Icon name="chevronRight" size={20} color={colors.muted} />
    </Tap>
  );
}

/**
 * "Use a saved team" while setting up a match: my teams in this sport. Picking one loads its
 * players and hands the team over (the caller fills the side).
 */
export function TeamPickerSheet({
  visible,
  sport,
  sportName,
  side,
  onPick,
  onClose,
}: {
  visible: boolean;
  sport: string;
  sportName: string;
  side: number;
  onPick: (team: TeamDetail) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const [teams, setTeams] = useState<TeamSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  // Fresh each time the sheet opens.
  if (useOpened(visible)) {
    setTeams(null);
    setError(null);
  }
  useEffect(() => {
    if (!visible) return undefined;
    let cancelled = false;
    teamsApi.list({ sport }).then(
      (r) => !cancelled && setTeams(r.teams),
      (e: unknown) => !cancelled && setError(errorMessage(e)),
    );
    return () => {
      cancelled = true;
    };
  }, [visible, sport]);

  const pick = async (team: TeamSummary) => {
    setOpening(team.id);
    try {
      onPick((await teamsApi.get(team.id)).team);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setOpening(null);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} height="70%">
      <Row between>
        <View style={{ flex: 1 }}>
          <T size={20} w={700}>
            Use a saved team
          </T>
          <T size={13} color={colors.muted}>
            Fills side {side === 0 ? 'A' : 'B'} with its players
          </T>
        </View>
        <IconButton icon="close" label="Close" tone="raised" size={40} radius={20} onPress={onClose} />
      </Row>
      {error ? <Notice tone="error" icon="alert" text={error} /> : null}
      {teams === null && !error ? <ActivityIndicator color={colors.muted} /> : null}
      {teams?.map((t) => (
        <View key={t.id} style={{ opacity: opening && opening !== t.id ? 0.5 : 1 }}>
          <TeamRow team={t} onPress={() => (opening ? undefined : void pick(t))} />
        </View>
      ))}
      {teams && !teams.length ? (
        <View style={{ gap: 12, alignItems: 'center', paddingVertical: 12 }}>
          <T size={14} color={colors.muted} center>
            You’re not in a {sportName} team yet.
          </T>
          <Button
            label="Create a team"
            icon="plus"
            inline
            height={44}
            onPress={() => {
              onClose();
              router.push({ pathname: '/teams/new', params: { sport } });
            }}
          />
        </View>
      ) : null}
    </Sheet>
  );
}
