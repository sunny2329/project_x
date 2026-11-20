import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Share, View } from 'react-native';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { profileApi } from '@/features/profile/api/profile.api';
import { TeamPickerSheet } from '@/features/teams/components/TeamBits';
import { useResource } from '@/shared/hooks/useResource';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { useTheme } from '@/shared/theme';
import { Avatar, Button, D, EmptyState, Header, Icon, Notice, Screen, Segmented, T, Tap, TextButton } from '@/shared/ui';
import { firstName } from '@/shared/utils/format';
import { matchApi, shareUrl } from '../api/match.api';
import { AddPlayerSheet } from '../components/AddPlayerSheet';
import { CoinToss } from '../components/CoinToss';
import { StepHeader, ToggleRow } from '../components/SetupBits';
import { fromTeamMember, lineupKeys, lineupProblem, maskPhone, type LineupPlayer } from '../lineup';
import { maxPlayersPerSide, rulesTitle } from '../rules';
import { teamSide, useMatchDraft } from '../store/draft.store';
import { BasketballSetup } from './BasketballSetupScreen';

type Serve = 'A' | 'B' | 'toss';

/**
 * Friendly match · step 2 of 2 (design v2): Team A / Team B, add players or guests, who serves
 * first (or a coin toss), share the live scoreboard link, Start scoring. Cricket goes on to "Who
 * bats first?"; basketball has its own setup. `mode=result` is the same screen opened from "Enter
 * a result" (Change): it returns there instead.
 */
