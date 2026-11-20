import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Share, View } from 'react-native';
import { createScorer, scoringRegistry } from '@/engine/scoring';
import { useScoringPrefs } from '@/shared/prefs/scoring-prefs.store';
import { useTheme } from '@/shared/theme';
import { Button, EmptyState, goBack, Header, IconButton, Loading, Notice, Row, Screen, showAlert, sportIcon } from '@/shared/ui';
import { firstName } from '@/shared/utils/format';
import { BasketballBoard } from '../components/basketball/Board';
import { QuarterBreakView } from '../components/basketball/QuarterBreak';
import { CricketActions, CricketPad, CricketScoreboard, ThisOver } from '../components/CricketBoard';
import { AddScorerSheet, EndEarlySheet, ScorerMenu } from '../components/MatchSheets';
import { Callout, previewHint, ScoreHeader, SetsTable } from '../components/Scoreboard';
import { CallBlock, GameChips, InfoBanner, ScoringFooter, ScoringHeader, SideCard } from '../components/ScoringV2';
import { shareUrl } from '../api/match.api';
import { banner, ralliesPlayed, serverLine, sidePill, tapHint } from '../scoring-v2';
import { hoopsRules } from '../basketball';
import { useLiveScoring } from '../hooks/useLiveScoring';
import { useGameClock } from '../store/clock.store';
import type { MatchView, PluginEvent, ScoreSummary, ScoringAction } from '../types';
import { SpectatorView } from './SpectatorScreen';

