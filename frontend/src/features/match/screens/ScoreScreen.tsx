import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { createScorer, scoringRegistry } from '@/engine/scoring';
import { useScoringPrefs } from '@/shared/prefs/scoring-prefs.store';
import { sportText, useTheme } from '@/shared/theme';
import { Button, EmptyState, goBack, Header, IconButton, Loading, Notice, Row, Screen, T } from '@/shared/ui';
import { firstName } from '@/shared/utils/format';
import { AddScorerSheet, EndEarlySheet, ScorerMenu } from '../components/MatchSheets';
import { Callout, HintInfo, previewHint, ScoreHeader, SegmentChips, servePill, SetsTable, SideButton, TotalInfo } from '../components/Scoreboard';
import { useLiveScoring } from '../hooks/useLiveScoring';
import { rulesFooter, serveTurn } from '../rules';
import type { MatchView, ScoreSummary } from '../types';
import { SpectatorView } from './SpectatorScreen';

/** "Riya & Kabir" from the players (the side's own name when it has one). */
export function sideLabel(match: MatchView, index: number, short = false): string {
  const side = match.sides[index];
  if (!side) return '';
  if (side.teamId || side.entryId || side.players.length === 0) return side.name;
  return side.players.map((p) => (short ? firstName(p.displayName) : p.displayName)).join(' & ');
}

const KEEP_AWAKE_TAG = 'scoring';

