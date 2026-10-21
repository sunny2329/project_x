import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { useTheme, withAlpha } from '@/shared/theme';
import { D, EmptyState, Header, Icon, Label, Loading, Screen, sportIcon, T, Tap } from '@/shared/ui';
import { useSports } from '../hooks/useSports';
import { sportTagline } from '../rules';
import { useMatchDraft } from '../store/draft.store';
import type { SportSummary } from '../types';

/** Sports the friendly flow scores (the engine has a plugin for them). */
const SCORED_MODELS = new Set(['rally', 'side_out', 'tennis']);

/** "What are you playing?": one card per sport, or "Already played?" to type a result in. */
export default function NewMatchSportScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ with?: string; withName?: string }>();
  const { sports, me, error } = useSports();
  const start = useMatchDraft((s) => s.start);

  if (!sports && !error) return <Loading />;
  const list = (sports ?? []).filter((s) => s.rulesets.some((r) => SCORED_MODELS.has(r.scoringModel)));
  const opponent = params.with ? { key: params.with, displayName: params.withName ?? 'Opponent', isGuest: false, userId: params.with, input: { userId: params.with } } : null;

  const choose = (sport: SportSummary, next: '/match/setup' | '/match/enter') => {
    start(sport, me, opponent);
    router.push(next);
  };

  return (
    <Screen gap={20} bottom={24}>
      <Header icon="close" center={<Label>New match</Label>} />
      <D size={46} lh={44} upper accessibilityRole="header">
        What are you playing?
      </D>

      {error ? <EmptyState title="Couldn’t load sports" body={error} /> : null}

      <View style={{ gap: 10 }}>
        {list.map((sport) => (
          <Tap
            key={sport.id}
            label={sport.name}
            onPress={() => choose(sport, '/match/setup')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 16, height: 84, paddingHorizontal: 18, borderRadius: 20, backgroundColor: withAlpha(sport.accentColor, 0.12), borderWidth: 1, borderColor: withAlpha(sport.accentColor, 0.38) }}
          >
            <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: sport.accentColor, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={sportIcon(sport.slug)} size={28} color={colors.ink} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <D size={30} lh={30} upper numberOfLines={1}>
                {sport.name}
              </D>
              <T size={13} color={colors.soft} numberOfLines={1}>
                {sportTagline(sport)}
              </T>
            </View>
            <Icon name="chevronRight" size={20} color={colors.fg} />
          </Tap>
        ))}
      </View>

      <Tap
        label="Already played? Enter a result"
        onPress={() => {
          const draft = useMatchDraft.getState();
          const sport = (draft.sport && list.find((s) => s.id === draft.sport!.id)) ?? list[0];
          if (sport) choose(sport, '/match/enter');
        }}
        style={{ marginTop: 'auto', flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line2 }}
      >
        <Icon name="pen" size={20} color={colors.fg} />
        <View style={{ flex: 1, gap: 2 }}>
          <T size={15} w={700}>
            Already played?
          </T>
          <T size={13} color={colors.muted}>
            Type the score in. Your opponent confirms it.
          </T>
        </View>
        <Icon name="chevronRight" size={20} color={colors.muted} />
      </Tap>
    </Screen>
  );
}
