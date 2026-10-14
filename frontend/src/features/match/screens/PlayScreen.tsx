import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useProfileStore } from '@/features/profile/store/profile.store';
import { ChoiceChips, FormMessage, PrimaryButton, Screen, SectionHeader, TopBar } from '@/shared/components';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { spacing, typography, useTheme } from '@/shared/theme';
import { matchApi } from '../api/match.api';
import { LiveMatchCard } from '../components/LiveMatchCard';
import { SideEditor } from '../components/SideEditor';
import { SportGrid } from '../components/SportGrid';
import { defaultOptions, optionChoices, rulesSummary } from '../format';
import { useLiveMatches } from '../hooks/useLiveMatches';
import { addPlayer, fitToFormat, lineupIds, lineupProblem, removePlayer, type Lineup } from '../lineup';
import type { MatchOptions, Side, SportSetup } from '../types';

/** Start a friendly match: sport, format, both sides' players, rules. Also lists my live matches to resume. */
export default function PlayScreen() {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const primarySportId = useProfileStore((s) => s.profile?.sports.find((sport) => sport.isPrimary)?.id);
  const live = useLiveMatches();
  const refreshLive = live.refresh;
  const setupState = useSubmit();
  const submitSetup = setupState.submit;
  const start = useSubmit();

  const [sports, setSports] = useState<SportSetup[]>([]);
  const [chosenSportId, setChosenSportId] = useState<string | null>(null);
  const [formatId, setFormatId] = useState<string | null>(null);
  /** Players picked besides me (I am always first on side 1). */
  const [picked, setPicked] = useState<Lineup>([[], []]);
  const [teamNames, setTeamNames] = useState<[string, string]>(['', '']);
  /** Only the rules the player changed; the rest come from the sport's defaults. */
  const [optionChanges, setOptionChanges] = useState<MatchOptions>({});
  const [searchSide, setSearchSide] = useState<Side | null>(null);

  const me = useMemo(() => (user ? { id: user.id, username: user.username, fullName: user.fullName } : null), [user]);

  const loadSetup = useCallback(() => {
    void submitSetup(async () => {
      const response = await matchApi.setup();
      setSports(response.sports);
    });
  }, [submitSetup]);

  useEffect(loadSetup, [loadSetup]);

  useFocusEffect(
    useCallback(() => {
      void refreshLive();
    }, [refreshLive]),
  );

  // Until the player picks one: their primary sport, else the first.
  const sport = sports.find((s) => s.sport.id === chosenSportId) ?? sports.find((s) => s.sport.id === primarySportId) ?? sports[0] ?? null;
  const format = sport?.formats.find((f) => f.id === formatId) ?? sport?.formats[0] ?? null;
  const options: MatchOptions = sport ? { ...defaultOptions(sport.defaults), ...optionChanges } : {};
  const lineup: Lineup = fitToFormat(
    me ? [[me, ...picked[0]], picked[1]] : picked,
    format ?? { id: '', name: '', minPlayers: 1, maxPlayers: 11 },
  );
  const withoutMe = (next: Lineup): Lineup => (me ? removePlayer(next, me.id) : next);

  function selectSport(id: string) {
    setChosenSportId(id);
    setFormatId(null);
    setOptionChanges({});
    setSearchSide(null);
  }

  function selectFormat(id: string) {
    const next = sport?.formats.find((f) => f.id === id);
    if (!next) return;
    setFormatId(id);
    setPicked((prev) => withoutMe(fitToFormat(me ? [[me, ...prev[0]], prev[1]] : prev, next)));
  }

  function setOption(key: keyof MatchOptions, value: number) {
    setOptionChanges((prev) => ({ ...prev, [key]: value }));
  }

  const problem = format ? lineupProblem(lineup, format) : 'Pick a sport';
  const teamFormat = (format?.maxPlayers ?? 0) > 2;

  async function startMatch() {
    if (!sport || !format || problem) return;
    let createdId: string | null = null;
    const ok = await start.submit(async () => {
      const { match } = await matchApi.create({
        sportId: sport.sport.id,
        formatId: format.id,
        sides: [0, 1].map((i) => ({
          ...(teamFormat && teamNames[i]!.trim() ? { name: teamNames[i]!.trim() } : {}),
          playerIds: lineup[i]!.map((p) => p.id),
        })) as [{ playerIds: string[] }, { playerIds: string[] }],
        options,
      });
      createdId = match.id;
    });
    if (ok && createdId) {
      setPicked([[], []]);
      setTeamNames(['', '']);
      router.push({ pathname: '/match/[id]', params: { id: createdId } });
    }
  }

  const myLive = live.matches.filter((m) => m.mine);
  const battingOptions = [
    { label: teamNames[0].trim() || 'Your side', value: 1 as Side },
    { label: teamNames[1].trim() || 'Opponents', value: 2 as Side },
  ];

  return (
    <Screen edges={['top']} header={<TopBar title="New match" back={false} />}>
      <Text style={[typography.subtitle, styles.header, { color: colors.textMuted }]}>Score a friendly match, point by point.</Text>

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
        <SportGrid sports={sports} selectedId={sport?.sport.id ?? null} onSelect={selectSport} />
        {sport ? (
          <Text style={[typography.caption, styles.rules, { color: colors.textMuted }]}>{rulesSummary(sport.defaults)} by default</Text>
        ) : null}
      </View>

      {sport && sport.formats.length > 1 ? (
        <View style={styles.section}>
          <SectionHeader title="Format" />
          <ChoiceChips
            accessibilityLabel="Format"
            options={sport.formats.map((f) => ({ label: f.name, value: f.id }))}
            value={format?.id}
            onChange={selectFormat}
          />
        </View>
      ) : null}

      {format ? (
        <View style={styles.section}>
          <SectionHeader title="Players" />
          <View style={styles.list}>
            {([1, 2] as const).map((side) => (
              <SideEditor
                key={side}
                title={side === 1 ? 'Your side' : 'Opponents'}
                players={lineup[side - 1]!}
                maxPlayers={format.maxPlayers}
                teamName={
                  teamFormat
                    ? {
                        value: teamNames[side - 1]!,
                        placeholder: side === 1 ? 'Team name (optional)' : 'Opponent team name (optional)',
                        onChange: (name) => setTeamNames((prev) => (side === 1 ? [name, prev[1]] : [prev[0], name])),
                      }
                    : undefined
                }
                lockedPlayerId={me?.id}
                searching={searchSide === side}
                excludeIds={lineupIds(lineup)}
                onToggleSearch={() => setSearchSide((prev) => (prev === side ? null : side))}
                onAdd={(player) => {
                  const next = addPlayer(lineup, side, player, format.maxPlayers);
                  setPicked(withoutMe(next));
                  if (next[side - 1]!.length >= format.maxPlayers) setSearchSide(null);
                }}
                onRemove={(playerId) => setPicked((prev) => removePlayer(prev, playerId))}
              />
            ))}
          </View>
          {teamFormat ? (
            <Text style={[typography.caption, styles.rules, { color: colors.textMuted }]}>
              Only players on ProjectX can be added. For a team game, adding just the captains is enough.
            </Text>
          ) : null}
        </View>
      ) : null}

      {sport ? (
        <View style={styles.section}>
          <SectionHeader title="Rules" />
          <View style={styles.list}>
            {optionChoices(sport.defaults).map((choice) => (
              <View key={choice.key} style={styles.option}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>{choice.label}</Text>
                <ChoiceChips
                  accessibilityLabel={choice.label}
                  options={choice.values.map((value) => ({ label: String(value), value }))}
                  value={options[choice.key] as number | undefined}
                  onChange={(value) => setOption(choice.key, value)}
                />
              </View>
            ))}
            {sport.kind === 'overs' ? (
              <View style={styles.option}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>Batting first</Text>
                <ChoiceChips
                  accessibilityLabel="Batting first"
                  options={battingOptions}
                  value={options.battingFirst}
                  onChange={(value) => setOption('battingFirst', value)}
                />
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      <FormMessage message={start.formError ?? Object.values(start.serverFieldErrors)[0] ?? null} />
      {problem && format ? <Text style={[typography.caption, styles.problem, { color: colors.textMuted }]}>{problem}</Text> : null}
      <PrimaryButton title="Start match" onPress={() => void startMatch()} loading={start.submitting} disabled={Boolean(problem)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: spacing.lg, marginBottom: spacing.xl },
  section: { marginBottom: spacing.xl },
  list: { gap: spacing.md },
  rules: { marginTop: spacing.sm },
  option: { gap: spacing.sm },
  problem: { textAlign: 'center', marginBottom: spacing.sm, marginTop: spacing.sm },
});
