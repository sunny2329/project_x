import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { AddPlayerSheet } from '@/features/match/components/AddPlayerSheet';
import { useSports } from '@/features/match/hooks/useSports';
import { fromTeamMember } from '@/features/match/lineup';
import { useMatchDraft } from '@/features/match/store/draft.store';
import { FormTile } from '@/features/profile/components/ProfileBits';
import { errorMessage, useResource } from '@/shared/hooks/useResource';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { useTheme, withAlpha } from '@/shared/theme';
import { Avatar, Badge, Button, D, Field, Header, Icon, IconButton, Label, Loading, Notice, Row, Screen, Sheet, sportIcon, T, Tap } from '@/shared/ui';
import { confirmAction } from '@/shared/utils/confirm';
import { plural, shortDay } from '@/shared/utils/format';
import { teamsApi } from '../api/teams.api';
import type { TeamDetail, TeamMember } from '../types';

/** A team's page: record, players and captains, recent matches; captains manage it, anyone in it can leave. */
export default function TeamScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useAuthStore((s) => s.user);
  const team = useResource(() => teamsApi.get(id).then((r) => r.team), [id]);
  const { sports, me: myPlayer } = useSports();
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [member, setMember] = useState<TeamMember | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const t = team.data;
  if (!t) {
    return team.error ? (
      <Screen>
        <Header />
        <Notice tone="error" icon="alert" text={team.error} />
      </Screen>
    ) : (
      <Loading />
    );
  }

  const color = t.sport.accentColor;
  const mine = t.members.find((m) => m.userId && m.userId === me?.id) ?? null;
  const run = async (work: () => Promise<TeamDetail | null>, after?: () => void) => {
    setActionError(null);
    try {
      const next = await work();
      if (next) team.setData(next);
      after?.();
    } catch (e) {
      setActionError(errorMessage(e));
    }
  };
  const leave = () =>
    confirmAction(
      `Leave ${t.name}?`,
      mine?.role === 'captain' && t.members.filter((m) => m.role === 'captain').length === 1 ? 'Another player becomes captain. A team with no registered players left is deleted.' : undefined,
      'Leave',
      () => void run(() => teamsApi.removeMember(t.id, mine!.playerId).then((r) => r.team), () => router.back()),
    );
  const remove = () =>
    confirmAction(`Delete ${t.name}?`, 'Matches it played stay in everyone’s history.', 'Delete', () => void run(() => teamsApi.remove(t.id).then(() => null), () => router.back()));

  const sport = sports?.find((s) => s.slug === t.sport.slug) ?? null;
  const play = () => {
    if (!sport) return;
    const draft = useMatchDraft.getState();
    draft.start(sport, myPlayer);
    // The smallest format that fits the whole team (doubles for a pair), else the biggest.
    const formats = [...sport.formats].sort((a, b) => a.maxPerSide - b.maxPerSide);
    const format = formats.find((f) => f.maxPerSide >= t.members.length) ?? formats[formats.length - 1];
    if (format) draft.setFormat(format.code);
    draft.pickTeam(0, { id: t.id, name: t.name }, t.members.map(fromTeamMember));
    router.push('/match/setup');
  };

  return (
    <Screen gap={18} refreshing={team.refreshing} onRefresh={team.refresh}>
      <Header
        kicker={t.sport.name}
        display={t.name}
        right={t.canManage ? <IconButton icon="pen" label="Rename team" size={40} radius={12} onPress={() => setRenaming(true)} /> : undefined}
      />

      <Row gap={12}>
        <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: withAlpha(color, 0.16), alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={sportIcon(t.sport.slug)} size={26} color={color} />
        </View>
        {[
          [t.record.played, 'Played'],
          [t.record.won, 'Won'],
          [t.record.lost, 'Lost'],
          ...(t.record.drawn ? [[t.record.drawn, 'Drawn'] as const] : []),
        ].map(([v, l]) => (
          <View key={l} style={{ flex: 1 }}>
            <D size={26}>{v}</D>
            <T size={12} color={colors.muted}>
              {l}
            </T>
          </View>
        ))}
      </Row>

      {actionError ? <Notice tone="error" icon="alert" text={actionError} /> : null}

      {mine && sport ? <Button label="Play a match as this team" icon="plus" color={color} weight={700} onPress={play} /> : null}

      <View style={{ gap: 4 }}>
        <Row between>
          <Label>{plural(t.memberCount, 'player')}</Label>
          {t.canManage ? <Button label="Add" icon="personAdd" variant="surface" height={36} radius={10} size={13} inline px={12} onPress={() => setAdding(true)} /> : null}
        </Row>
        {t.members.map((m) => (
          <MemberRow key={m.playerId} m={m} isMe={m.playerId === mine?.playerId} manage={t.canManage} onPress={() => setMember(m)} />
        ))}
      </View>

      <View style={{ gap: 8 }}>
        <Label>Recent matches</Label>
        {t.recentMatches.length ? (
          t.recentMatches.map((m) => (
            <Tap
              key={m.matchId}
              label={`vs ${m.opponent}`}
              onPress={() => router.push({ pathname: '/match/[id]/result', params: { id: m.matchId } })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: colors.surface }}
            >
              {m.outcome === 'won' || m.outcome === 'lost' ? <FormTile result={m.outcome === 'won' ? 'W' : 'L'} size={32} /> : <View style={{ width: 32 }} />}
              <View style={{ flex: 1 }}>
                <T size={14} w={600} numberOfLines={1}>
                  vs {m.opponent}
                </T>
                <T size={12} color={colors.muted}>
                  {shortDay(m.playedAt)}
                </T>
              </View>
              {m.headline ? (
                <D size={17} w={800}>
                  {m.headline.replace(/,\s*/g, ' ')}
                </D>
              ) : null}
            </Tap>
          ))
        ) : (
          <T size={14} color={colors.muted}>
            No matches yet. Pick this team when you set up a match.
          </T>
        )}
      </View>

      {mine || t.canManage ? (
        <View style={{ gap: 10, paddingTop: 8 }}>
          {mine ? <Button label="Leave team" variant="outline" onPress={leave} /> : null}
          {t.canManage ? <Button label="Delete team" variant="ghost" icon="trash" onPress={remove} /> : null}
        </View>
      ) : null}

      <AddPlayerSheet
        visible={adding}
        side={0}
        title={`Add to ${t.name}`}
        sport={t.sport.slug}
        sportName={t.sport.name}
        taken={t.members.map((m) => m.userId ?? m.playerId)}
        onAdd={(p) => void run(() => teamsApi.addMembers(t.id, [p.input]).then((r) => r.team))}
        onClose={() => setAdding(false)}
      />
      <RenameSheet visible={renaming} team={t} onClose={() => setRenaming(false)} onSaved={(next) => team.setData(next)} />
      <MemberSheet
        member={member}
        team={t}
        isMe={member?.playerId === mine?.playerId}
        onClose={() => setMember(null)}
        onLeave={leave}
        onChange={(work) => void run(work, () => setMember(null))}
      />
    </Screen>
  );
}