export default function NewMatchSetupScreen() {
  const { colors } = useTheme();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const me = useAuthStore((s) => s.user);
  const { sport, formatCode, rulesetId, override, lineup, teams, firstServer, add, remove, pickTeam, unlinkTeam, serveFirst } = useMatchDraft();
  const [adding, setAdding] = useState<number | null>(null);
  const [pickingTeam, setPickingTeam] = useState<number | null>(null);
  const [serve, setServe] = useState<Serve>(firstServer === 1 ? 'B' : 'A');
  const [tossing, setTossing] = useState(false);
  const [share, setShare] = useState(true);
  const { submit, submitting, formError } = useSubmit();
  // My own rating line ("Pickleball 1588") and recent guests for the quick-add chips.
  const profile = useResource(() => profileApi.me(), []);
  const guests = useResource(() => matchApi.recentGuests(), []);

  if (!sport) {
    return (
      <Screen>
        <Header />
        <EmptyState title="Pick a sport first" action={<Button label="Choose a sport" inline onPress={() => router.replace('/match/new')} />} />
      </Screen>
    );
  }

  if (sport.rulesets.some((r) => r.scoringModel === 'baskets')) return <BasketballSetup sport={sport} forResult={mode === 'result'} />;

  const format = sport.formats.find((f) => f.code === formatCode) ?? sport.formats[0]!;
  const ruleset = sport.rulesets.find((r) => r.id === rulesetId) ?? null;
  const overs = ruleset?.scoringModel === 'overs';
  const forResult = mode === 'result';
  const maxPerSide = maxPlayersPerSide(format.maxPerSide, { ...(ruleset?.config ?? {}), ...override });
  const problem = lineupProblem(lineup, { minPerSide: format.minPerSide, maxPerSide });
  const openSide = lineup.findIndex((side) => side.length < maxPerSide);
  const myRating = profile.data?.profile.sports.find((s) => s.slug === sport.slug)?.rating ?? null;
  const taken = new Set(lineupKeys(lineup));
  const quick = (guests.data?.players ?? []).filter((g) => !taken.has(g.userId ?? g.playerId) && !taken.has(g.playerId)).slice(0, 3);
  const summary = [sport.name, format.name, ruleset ? (Object.keys(override).length ? rulesTitle(ruleset, override) : ruleset.name) : null].filter(Boolean).join(' · ');
  const nameOf = (p: LineupPlayer) => (p.userId && p.userId === me?.id ? 'You' : p.displayName);
  const sideName = (i: number) => lineup[i]!.map((p) => firstName(nameOf(p))).join(' & ') || `Team ${i === 0 ? 'A' : 'B'}`;

  const pickServe = (v: Serve) => {
    if (v === 'toss') {
      setTossing(true);
      return;
    }
    setServe(v);
    const side = v === 'A' ? 0 : 1;
    const first = lineup[side]![0];
    if (first) serveFirst(side, first.key);
    else useMatchDraft.setState({ firstServer: side });
  };

  const servingSide = lineup[firstServer]!;
  const server = servingSide[0];
  const otherPartner = servingSide[1];

  const start = () =>
    void submit(async () => {
      const { match } = await matchApi.create({
        sport: sport.slug,
        format: format.code,
        ...(rulesetId ? { rulesetId } : {}),
        sides: lineup.map((players, side) => ({ ...teamSide(teams, side), players: players.map((p) => p.input) })),
        rulesOverride: { ...override, firstServerSideIndex: firstServer },
      });
      useMatchDraft.getState().reset();
      router.dismissAll();
      router.push({ pathname: '/match/[id]', params: { id: match.id } });
      if (share) {
        const url = shareUrl(match);
        // The scorer is already on the scoring screen; the share sheet opens over it.
        Share.share({ message: `Follow our ${sport.name.toLowerCase()} match live: ${url}`, url }).catch(() => undefined);
      }
    });

  const sub = (p: LineupPlayer): string => {
    if (p.isGuest) return ['Guest', p.phone ? maskPhone(p.phone) : null, 'can claim later'].filter(Boolean).join(' · ');
    const rating = p.userId && p.userId === me?.id ? myRating : (p.rating ?? null);
    return rating !== null ? `${sport.name} ${Math.round(rating)}` : `${sport.name} · new to the sport`;
  };

  const playerRow = (p: LineupPlayer) => (
    <Pressable
      key={p.key}
      accessibilityRole="button"
      accessibilityLabel={`${nameOf(p)}. Remove from the match`}
      onPress={() => remove(p.key)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card }}
    >
      <Avatar name={p.displayName} id={p.userId ?? p.key} size={40} />
      <View style={{ flex: 1, gap: 2 }}>
        <T size={15} w={700} numberOfLines={1}>
          {p.userId && p.userId === me?.id ? `${p.displayName} (you)` : p.displayName}
        </T>
        <T size={12} color={colors.muted} numberOfLines={2}>
          {sub(p)}
        </T>
      </View>
      {p.isGuest ? (
        <View style={{ paddingVertical: 3, paddingHorizontal: 6, borderRadius: 6, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface }}>
          <T size={10} w={700} ls={0.06} color={colors.muted}>
            GUEST
          </T>
        </View>
      ) : null}
      <Icon name="close" size={16} color={colors.muted} />
    </Pressable>
  );

  const sideBlock = (side: number) => (
    <View key={side} style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <T size={12} w={700} ls={0.08} color={colors.muted}>
          TEAM {side === 0 ? 'A' : 'B'}
          {maxPerSide > 1 ? ` · ${lineup[side]!.length}/${maxPerSide}` : ''}
        </T>
        {teams[side] ? (
          <TextButton label={`${teams[side].name} ✕`} size={12} color={colors.accentText} onPress={() => unlinkTeam(side)} />
        ) : format.maxPerSide > 1 ? (
          <TextButton label="Saved team" size={12} color={colors.accentText} onPress={() => setPickingTeam(side)} />
        ) : null}
      </View>
      {lineup[side]!.map(playerRow)}
      {!lineup[side]!.length ? (
        <Tap label={`Add a player to team ${side === 0 ? 'A' : 'B'}`} onPress={() => setAdding(side)} style={{ padding: 14, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line, alignItems: 'center' }}>
          <T size={13} color={colors.muted}>
            No one yet. Tap to add
          </T>
        </Tap>
      ) : null}
    </View>
  );

  return (
    <Screen
      gap={16}
      footer={
        <View style={{ gap: 10 }}>
          {formError ? <Notice tone="error" icon="alert" text={formError} /> : null}
          {problem ? (
            <T size={13} color={colors.muted} center>
              {problem}
            </T>
          ) : null}
          {forResult ? (
            <Button label="Done" weight={700} disabled={!!problem} onPress={() => router.back()} />
          ) : overs ? (
            <Button label="Next: who bats first" weight={700} disabled={!!problem} onPress={() => router.push('/match/serve')} />
          ) : (
            <Button label="Start scoring" weight={700} disabled={!!problem} loading={submitting} onPress={start} />
          )}
        </View>
      }
    >
      <StepHeader step={2} fallback="/match/new" />
      <View style={{ gap: 4 }}>
        <D size={34} lh={36} accessibilityRole="header">
          Who&apos;s playing?
        </D>
        <T size={13} color={colors.muted}>
          {summary}
        </T>
      </View>

      {sideBlock(0)}
      {sideBlock(1)}

      {openSide >= 0 ? (
        <View style={{ gap: 10 }}>
          <Tap
            label={`Search players or add a guest, team ${openSide === 0 ? 'A' : 'B'}`}
            onPress={() => setAdding(openSide)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.muted }}
          >
            <Icon name="search" size={18} color={colors.muted} />
            <T size={14} color={colors.muted} flex numberOfLines={1}>
              Search players or add a guest by name
            </T>
          </Tap>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {quick.map((g) => (
              <Tap
                key={g.playerId}
                label={`Add ${g.displayName} to team ${openSide === 0 ? 'A' : 'B'}`}
                onPress={() => add(openSide, { key: g.userId ?? g.playerId, displayName: g.displayName, isGuest: g.isGuest, userId: g.userId, input: { playerId: g.playerId } })}
                style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 99, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card }}
              >
                <T size={13}>+ {g.displayName}</T>
              </Tap>
            ))}
            <Tap label="New guest" onPress={() => setAdding(openSide)} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 99, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card }}>
              <T size={13}>+ New guest</T>
            </Tap>
          </View>
        </View>
      ) : null}

      {!forResult && !overs ? (
        <>
          <View style={{ gap: 8 }}>
            <T size={14} w={700}>
              First serve
            </T>
            <Segmented
              options={[
                { value: 'A', label: 'Team A' },
                { value: 'B', label: 'Team B' },
                { value: 'toss', label: 'Coin toss' },
              ]}
              value={serve}
              onChange={pickServe}
              height={48}
              activeColor={colors.card}
              activeText={colors.fg}
            />
            {server ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <T size={12} color={colors.muted} flex>
                  {serve === 'toss' ? `${sideName(firstServer)} won the toss. ` : ''}
                  {nameOf(server) === 'You' ? 'You serve' : `${firstName(server.displayName)} serves`} first.
                </T>
                {otherPartner ? (
                  <TextButton label={`${firstName(nameOf(otherPartner))} serves instead`} size={12} color={colors.accentText} onPress={() => serveFirst(firstServer, otherPartner.key)} />
                ) : null}
              </View>
            ) : null}
          </View>

          <ToggleRow title="Share live scoreboard link" detail="Friends follow point by point, no login needed" value={share} onChange={setShare} />
        </>
      ) : null}

      <CoinToss
        visible={tossing}
        sides={[sideName(0), sideName(1)]}
        onResult={(side) => {
          const first = lineup[side]![0];
          if (first) serveFirst(side, first.key);
          else useMatchDraft.setState({ firstServer: side });
          setServe('toss');
        }}
        onClose={() => setTossing(false)}
      />

      <TeamPickerSheet
        visible={pickingTeam !== null}
        sport={sport.slug}
        sportName={sport.name}
        side={pickingTeam ?? 0}
        onPick={(team) => pickTeam(pickingTeam ?? 0, { id: team.id, name: team.name }, team.members.map(fromTeamMember))}
        onClose={() => setPickingTeam(null)}
      />

      <AddPlayerSheet
        visible={adding !== null}
        side={adding ?? 1}
        title={`Add to team ${(adding ?? 1) === 0 ? 'A' : 'B'}`}
        sport={sport.slug}
        sportName={sport.name}
        taken={lineupKeys(lineup)}
        onAdd={(p) => add(adding ?? 1, p)}
        onClose={() => setAdding(null)}
      />
    </Screen>
  );
}