function Scoring({ id }: { id: string }) {
  const { colors } = useTheme();
  const keepAwake = useScoringPrefs((s) => s.keepAwake);
  const haptics = useScoringPrefs((s) => s.haptics);
  useEffect(() => {
    if (!keepAwake) return undefined;
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
    return () => void deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
  }, [keepAwake]);
  const live = useLiveScoring(id);
  const [menu, setMenu] = useState(false);
  const [ending, setEnding] = useState<null | 'retired' | 'walkover'>(null);
  const [addingScorer, setAddingScorer] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const { match, display: score } = live;

  const scorer = useMemo(() => {
    if (!match) return null;
    try {
      return createScorer(scoringRegistry, match.ruleset.scoringModel, match.rulesetConfig, match.sides.map((s) => ({ index: s.index, playerCount: s.players.length })));
    } catch {
      return null;
    }
  }, [match?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const decided = match && match.status !== 'live' && match.status !== 'scheduled';
  useEffect(() => {
    if (decided) router.replace({ pathname: '/match/[id]/result', params: { id } });
  }, [decided, id]);

  if (!match || !score) return live.error ? <Failed text={live.error} /> : <Loading />;
  if (!match.canScore) return <SpectatorView match={match} reload={live.reload} />;
  if (decided) return <Loading />;

  const color = match.sport.accentColor;
  const tint = sportText(colors, match.sport.slug);
  const model = score.scoringModel;
  const tennis = model === 'tennis';
  const sideOut = model === 'side_out';
  const doubles = match.sides.some((s) => s.players.length > 1);
  const names = [0, 1].map((i) => sideLabel(match, i));
  const events = match.events; // preview hints only need the server's events + this tap
  const footer = score.complete ? null : (rulesFooter(model, match.rulesetConfig, doubles) ?? (tennis ? `${score.headline}` : score.headline));

  const tap = (sideIndex: number) => {
    const action = score.actions.find((a) => a.sideIndex === sideIndex);
    if (!action) return;
    if (haptics) void Haptics.selectionAsync().catch(() => undefined);
    live.tap(action.event);
  };

  const info = (i: number) => {
    const fg = i === 0 ? colors.ink : colors.onPrimary;
    const soft = i === 0 ? colors.ink : colors.onBrightMuted;
    if (score.complete || model === 'rally') return <TotalInfo label={score.totals.majorLabel} value={score.sides[i]!.primary} color={fg} />;
    if (sideOut) {
      return <HintInfo text={score.sides[i]!.serving ? 'Serving side can score' : 'Receiving. Winning this rally gets you the serve.'} color={score.sides[i]!.serving ? fg : soft} />;
    }
    const hint = previewHint(scorer, events, score.actions.find((a) => a.sideIndex === i), score);
    return <HintInfo text={hint ?? (i === 0 ? null : null)} color={i === 0 ? fg : soft} />;
  };

  // Table tennis: "Serves next after 1 more" under the receiver's name.
  const turn = serveTurn(match.rulesetConfig, score.segments.at(-1)?.scores ?? [0, 0]);
  const footNote = (i: number) => (turn && turn.of > 1 && !score.sides[i]!.serving && !score.complete ? `Serves next after ${turn.left} more` : null);

  const finish = async () => {
    if (await live.complete()) router.replace({ pathname: '/match/[id]/result', params: { id } });
  };

  const abandon = () =>
    Alert.alert('Abandon this match?', 'Nobody wins and it isn’t counted in records.', [
      { text: 'Keep scoring', style: 'cancel' },
      {
        text: 'Abandon',
        style: 'destructive',
        onPress: () =>
          void live.abandon().then((ok) => {
            if (ok) router.dismissAll();
          }),
      },
    ]);

  return (
    <Screen px={16} gap={12} bottom={20} scroll={false}>
      <ScoreHeader match={match} live={!score.complete} onClose={score.complete ? undefined : () => goBack('/')} onMenu={() => setMenu(true)} />

      {tennis ? <SetsTable score={score} names={names.map((n) => n.replace(/ & /g, ' / '))} slug={match.sport.slug} color={color} /> : <SegmentChips score={score} slug={match.sport.slug} />}

      <Callout score={score} slug={match.sport.slug} color={color} names={names} sideOut={sideOut} />

      {[0, 1].map((i) => {
        const action = score.actions.find((a) => a.sideIndex === i);
        const side = score.sides[i]!;
        const big = score.complete ? (score.segments.filter((s) => s.complete).at(-1)?.display[i] ?? side.primary) : (side.current ?? side.primary);
        return (
          <SideButton
            key={i}
            index={i}
            name={names[i]!}
            score={tennis && score.complete ? side.primary : big}
            action={score.complete ? undefined : action}
            color={color}
            tint={tint}
            pill={score.complete ? null : servePill(match, score, i)}
            info={info(i)}
            footNote={footNote(i)}
            dim={score.complete && score.winnerSideIndex !== i}
            winner={score.complete && score.winnerSideIndex === i}
            big={tennis ? 104 : 132}
            sideOutStyle={sideOut}
            onPress={score.complete ? undefined : () => tap(i)}
          />
        );
      })}

      {live.error || notice ? <Notice tone={live.error ? 'error' : 'info'} icon={live.error ? 'alert' : 'check'} text={(live.error ?? notice)!} /> : null}
      {live.offline ? <Notice tone="warn" icon="alert" text="No connection. Your taps are saved and will be sent." /> : null}

      {score.complete ? (
        <Row gap={10}>
          <IconButton icon="undo" label="Undo last point" size={56} radius={16} style={{ borderWidth: 1, borderColor: colors.line2 }} onPress={live.undo} />
          <Button label="Finish match" weight={800} style={{ flex: 1 }} loading={live.busy} disabled={live.syncing} onPress={() => void finish()} />
        </Row>
      ) : (
        <Row gap={10}>
          <Button label="Undo" icon="undo" variant="surface" inline px={20} style={{ borderWidth: 1, borderColor: colors.line2 }} disabled={!live.eventCount} onPress={live.undo} />
          <T size={13} lh={18} color={colors.muted} right flex numberOfLines={2}>
            {footer}
          </T>
        </Row>
      )}

      <ScorerMenu
        visible={menu}
        match={match}
        score={score}
        started={live.eventCount > 0}
        onClose={() => setMenu(false)}
        onAddScorer={() => {
          setMenu(false);
          setAddingScorer(true);
        }}
        onRetire={() => {
          setMenu(false);
          setEnding('retired');
        }}
        onWalkover={() => {
          setMenu(false);
          setEnding('walkover');
        }}
        onAbandon={() => {
          setMenu(false);
          abandon();
        }}
      />
      <EndEarlySheet
        visible={ending !== null}
        match={match}
        score={score as ScoreSummary}
        started={live.eventCount > 0}
        initial={ending ?? 'retired'}
        busy={live.busy}
        onClose={() => setEnding(null)}
        onRetire={(side) => void live.retire(side).then((ok) => ok && setEnding(null))}
        onWalkover={(winner, reason) => void live.walkover(winner, reason).then((ok) => ok && setEnding(null))}
      />
      <AddScorerSheet
        visible={addingScorer}
        busy={live.busy}
        onClose={() => setAddingScorer(false)}
        onPick={(u) =>
          void live.addScorer(u.id).then((ok) => {
            if (!ok) return;
            setAddingScorer(false);
            setNotice(`${firstName(u.fullName)} can score this match now.`);
          })
        }
      />
    </Screen>
  );
}

function Failed({ text }: { text: string }) {
  return (
    <Screen>
      <Header />
      <EmptyState title="Couldn’t open this match" body={text} />
    </Screen>
  );
}

/** /match/[id]: live scoring for scorers, the watching view for everyone else. */
export default function ScoreScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <View style={{ flex: 1 }}>{id ? <Scoring id={id} /> : null}</View>;
}