function MemberRow({ m, isMe, manage, onPress }: { m: TeamMember; isMe: boolean; manage: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Tap label={m.displayName} onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
      <Avatar name={m.displayName} id={m.userId ?? m.playerId} photoUrl={m.photoUrl} size={40} />
      <View style={{ flex: 1 }}>
        <T size={15} w={600} numberOfLines={1}>
          {isMe ? 'You' : m.displayName}
        </T>
        <T size={12} color={colors.muted} numberOfLines={1}>
          {m.username ? `@${m.username}` : 'Guest'}
        </T>
      </View>
      {m.role === 'captain' ? <Badge label="CAPTAIN" tone="neutral" size="xs" /> : null}
      {manage || m.userId ? <Icon name="chevronRight" size={18} color={colors.faint} /> : null}
    </Tap>
  );
}

/** What can be done with one member: see their profile; captains change roles or remove them. */
function MemberSheet({
  member,
  team,
  isMe,
  onClose,
  onLeave,
  onChange,
}: {
  member: TeamMember | null;
  team: TeamDetail;
  isMe: boolean;
  onClose: () => void;
  onLeave: () => void;
  onChange: (work: () => Promise<TeamDetail | null>) => void;
}) {
  const { colors } = useTheme();
  if (!member) return null;
  const captains = team.members.filter((m) => m.role === 'captain').length;
  const lastCaptain = member.role === 'captain' && captains === 1;
  return (
    <Sheet visible onClose={onClose}>
      <Row gap={12}>
        <Avatar name={member.displayName} id={member.userId ?? member.playerId} photoUrl={member.photoUrl} size={48} />
        <View style={{ flex: 1 }}>
          <T size={18} w={700} numberOfLines={1}>
            {isMe ? 'You' : member.displayName}
          </T>
          <T size={13} color={colors.muted}>
            {[member.role === 'captain' ? 'Captain' : 'Player', member.username ? `@${member.username}` : 'Guest'].join(' · ')}
          </T>
        </View>
        <IconButton icon="close" label="Close" tone="raised" size={40} radius={20} onPress={onClose} />
      </Row>
      {member.userId && !isMe ? (
        <Button
          label="View profile"
          variant="surface"
          onPress={() => {
            onClose();
            router.push({ pathname: '/user/[id]', params: { id: member.userId! } });
          }}
        />
      ) : null}
      {team.canManage && member.userId && member.role === 'player' ? (
        <Button label="Make captain" variant="surface" icon="crown" onPress={() => onChange(() => teamsApi.setRole(team.id, member.playerId, 'captain').then((r) => r.team))} />
      ) : null}
      {team.canManage && member.role === 'captain' && !lastCaptain ? (
        <Button label={isMe ? 'Step down as captain' : 'Remove as captain'} variant="surface" onPress={() => onChange(() => teamsApi.setRole(team.id, member.playerId, 'player').then((r) => r.team))} />
      ) : null}
      {team.canManage && member.isGuest ? (
        <T size={13} color={colors.muted}>
          Guests can be captains once they sign up with their phone number.
        </T>
      ) : null}
      {isMe ? (
        <Button
          label="Leave team"
          variant="outline"
          onPress={() => {
            onClose();
            onLeave();
          }}
        />
      ) : team.canManage ? (
        <Button
          label={`Remove from ${team.name}`}
          variant="danger"
          onPress={() =>
            confirmAction(`Remove ${member.displayName}?`, 'They can be added again later.', 'Remove', () =>
              onChange(() => teamsApi.removeMember(team.id, member.playerId).then((r) => r.team)),
            )
          }
        />
      ) : null}
    </Sheet>
  );
}

function RenameSheet({ visible, team, onClose, onSaved }: { visible: boolean; team: TeamDetail; onClose: () => void; onSaved: (team: TeamDetail) => void }) {
  const [name, setName] = useState(team.name);
  const { submit, submitting, formError, serverFieldErrors } = useSubmit();
  const save = () =>
    submit(async () => {
      onSaved((await teamsApi.rename(team.id, name.trim())).team);
      onClose();
    });
  return (
    <Sheet visible={visible} onClose={onClose}>
      <T size={20} w={700}>
        Rename team
      </T>
      <Field value={name} onChangeText={setName} maxLength={80} autoCapitalize="words" autoFocus error={serverFieldErrors.name} />
      {formError ? <Notice tone="error" icon="alert" text={formError} /> : null}
      <Button label="Save" weight={700} disabled={!name.trim() || name.trim() === team.name} loading={submitting} onPress={() => void save()} />
    </Sheet>
  );
}
