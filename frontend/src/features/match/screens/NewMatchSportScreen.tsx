import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { type ScrollViewInstance, View } from 'react-native';
import { useTheme } from '@/shared/theme';
import { Button, D, EmptyState, Icon, Loading, Screen, Segmented, sportIcon, T, Tap, TextButton } from '@/shared/ui';
import { RulesSheet } from '../components/RulesSheet';
import { OptionRow, StepHeader } from '../components/SetupBits';
import { useSports } from '../hooks/useSports';
import { EDITABLE_RULES, rulesetDetail, rulesTitle, sportCardLine } from '../rules';
import { meAsLineupPlayer, useMatchDraft } from '../store/draft.store';
import type { SportSummary } from '../types';

/** Sports the friendly flow scores (the engine has a plugin for them). */
const SCORED_MODELS = new Set(['rally', 'side_out', 'tennis', 'overs', 'baskets']);

/**
 * Friendly match · step 1 of 2 (design v2): sport grid, singles/doubles, scoring rules.
 * `?sport=<slug>` preselects a sport (Home's chips); `?with=<userId>&withName=` puts that player
 * on side B (Start match from a profile).
 */
export default function NewMatchSportScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ sport?: string; with?: string; withName?: string }>();
  const { sports, me, error } = useSports();
  const { sport, formatCode, rulesetId, override, lineup, start, setFormat, setRuleset, setRule, resetRules, add } = useMatchDraft();
  const [editingRules, setEditingRules] = useState(false);
  const started = useRef(false);
  // Where the format/rules block starts, so a sport tap can bring it into view.
  const scroller = useRef<ScrollViewInstance>(null);
  const optionsY = useRef<number | null>(null);
  const showOptions = () => {
    // After the new sport's options have laid out.
    setTimeout(() => {
      if (optionsY.current !== null) scroller.current?.scrollTo({ y: Math.max(0, optionsY.current - 12), animated: true });
    }, 60);
  };

  const list = (sports ?? []).filter((s) => s.rulesets.some((r) => SCORED_MODELS.has(r.scoringModel)));
  const opponent = params.with ? { key: params.with, displayName: params.withName ?? 'Opponent', isGuest: false, userId: params.with, input: { userId: params.with } } : null;

  // A fresh draft each time setup opens, on the sport asked for (else the last one, else the first).
  useEffect(() => {
    if (!list.length) return;
    if (!started.current) {
      started.current = true;
      const last = useMatchDraft.getState().sport;
      const first = list.find((s) => s.slug === params.sport) ?? (last && list.find((s) => s.id === last.id)) ?? list[0]!;
      start(first, me, opponent);
      return;
    }
    // My player row can arrive after the catalogue.
    const side0 = useMatchDraft.getState().lineup[0]!;
    if (me && !side0.length) add(0, meAsLineupPlayer(me));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.length, me]);

  if (!sports && !error) return <Loading />;
  if (error && !list.length) return <EmptyState title="Couldn’t load sports" body={error} />;

  const pick = (s: SportSummary) => {
    if (s.id === sport?.id) return;
    // Keep whoever is already added (except when the new sport can't fit them; setFormat trims).
    const keep = lineup;
    start(s, me, null);
    useMatchDraft.setState({ lineup: keep.map((side) => [...side]) });
    const draft = useMatchDraft.getState();
    if (draft.formatCode) setFormat(draft.formatCode);
    if (!s.rulesets.some((r) => r.scoringModel === 'baskets')) showOptions();
  };

  const basketball = sport?.rulesets.some((r) => r.scoringModel === 'baskets') ?? false;
  const format = sport?.formats.find((f) => f.code === formatCode) ?? sport?.formats[0];
  const ruleset = sport?.rulesets.find((r) => r.id === rulesetId) ?? null;
  const changed = Object.keys(override).length > 0;
  const editable = ruleset ? (EDITABLE_RULES[ruleset.scoringModel] ?? []) : [];
  const singlesFormat = sport?.formats.find((f) => f.code === 'singles');
  const doublesFormat = sport?.formats.find((f) => f.code === 'doubles');
  const singlesDoubles = !!(singlesFormat || doublesFormat) && sport!.formats.every((f) => f.code === 'singles' || f.code === 'doubles');
  const summary = sport ? [sport.name, basketball ? null : format?.name, basketball || !ruleset ? null : changed ? rulesTitle(ruleset, override) : ruleset.name].filter(Boolean).join(' · ') : null;

  return (
    <Screen
      gap={18}
      scrollRef={scroller}
      footer={
        <View style={{ gap: 10 }}>
          {summary ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name={sportIcon(sport!.slug)} size={16} color={colors.accentText} />
              <T size={13} w={600} flex numberOfLines={1} accessibilityLabel={`Playing ${summary}`}>
                {summary}
              </T>
              {!basketball ? <TextButton label="Change" size={13} color={colors.accentText} onPress={showOptions} /> : null}
            </View>
          ) : null}
          <Button label="Next: add players" iconRight="arrowRight" weight={700} disabled={!sport} onPress={() => router.push('/match/setup')} />
          <TextButton
            label="Already played? Enter a result"
            size={13}
            color={colors.muted}
            style={{ alignSelf: 'center' }}
            onPress={() => sport && router.push('/match/enter')}
          />
        </View>
      }
    >
      <StepHeader step={1} />
      <D size={34} lh={36} accessibilityRole="header">
        What are you playing?
      </D>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 }}>
        {list.map((s) => {
          const on = s.id === sport?.id;
          return (
            <Tap
              key={s.id}
              label={`${s.name}${on ? ', selected' : ''}`}
              onPress={() => pick(s)}
              style={{
                width: '48.5%',
                minHeight: 92,
                padding: 12,
                paddingTop: 10,
                borderRadius: 18,
                justifyContent: 'space-between',
                gap: 6,
                backgroundColor: on ? colors.primary : colors.card,
                borderWidth: 1,
                borderColor: on ? colors.primary : colors.line,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Icon name={sportIcon(s.slug)} size={24} color={on ? colors.onPrimary : colors.fg} />
                {on ? (
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.onPrimary, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="check" size={14} color={colors.primary} strokeWidth={2.6} />
                  </View>
                ) : null}
              </View>
              <View style={{ gap: 2 }}>
                <D size={22} lh={24} color={on ? colors.onPrimary : colors.fg} numberOfLines={1}>
                  {s.name}
                </D>
                <T size={12} color={on ? colors.onPrimary : colors.muted} numberOfLines={1}>
                  {sportCardLine(s)}
                </T>
              </View>
            </Tap>
          );
        })}
      </View>

      {sport && !basketball ? (
        <View style={{ gap: 18 }} onLayout={(e) => (optionsY.current = e.nativeEvent.layout.y)}>
          {sport.formats.length > 1 || singlesDoubles ? (
            <View style={{ gap: 8 }}>
              <T size={14} w={700}>
                Format
              </T>
              {singlesDoubles ? (
                <Segmented
                  options={[
                    { value: 'singles', label: 'Singles', disabled: !singlesFormat },
                    { value: 'doubles', label: 'Doubles', disabled: !doublesFormat },
                  ]}
                  value={format?.code === 'doubles' ? 'doubles' : 'singles'}
                  onChange={(v) => setFormat(v)}
                  height={48}
                  activeColor={colors.card}
                  activeText={colors.fg}
                />
              ) : (
                <Segmented options={sport.formats.map((f) => ({ value: f.code, label: f.name }))} value={format?.code ?? ''} onChange={setFormat} height={48} activeColor={colors.card} activeText={colors.fg} />
              )}
              {singlesDoubles && !singlesFormat ? (
                <T size={12} color={colors.muted}>
                  {sport.name} is played as doubles.
                </T>
              ) : null}
            </View>
          ) : null}

          <View style={{ gap: 8 }}>
            <T size={14} w={700}>
              Scoring rules
            </T>
            {sport.rulesets.map((r) => (
              <OptionRow
                key={r.id}
                title={r.id === rulesetId && changed ? rulesTitle(r, override) : r.name}
                detail={rulesetDetail(r.id === rulesetId ? { ...r, config: { ...r.config, ...override } } : r)}
                selected={r.id === rulesetId}
                onPress={() => setRuleset(r.id)}
              />
            ))}
            {editable.length ? (
              <TextButton
                label={ruleset?.scoringModel === 'overs' ? 'Change a rule (players, overs, wickets…)' : 'Change a rule (points to win, cap…)'}
                size={13}
                color={colors.accentText}
                onPress={() => setEditingRules(true)}
              />
            ) : null}
          </View>
        </View>
      ) : sport ? (
        <T size={13} color={colors.muted}>
          Next: quick starts, court size and how the game ends.
        </T>
      ) : null}

      <RulesSheet visible={editingRules} onClose={() => setEditingRules(false)} ruleset={ruleset} override={override} onChange={setRule} onReset={resetRules} note="The change is for this match only." />
    </Screen>
  );
}
