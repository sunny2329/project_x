import Feather from '@expo/vector-icons/Feather';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useProfileStore } from '@/features/profile/store/profile.store';
import { ChoiceChips, FormMessage, PrimaryButton, Screen, SectionHeader, TextField, TopBar } from '@/shared/components';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { spacing, typography, useTheme } from '@/shared/theme';
import { matchApi } from '../api/match.api';
import { LiveMatchCard } from '../components/LiveMatchCard';
import { SideEditor } from '../components/SideEditor';
import { SportGrid } from '../components/SportGrid';
import { parseScores } from '../format';
import { useLiveMatches } from '../hooks/useLiveMatches';
import { addPlayer, fitToFormat, lineupKeys, lineupProblem, removePlayer, type Lineup, type LineupPlayer } from '../lineup';
import type { SportSummary } from '../types';

/**
 * Start a friendly in a few taps: sport -> rules -> singles/doubles -> players -> start scoring.
 * Players can be guests. Or enter a result afterwards (the opponent confirms it).
 */
export default function PlayScreen() {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const primarySportId = useProfileStore((s) => s.profile?.sports.find((sport) => sport.isPrimary)?.id);
  const live = useLiveMatches();
  const refreshLive = live.refresh;
  const setupState = useSubmit();
  const submitSetup = setupState.submit;
  const start = useSubmit();

  const [sports, setSports] = useState<SportSummary[]>([]);
  const [chosenSportId, setChosenSportId] = useState<string | null>(null);
  const [formatCode, setFormatCode] = useState<string | null>(null);
  const [rulesetId, setRulesetId] = useState<string | null>(null);
  /** Players picked besides me (I am always first on side 1). */
  const [picked, setPicked] = useState<Lineup>([[], []]);
  const [searchSide, setSearchSide] = useState<number | null>(null);
  const [manual, setManual] = useState(false);
  const [scoreText, setScoreText] = useState('');

  const me = useMemo<LineupPlayer | null>(
    () => (user ? { key: user.id, displayName: user.fullName, isGuest: false, userId: user.id, input: { userId: user.id } } : null),
    [user],
  );

  useEffect(() => {
    void submitSetup(async () => {
      const response = await matchApi.sports();
      setSports(response.sports);
    });
  }, [submitSetup]);

  useFocusEffect(
    useCallback(() => {
      void refreshLive();
    }, [refreshLive]),
  );

  // Until the player picks one: their primary sport, else the first.
  const sport = sports.find((s) => s.id === chosenSportId) ?? sports.find((s) => s.id === primarySportId) ?? sports[0] ?? null;
  const format = sport?.formats.find((f) => f.code === formatCode) ?? sport?.formats[0] ?? null;
  const ruleset = sport?.rulesets.find((r) => r.id === rulesetId) ?? sport?.rulesets.find((r) => r.isDefault) ?? sport?.rulesets[0] ?? null;
  const lineup: Lineup = fitToFormat(me ? [[me, ...picked[0]!], picked[1]!] : picked, format ?? { maxPerSide: 11 });
  const withoutMe = (next: Lineup): Lineup => (me ? removePlayer(next, me.key) : next);

  function selectSport(id: string) {
    setChosenSportId(id);
    setFormatCode(null);
    setRulesetId(null);
    setSearchSide(null);
  }

  function selectFormat(code: string) {
    const next = sport?.formats.find((f) => f.code === code);
    if (!next) return;
    setFormatCode(code);
    setPicked((prev) => withoutMe(fitToFormat(me ? [[me, ...prev[0]!], prev[1]!] : prev, next)));
  }

  const scores = manual ? parseScores(scoreText) : null;
  const problem = !format
    ? 'Pick a sport'
    : (lineupProblem(lineup, format) ?? (manual && !scores ? 'Enter the score of each game or set, e.g. 21-15, 18-21, 21-19' : null));

  async function startMatch() {
    if (!sport || !format || !ruleset || problem) return;
    let createdId: string | null = null;
    const ok = await start.submit(async () => {
      const { match } = await matchApi.create({
        sport: sport.slug,
        format: format.code,
        rulesetId: ruleset.id,
        sides: lineup.map((players) => ({ players: players.map((p) => p.input) })),
        ...(manual && scores ? { manualScores: scores } : {}),
      });
      createdId = match.id;
    });
    if (ok && createdId) {
      setPicked([[], []]);
      setScoreText('');
      router.push({ pathname: '/match/[id]', params: { id: createdId } });
    }
  }

  const myLive = live.matches.filter((m) => m.mine);

  return (
    <Screen edges={['top']} header={<TopBar title="Play" back={false} />}>
      <Text style={[typography.subtitle, styles.header, { color: colors.textMuted }]}>Score a friendly point by point, or run a tournament.</Text>

      <Pressable
        onPress={() => router.push('/tournaments')}
        accessibilityRole="button"
        style={({ pressed }) => [styles.tournaments, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder, opacity: pressed ? 0.8 : 1 }]}
      >
        <Feather name="award" size={20} color={colors.primary} />
        <View style={styles.flex}>
          <Text style={[styles.tournamentsTitle, { color: colors.text }]}>Tournaments</Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>Organize one, score your court, or follow the draw</Text>
        </View>
        <Feather name="chevron-right" size={20} color={colors.icon} />
      </Pressable>

      {myLive.length ? (
        <View style={styles.section}>
          <SectionHeader title="Your live matches" />
          <View style={styles.list}>
            {myLive.map((match) => (
              <LiveMatchCard key={match.id} match={match} />
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHeader title="Sport" />
        {setupState.submitting && !sports.length ? <ActivityIndicator color={colors.primary} /> : null}
        <FormMessage message={setupState.formError} />
        <SportGrid sports={sports} selectedId={sport?.id ?? null} onSelect={selectSport} />
      </View>

      {sport && sport.rulesets.length > 1 ? (
        <View style={styles.section}>
          <SectionHeader title="Rules" />
          <ChoiceChips accessibilityLabel="Rules" options={sport.rulesets.map((r) => ({ label: r.name, value: r.id }))} value={ruleset?.id} onChange={setRulesetId} />
        </View>
      ) : null}

      {sport && sport.formats.length > 1 ? (
        <View style={styles.section}>
          <SectionHeader title="Format" />
          <ChoiceChips accessibilityLabel="Format" options={sport.formats.map((f) => ({ label: f.name, value: f.code }))} value={format?.code} onChange={selectFormat} />
        </View>
      ) : null}

      {format ? (
        <View style={styles.section}>
          <SectionHeader title="Players" />
          <View style={styles.list}>
            {[0, 1].map((side) => (
              <SideEditor
                key={side}
                title={side === 0 ? 'Your side' : 'Opponents'}
                players={lineup[side]!}
                maxPlayers={format.maxPerSide}
                lockedKey={me?.key}
                searching={searchSide === side}
                excludeKeys={lineupKeys(lineup)}
                onToggleSearch={() => setSearchSide((prev) => (prev === side ? null : side))}
                onAdd={(player) => {
                  const next = addPlayer(lineup, side, player, format.maxPerSide);
                  setPicked(withoutMe(next));
                  if (next[side]!.length >= format.maxPerSide) setSearchSide(null);
                }}
                onRemove={(key) => setPicked((prev) => removePlayer(prev, key))}
              />
            ))}
          </View>
        </View>
      ) : null}

      {format ? (
        <View style={styles.section}>
          <ChoiceChips
            accessibilityLabel="Scoring"
            options={[
              { label: 'Score live', value: 'live' },
              { label: 'Enter result', value: 'manual' },
            ]}
            value={manual ? 'manual' : 'live'}
            onChange={(v) => setManual(v === 'manual')}
          />
          {manual ? (
            <View style={styles.manual}>
              <TextField icon="edit-3" placeholder="e.g. 21-15, 18-21, 21-19 (your side first)" value={scoreText} onChangeText={setScoreText} autoCorrect={false} />
              <Text style={[typography.caption, { color: colors.textMuted }]}>Results entered afterwards count towards ratings once a registered opponent confirms them.</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <FormMessage message={start.formError ?? Object.values(start.serverFieldErrors)[0] ?? null} />
      {problem && format ? <Text style={[typography.caption, styles.problem, { color: colors.textMuted }]}>{problem}</Text> : null}
      <PrimaryButton title={manual ? 'Save result' : 'Start match'} onPress={() => void startMatch()} loading={start.submitting} disabled={Boolean(problem)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: spacing.lg, marginBottom: spacing.lg },
  section: { marginBottom: spacing.xl },
  list: { gap: spacing.md },
  flex: { flex: 1 },
  manual: { gap: spacing.sm, marginTop: spacing.md },
  problem: { textAlign: 'center', marginBottom: spacing.sm, marginTop: spacing.sm },
  tournaments: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderRadius: 16, padding: spacing.lg, marginBottom: spacing.xl },
  tournamentsTitle: { fontSize: 16, fontWeight: '700' },
});