/** "Riya & Kabir" from the players (the side's own name when it has one). */
export function sideLabel(match: MatchView, index: number, short = false): string {
  const side = match.sides[index];
  if (!side) return '';
  // Basketball teams carry their own names ("Pink City Ballers").
  if (match.ruleset.scoringModel === 'baskets' && side.name) return side.name;
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
  /** Basketball: the period whose break is showing (set when a timed period ends). */
  const [breakFor, setBreakFor] = useState<number | null>(null);
  /** "Swap ends": the scorer turned round; side B's card goes on top. */
  const [flipped, setFlipped] = useState(false);
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
  const model = score.scoringModel;
  const tennis = model === 'tennis';
  const sideOut = model === 'side_out';
  const overs = model === 'overs';
  const basketball = model === 'baskets';
  const names = [0, 1].map((i) => sideLabel(match, i));
  const events = match.events; // preview hints only need the server's events + this tap
  const order = flipped ? [1, 0] : [0, 1];
  const bannerText = banner(score, names, match.rulesetConfig);
  const lastEvent = events.filter((e) => e.type === 'rally_won').at(-1);
  const lastRally = lastEvent ? `Point ${match.sides[lastEvent.sideIndex as number]?.players.length === 1 ? firstName(names[lastEvent.sideIndex as number] ?? '') : `Team ${lastEvent.sideIndex === 0 ? 'A' : 'B'}`}` : null;
  const shareLink = () => {
    const url = shareUrl(match);
    void Share.share({ message: `Follow ${names.join(' vs ')} live: ${url}`, url }).catch(() => undefined);
  };

  const tap = (sideIndex: number) => {
    const action = score.actions.find((a) => a.sideIndex === sideIndex);
    if (!action) return;
    if (haptics) void Haptics.selectionAsync().catch(() => undefined);
    live.tap(action.event);
  };

  const ball = (event: PluginEvent) => {
    if (haptics) void Haptics.selectionAsync().catch(() => undefined);
    live.tap(event);
  };

  // Ends an innings or swaps the batting order; ending can't be told apart from a stray tap, so ask.
  const inningsAction = (action: ScoringAction) => {
    if (action.event.type !== 'innings_end') return live.tap(action.event);
    showAlert('End this innings?', 'The other side starts batting. Undo brings it back.', [
      { text: 'Keep batting', style: 'cancel' },
      { text: 'End innings', style: 'destructive', onPress: () => live.tap(action.event) },
    ]);
  };

  const finish = async () => {
    if (await live.complete()) router.replace({ pathname: '/match/[id]/result', params: { id } });
  };

  const abandon = () =>
    showAlert('Abandon this match?', 'Nobody wins and it isn’t counted in records.', [
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
      {basketball && breakFor === score.game?.period && !score.complete ? (
        <QuarterBreakView
          match={match}
          score={score}
          onBack={() => setBreakFor(null)}
          onStart={() => {
            setBreakFor(null);
            const rules = hoopsRules(match.rulesetConfig);
            const period = score.game!.period;
            useGameClock.getState().toggle(match.id, period, rules.periodSeconds(period), rules.shotClock);
          }}
          onBoxScore={() => router.push({ pathname: '/match/[id]/timeline', params: { id, tab: 'box' } })}
        />
      ) : basketball ? (
        <BasketballBoard
          match={match}
          score={score}
          live={live}
          haptics={haptics}
          onLeave={() => goBack('/')}
          onMatchMenu={() => setMenu(true)}
          onFinish={() => void finish()}
          onBreak={() => setBreakFor((score.game?.period ?? 0) + 1)}
        />
      ) : overs ? (
        <>
          <ScoreHeader match={match} live={!score.complete} onClose={score.complete ? undefined : () => goBack('/')} onMenu={() => setMenu(true)} />
          <CricketScoreboard score={score} names={names} slug={match.sport.slug} />
          <Callout score={score} slug={match.sport.slug} color={color} names={names} sideOut={false} />
          {!score.complete ? <ThisOver marks={score.ticker ?? []} /> : null}
          {!score.complete ? <CricketPad actions={score.actions} color={color} onBall={ball} /> : <View style={{ flex: 1 }} />}
          {live.error || notice ? <Notice tone={live.error ? 'error' : 'info'} icon={live.error ? 'alert' : 'check'} text={(live.error ?? notice)!} /> : null}
          {live.offline ? <Notice tone="warn" icon="alert" text="No connection. Your taps are saved and will be sent." /> : null}
          {score.complete ? (
            <Row gap={10}>
              <IconButton icon="undo" label="Undo last ball" size={56} radius={16} style={{ borderWidth: 1, borderColor: colors.line2 }} onPress={live.undo} />
              <Button label={live.syncing && !live.busy ? 'Finish match · saving' : 'Finish match'} weight={800} style={{ flex: 1 }} loading={live.busy} onPress={() => void finish()} />
            </Row>
          ) : (
            <Row gap={10}>
              <Button label="Undo" icon="undo" variant="surface" inline px={20} style={{ borderWidth: 1, borderColor: colors.line2 }} disabled={!live.eventCount} onPress={live.undo} />
              <CricketActions actions={score.actions} onAction={inningsAction} />
            </Row>
          )}
        </>
      ) : (
        <>
          <ScoringHeader match={match} rallies={ralliesPlayed(match.events)} live={!score.complete} onBack={score.complete ? undefined : () => goBack('/')} onShare={shareLink} />

          {score.complete ? (
            <CallBlock title="MATCH OVER" detail="Finish to save the result and update ratings" value={score.headline.split(', ').length <= 3 ? score.headline : null} />
          ) : sideOut && score.callout ? (
            <CallBlock title="CALL THE SCORE" detail={serverLine(match, score)} value={score.callout.split('-').join(' - ')} />
          ) : null}

          {tennis ? (
            <SetsTable score={score} names={names.map((n) => n.replace(/ & /g, ' / '))} slug={match.sport.slug} color={colors.primary} />
          ) : (
            <GameChips score={score} note={sideOut && !score.complete ? lastRally : null} />
          )}

          {bannerText ? <InfoBanner text={bannerText} /> : null}

          {order.map((i) => {
            const action = score.actions.find((a) => a.sideIndex === i);
            const side = score.sides[i]!;
            const big = score.complete ? (tennis ? side.primary : (score.segments.filter((s) => s.complete).at(-1)?.display[i] ?? side.primary)) : (side.current ?? side.primary);
            const preview = sideOut ? null : previewHint(scorer, events, action, score);
            return (
              <SideCard
                key={i}
                name={names[i]!}
                sub={tennis ? null : `${score.totals.majorLabel.toLowerCase()} ${side.primary}`}
                value={big}
                icon={sportIcon(match.sport.slug)}
                pill={sidePill(match, score, i)}
                hint={tapHint(score, action, preview)}
                active={score.complete ? score.winnerSideIndex === i : side.serving}
                winner={score.complete && score.winnerSideIndex === i}
                dim={score.complete && score.winnerSideIndex !== i}
                label={action && !score.complete ? `${action.label} to ${names[i]}, ${big}` : `${names[i]}, ${big}`}
                onPress={score.complete ? undefined : () => tap(i)}
              />
            );
          })}

          {live.error || notice ? <Notice tone={live.error ? 'error' : 'info'} icon={live.error ? 'alert' : 'check'} text={(live.error ?? notice)!} /> : null}
          {live.offline ? <Notice tone="warn" icon="alert" text="No connection. Your taps are saved and will be sent." /> : null}

          {score.complete ? (
            <Row gap={10}>
              <IconButton icon="undo" label="Undo last point" size={56} radius={16} style={{ borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card }} onPress={live.undo} />
              <Button label={live.syncing && !live.busy ? 'Finish match · saving points' : 'Finish match'} weight={800} style={{ flex: 1 }} loading={live.busy} onPress={() => void finish()} />
            </Row>
          ) : (
            <ScoringFooter canUndo={!!live.eventCount} onUndo={live.undo} middle={{ label: 'Swap ends', icon: 'swap', onPress: () => setFlipped((f) => !f) }} onMenu={() => setMenu(true)} />
          )}
        </>
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
