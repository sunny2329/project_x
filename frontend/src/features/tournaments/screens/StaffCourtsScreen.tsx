import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useResource } from '@/shared/hooks/useResource';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { useTheme } from '@/shared/theme';
import { Avatar, Badge, Button, D, EmptyState, Field, Group, GroupRow, Header, Label, Loading, Notice, Row, Screen, Segmented, Sheet, T, TextButton } from '@/shared/ui';
import { tournamentsApi } from '../api/tournaments.api';
import { UserPickerSheet } from '../components/UserPickerSheet';
import type { StaffRole, Tournament } from '../types';

type InviteRole = Exclude<StaffRole, 'organizer' | 'scorer'>;

const ROLE: Record<StaffRole | 'court_scorer', { label: string; can: string }> = {
  organizer: { label: 'ORGANIZER', can: 'Can’t be removed' },
  co_organizer: { label: 'CO-ORGANIZER', can: 'Events, entries, draw, courts' },
  referee: { label: 'REFEREE', can: 'Starts and scores any match' },
  scorer: { label: 'SCORER', can: 'Scores any match' },
  court_scorer: { label: 'COURT SCORER', can: '' },
};

/** Staff (organizer, co-organizers, referees, court scorers) and courts with their scorers. */
export default function StaffCourtsScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useAuthStore((s) => s.user);
  const { data, setData, error, loading } = useResource(() => tournamentsApi.get(id), [id]);
  const [inviting, setInviting] = useState(false);
  const [role, setRole] = useState<InviteRole>('co_organizer');
  const [addingCourt, setAddingCourt] = useState(false);
  const [courtName, setCourtName] = useState('');
  const [assigning, setAssigning] = useState<string | null>(null);
  const action = useSubmit();

  if (loading) return <Loading />;
  const t = data?.tournament;
  if (!t) {
    return (
      <Screen>
        <Header display="Staff & courts" />
        <EmptyState title="Tournament not found" body={error ?? undefined} />
      </Screen>
    );
  }

  const apply = (run: () => Promise<{ tournament: Tournament }>) =>
    void action.submit(async () => {
      const { tournament } = await run();
      setData({ tournament });
    });

  // Court scorers who aren't other staff show up in the list as "COURT SCORER · Court 3 only".
  const courtScorers = new Map<string, { name: string; courts: string[] }>();
  for (const c of t.courts) {
    for (const s of c.scorers) {
      if (t.staff.some((x) => x.userId === s.userId) || s.userId === t.organizer.userId) continue;
      const entry = courtScorers.get(s.userId) ?? { name: s.name ?? 'Scorer', courts: [] };
      entry.courts.push(c.name);
      courtScorers.set(s.userId, entry);
    }
  }
  const rows = [
    ...(t.organizer.userId ? [{ userId: t.organizer.userId, name: t.organizer.name ?? 'Organizer', role: 'organizer' as const, can: ROLE.organizer.can }] : []),
    ...t.staff.filter((s) => s.role !== 'organizer').map((s) => ({ userId: s.userId, name: s.name ?? 'Staff', role: s.role, can: ROLE[s.role].can })),
    ...[...courtScorers.entries()].map(([userId, s]) => ({ userId, name: s.name, role: 'court_scorer' as const, can: `${s.courts.join(', ')} only` })),
  ];
  const court = t.courts.find((c) => c.id === assigning);

  const removeStaff = (row: (typeof rows)[number]) => {
    if (row.role === 'organizer' || !t.isOrganizer) return;
    Alert.alert(`Remove ${row.name}?`, row.role === 'court_scorer' ? 'They stop scoring their courts.' : 'They lose access to running this tournament.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          apply(async () => {
            if (row.role === 'court_scorer') {
              let last: { tournament: Tournament } | null = null;
              for (const c of t.courts.filter((x) => x.scorerUserIds.includes(row.userId))) last = await tournamentsApi.removeCourtScorer(c.id, row.userId);
              return last ?? { tournament: t };
            }
            return tournamentsApi.removeStaff(t.id, row.userId, row.role);
          }),
      },
    ]);
  };

  return (
    <Screen gap={14}>
      <Header display="Staff & courts" displaySize={30} />
      {action.formError ? <Notice tone="error" icon="alert" text={action.formError} /> : null}

      <Row between>
        <Label>Staff · {rows.length}</Label>
        {t.isOrganizer ? <Button label="Invite" icon="plus" height={34} radius={10} size={13} weight={700} inline px={12} onPress={() => setInviting(true)} /> : null}
      </Row>
      <Group>
        {rows.map((r, i) => (
          <GroupRow key={`${r.userId}-${r.role}`} last={i === rows.length - 1} minHeight={62} label={r.name} onPress={r.role === 'organizer' || !t.isOrganizer ? undefined : () => removeStaff(r)}>
            <Avatar name={r.name} id={r.userId} size={38} />
            <View style={{ flex: 1 }}>
              <T size={15} w={700} numberOfLines={1}>
                {r.name}
                {r.userId === me?.id ? ' (you)' : ''}
              </T>
              <T size={12} color={colors.muted} numberOfLines={1}>
                {r.can}
              </T>
            </View>
            <Badge label={ROLE[r.role].label} tone={r.role === 'organizer' ? 'primary' : 'neutral'} />
          </GroupRow>
        ))}
      </Group>
      {t.isOrganizer && rows.length > 1 ? (
        <T size={12} color={colors.muted}>
          Tap someone to remove them.
        </T>
      ) : null}

      <Row between style={{ marginTop: 4 }}>
        <Label>Courts · {t.courts.length}</Label>
        <Button
          label="Add court"
          icon="plus"
          variant="outline"
          height={34}
          radius={10}
          size={13}
          inline
          px={12}
          onPress={() => {
            setCourtName(`Court ${t.courts.length + 1}`);
            setAddingCourt(true);
          }}
        />
      </Row>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {t.courts.map((c) => (
          <View key={c.id} style={{ width: '48%', flexGrow: 1, padding: 12, borderRadius: 14, backgroundColor: colors.surface, gap: 6 }}>
            <D size={22}>{c.name}</D>
            <T size={13} color={colors.muted} numberOfLines={2}>
              Scorer: {c.scorers.length ? c.scorers.map((s) => s.name ?? 'Scorer').join(', ') : 'any staff'}
            </T>
            <TextButton label={c.scorers.length ? 'Change' : 'Assign'} size={13} style={{ alignSelf: 'flex-start', paddingVertical: 4 }} onPress={() => setAssigning(c.id)} />
          </View>
        ))}
      </View>
      {!t.courts.length ? (
        <T size={14} color={colors.muted}>
          Add the courts you’ll play on. Each can have its own scorer.
        </T>
      ) : null}

      <UserPickerSheet
        visible={inviting}
        title="Invite staff"
        sub="They help run this tournament from their own phone."
        actionLabel="Invite"
        header={
          <Segmented<InviteRole>
            options={[
              { value: 'co_organizer', label: 'Co-organizer' },
              { value: 'referee', label: 'Referee' },
            ]}
            value={role}
            onChange={setRole}
            tray={colors.bg}
            height={40}
            size={14}
          />
        }
        footer={
          <T size={13} color={colors.muted}>
            {ROLE[role].can}. For one court only, assign a scorer to that court instead.
          </T>
        }
        onPick={(u) => {
          setInviting(false);
          apply(() => tournamentsApi.addStaff(t.id, u.id, role));
        }}
        onClose={() => setInviting(false)}
      />

      <UserPickerSheet
        visible={!!court}
        title={court ? `Scorer for ${court.name}` : 'Scorer'}
        sub="They see this court’s matches under My matches › Scoring duties."
        actionLabel="Assign"
        footer={
          court?.scorers.length ? (
            <Button
              label={`Remove ${court.scorers[0]!.name ?? 'scorer'}`}
              variant="outline"
              textColor={colors.bad}
              onPress={() => {
                const c = court;
                setAssigning(null);
                apply(() => tournamentsApi.removeCourtScorer(c.id, c.scorers[0]!.userId));
              }}
            />
          ) : null
        }
        onPick={(u) => {
          const c = court!;
          setAssigning(null);
          apply(() => tournamentsApi.assignCourtScorer(c.id, u.id, true));
        }}
        onClose={() => setAssigning(null)}
      />

      <Sheet visible={addingCourt} onClose={() => setAddingCourt(false)}>
        <T size={20} w={700}>
          Add court
        </T>
        <Field label="Name" value={courtName} onChangeText={setCourtName} maxLength={60} autoFocus background={colors.bg} />
        <Button
          label="Add court"
          disabled={!courtName.trim()}
          loading={action.submitting}
          onPress={() => {
            setAddingCourt(false);
            apply(() => tournamentsApi.addCourt(t.id, courtName.trim()));
          }}
        />
      </Sheet>
    </Screen>
  );
}
