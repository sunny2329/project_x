import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useCallback, useEffect, useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuthStore } from '@/features/auth/store/auth.store';
import {
  AppHeader,
  Avatar,
  Card,
  ChoiceChips,
  EmptyState,
  FormMessage,
  IconButton,
  Screen,
  UnderlineTabs,
} from '@/shared/components';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { radius, spacing, typography, useTheme, useThemeStore } from '@/shared/theme';
import { MatchRow } from '../components/MatchRow';
import { StatsGrid, winRate } from '../components/SportStatsCard';
import { useProfileStore } from '../store/profile.store';

type Tab = 'stats' | 'matches';
const OVERALL = 'overall';

/** The signed-in player's profile: identity, counts, per-sport stats and ratings, match history. */
export default function ProfileScreen() {
  const { colors, scheme } = useTheme();
  const setThemeMode = useThemeStore((s) => s.setMode);
  const profile = useProfileStore((s) => s.profile);
  const matches = useProfileStore((s) => s.matches);
  const load = useProfileStore((s) => s.load);
  const fallbackUser = useAuthStore((s) => s.user);
  const { submitting: refreshing, formError: error, submit } = useSubmit();
  const [tab, setTab] = useState<Tab>('stats');
  const [sportId, setSportId] = useState<string>(OVERALL);

  const refresh = useCallback(() => {
    void submit(load);
  }, [submit, load]);

  useEffect(refresh, [refresh]);

  const user = profile?.user ?? fallbackUser;
  if (!user) return null;
  const record = profile?.record ?? { played: 0, won: 0, lost: 0 };
  const sports = profile?.sports ?? [];
  const primary = sports.find((s) => s.isPrimary);
  const sport = sports.find((s) => s.id === sportId);

  const header = (
    <AppHeader
      title="You"
      actions={
        <>
          <IconButton
            icon={scheme === 'dark' ? 'sun' : 'moon'}
            label={scheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            onPress={() => setThemeMode(scheme === 'dark' ? 'light' : 'dark')}
          />
          <IconButton icon="sliders" label="Settings" onPress={() => router.push('/settings')} />
        </>
      }
    />
  );

  return (
    <Screen edges={['top']} header={header} onRefresh={refresh} refreshing={refreshing}>
      <View style={styles.identity}>
        <Avatar name={user.fullName} size={104} ring />
        <View style={styles.counts}>
          <Count value={record.played} label="Matches" />
          <Count value={profile?.followers ?? 0} label="Followers" />
          <Count value={profile?.following ?? 0} label="Following" />
        </View>
      </View>

      <Text style={[styles.name, { color: colors.text }]}>{user.fullName}</Text>
      <Text style={[typography.body, { color: colors.textMuted }]}>@{user.username}</Text>
      {profile?.bio ? <Text style={[styles.bio, { color: colors.text }]}>{profile.bio}</Text> : null}

      <View style={styles.tags}>
        {primary ? <Tag icon="award" label={primary.name} highlight /> : null}
        {primary ? <Tag icon="trending-up" label={`${Math.round(primary.rating)} rating`} /> : null}
        <Tag icon="zap" label={`${winRate(record.won, record.played)} wins`} />
      </View>

      <View style={styles.buttons}>
        <PillButton icon="edit-2" label="Edit profile" onPress={() => router.push('/edit-profile')} />
        <PillButton icon="settings" label="Settings" onPress={() => router.push('/settings')} />
      </View>

      <FormMessage message={error} />

      <View style={styles.bleed}>
        <UnderlineTabs
          tabs={[
            { label: 'Stats', value: 'stats' },
            { label: 'Matches', value: 'matches' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>

      {tab === 'stats' ? (
        <View style={styles.tabBody}>
          {sports.length ? (
            <ChoiceChips
              accessibilityLabel="Sport"
              options={[{ label: 'Overall', value: OVERALL }, ...sports.map((s) => ({ label: s.name, value: s.id }))]}
              value={sport ? sport.id : OVERALL}
              onChange={setSportId}
            />
          ) : null}
          {sport ? (
            <StatsGrid
              headline={{
                label: `${sport.name} rating`,
                value: String(Math.round(sport.rating)),
                caption: sport.ratedMatches ? `Elo · ${sport.ratedMatches} rated match${sport.ratedMatches === 1 ? '' : 'es'}` : 'Elo · everyone starts at 1000',
                badge: sport.isPrimary ? 'Primary' : undefined,
              }}
              tiles={[
                { label: 'Played', value: String(sport.matchesPlayed) },
                { label: 'Won', value: String(sport.matchesWon) },
                { label: 'Win %', value: winRate(sport.matchesWon, sport.matchesPlayed) },
                { label: 'Lost', value: String(sport.matchesLost) },
                { label: 'Games won', value: String(sport.majorWon), hint: `${sport.majorLost} lost` },
                { label: 'Points won', value: String(sport.minorWon), hint: `${sport.minorLost} lost` },
              ]}
            />
          ) : (
            <StatsGrid
              headline={{ label: 'All sports', value: winRate(record.won, record.played), caption: 'Win rate across every match' }}
              tiles={[
                { label: 'Played', value: String(record.played) },
                { label: 'Won', value: String(record.won) },
                { label: 'Lost', value: String(record.lost) },
              ]}
            />
          )}
          {sports.length ? null : (
            <Card>
              <EmptyState
                icon="target"
                title="No sports yet"
                message="Pick the sports you play. Everyone starts at a 1000 rating."
                action={{ label: 'Add sports', onPress: () => router.push('/edit-profile') }}
              />
            </Card>
          )}
        </View>
      ) : (
        <View style={styles.tabBody}>
          <Card style={styles.history}>
            {matches.length ? (
              matches.map((match) => <MatchRow key={match.matchId} match={match} />)
            ) : (
              <EmptyState icon="activity" title="No matches yet" message="Every match you score is saved here with its result." />
            )}
          </Card>
        </View>
      )}
    </Screen>
  );
}

function Count({ value, label }: { value: number; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.count}>
      <Text style={[styles.countValue, { color: colors.text }]}>{value}</Text>
      <Text style={[typography.caption, { color: colors.textMuted, fontWeight: '600' }]}>{label}</Text>
    </View>
  );
}

function Tag({ icon, label, highlight = false }: { icon: ComponentProps<typeof Feather>['name']; label: string; highlight?: boolean }) {
  const { colors } = useTheme();
  const fg = highlight ? colors.primary : colors.textMuted;
  return (
    <View style={[styles.tag, { backgroundColor: highlight ? colors.primarySoft : colors.secondaryButton }]}>
      <Feather name={icon} size={12} color={fg} />
      <Text style={[styles.tagText, { color: highlight ? colors.primary : colors.text }]}>{label}</Text>
    </View>
  );
}

function PillButton({ icon, label, onPress }: { icon: ComponentProps<typeof Feather>['name']; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.pill,
        { backgroundColor: pressed ? colors.secondaryButtonPressed : colors.surface, borderColor: colors.surfaceBorder },
      ]}
    >
      <Feather name={icon} size={16} color={colors.text} />
      <Text style={[typography.secondaryButton, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingTop: spacing.lg, marginBottom: spacing.md },
  counts: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  count: { alignItems: 'center', gap: 2 },
  countValue: { fontSize: 20, fontWeight: '800' },
  name: { fontSize: 22, fontWeight: '700' },
  bio: { ...typography.body, lineHeight: 20, marginTop: spacing.sm },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.pill, paddingHorizontal: spacing.sm + 2, paddingVertical: 5 },
  tagText: { fontSize: 12, fontWeight: '700' },
  buttons: { flexDirection: 'row', gap: spacing.md, marginVertical: spacing.lg },
  pill: {
    flex: 1,
    height: 46,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  bleed: { marginHorizontal: -spacing.screen },
  tabBody: { paddingTop: spacing.lg, gap: spacing.lg },
  history: { paddingVertical: spacing.xs },
});
