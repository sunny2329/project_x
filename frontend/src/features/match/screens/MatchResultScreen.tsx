import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Share, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useProfileStore } from '@/features/profile/store/profile.store';
import { useResource } from '@/shared/hooks/useResource';
import { sportText, useTheme } from '@/shared/theme';
import { Badge, Button, D, EmptyState, Header, Icon, IconButton, Label, Loading, Row, Screen, Sparkline, T } from '@/shared/ui';
import { firstName, minutes } from '@/shared/utils/format';
import { matchApi, shareUrl } from '../api/match.api';
import { useSports } from '../hooks/useSports';
import type { LineupPlayer } from '../lineup';
import { useMatchDraft } from '../store/draft.store';
import type { MatchView } from '../types';
import { sideLabel } from './ScoreScreen';

/** The result line under the winners: score, or W/O / RET. */
function resultLine(m: MatchView): string {
  if (m.resultType === 'walkover' || m.resultType === 'no_show' || m.resultType === 'double_walkover') return m.resultType === 'no_show' ? 'No-show' : 'Walkover';
  return `${m.score.headline}${m.resultType === 'retired' ? ' RET.' : ''}`;
}

function statusBadge(m: MatchView): { label: string; tone: 'pending' | 'bad' | 'neutral' } | null {
  if (m.confirmation.status === 'pending') return { label: 'AWAITING CONFIRMATION', tone: 'pending' };
  if (m.confirmation.status === 'disputed' || m.status === 'disputed') return { label: 'DISPUTED', tone: 'bad' };
  if (m.status === 'abandoned') return { label: 'ABANDONED', tone: 'neutral' };
  if (m.resultType === 'retired') return { label: 'RETIRED', tone: 'neutral' };
  if (m.resultType === 'walkover' || m.resultType === 'no_show' || m.resultType === 'double_walkover') return { label: 'WALKOVER', tone: 'neutral' };
  return null;
}

/** A decided match: winners, the score per game / set, my rating change, Rematch / Share / Done. */
export default function MatchResultScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useAuthStore((s) => s.user);
  const profile = useProfileStore((s) => s.profile);
  const { data, error, loading } = useResource(() => matchApi.get(id), [id]);
  const { sports } = useSports();

  useEffect(() => {
    // The rating trend line comes from the profile; refresh it so it includes this match.
    void useProfileStore.getState().load().catch(() => undefined);
  }, [id]);

  if (loading) return <Loading />;
  const m = data?.match;
  if (!m) {
    return (
      <Screen>
        <Header icon="close" />
        <EmptyState title="Couldn’t load the result" body={error ?? undefined} />
      </Screen>
    );
  }
  if (m.status === 'live') {
    router.replace({ pathname: '/match/[id]', params: { id } });
    return null;
  }

  const color = m.sport.accentColor;
  const ink = colors.ink;
  const winner = m.score.winnerSideIndex;
  const mySide = m.sides.find((s) => s.players.some((p) => p.userId === me?.id)) ?? null;
  const mine = mySide?.players.find((p) => p.userId === me?.id);
  const letter = mySide && winner !== null ? (mySide.index === winner ? 'W' : 'L') : null;
  const myChange = mine ? m.ratingChanges.find((r) => r.playerId === mine.playerId) : undefined;
  const partner = mySide?.players.find((p) => p.userId && p.userId !== me?.id);
  const partnerChange = partner ? m.ratingChanges.find((r) => r.playerId === partner.playerId) : undefined;
  const delta = myChange ? Math.round(myChange.after - myChange.before) : null;
  const trend = profile?.ratingTrends.find((t) => t.sportId === m.sport.id)?.points ?? [];
  const badge = statusBadge(m);
  const segs = m.score.segments.filter((s) => s.complete || s.scores.some((n) => n > 0));
  const unit = m.score.totals.majorLabel === 'Sets' ? 'SET' : 'GAME';
  const duration = m.startedAt && m.completedAt ? minutes((Date.parse(m.completedAt) - Date.parse(m.startedAt)) / 1000) : null;
  const decided = m.status === 'completed' || m.status === 'retired' || m.status === 'walkover';
  const share = () => void Share.share({ message: `${m.sides.map((s) => s.name).join(' vs ')}: ${m.score.headline}\n${shareUrl(m)}`, url: shareUrl(m) });

  const rematch = () => {
    const sport = sports?.find((s) => s.id === m.sport.id || s.slug === m.sport.slug);
    if (!sport) return router.push('/match/new');
    const lineup = m.sides.map((s) =>
      s.players.map((p): LineupPlayer => ({ key: p.userId ?? p.playerId, displayName: p.displayName, isGuest: p.isGuest, userId: p.userId, input: { playerId: p.playerId } })),
    );
    useMatchDraft.getState().restore({ sport, formatCode: m.format.code, rulesetId: m.ruleset.id, lineup, firstServer: 0 });
    router.push('/match/serve');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 20, paddingBottom: 22, backgroundColor: color, gap: 14, overflow: 'hidden' }}>
        {letter ? (
          <D size={220} lh={200} color="rgba(10,15,28,0.08)" style={{ position: 'absolute', right: -18, top: insets.top - 24 }}>
            {letter}
          </D>
        ) : null}
        <Row between>
          <IconButton icon="close" label="Close" tone="translucent" color={ink} onPress={() => (router.canGoBack() ? router.dismissAll() : router.replace('/'))} />
          <T size={13} w={700} color={ink} numberOfLines={1} style={{ flexShrink: 1 }}>
            {[m.sport.name, m.format.name, duration].filter(Boolean).join(' · ')}
          </T>
          <IconButton icon="share" label="Share" tone="translucent" color={ink} onPress={share} />
        </Row>
        <View style={{ gap: 4 }}>
          <T size={13} w={800} ls={0.1} color={ink}>
            {winner === null ? (m.status === 'abandoned' ? 'NO RESULT' : 'DRAW') : m.sides[winner]!.players.length > 1 ? 'WINNERS' : 'WINNER'}
          </T>
          <D size={56} lh={52} upper color={ink} numberOfLines={2}>
            {winner === null ? m.sides.map((s) => s.name).join(' v ') : sideLabel(m, winner, true)}
          </D>
          <D size={26} w={800} color={ink}>
            {resultLine(m)}
          </D>
          {badge ? <Badge label={badge.label} tone={badge.tone} style={{ marginTop: 6 }} /> : null}
        </View>
      </View>

      <Screen
        edgeToEdge
        gap={14}
        contentStyle={{ paddingTop: 18 }}
        footer={
          <View style={{ gap: 10 }}>
            <Row gap={10}>
              <Button label="Rematch" icon="rematch" variant="outline" height={54} size={15} style={{ flex: 1 }} onPress={rematch} />
              <Button label="Share" icon="share" variant="outline" height={54} size={15} style={{ flex: 1 }} onPress={share} />
            </Row>
            <Button label="Done" weight={800} onPress={() => (router.canGoBack() ? router.dismissAll() : router.replace('/'))} />
          </View>
        }
      >
        {segs.length ? (
          <View style={{ borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 14 }}>
              <T size={12} w={700} ls={0.06} color={colors.muted} flex>
                {unit}
              </T>
              {segs.map((s) => (
                <T key={s.sequence} size={12} w={700} color={colors.muted} center style={{ width: 44 }}>
                  {s.type === 'match_tiebreak' ? 'TB' : s.sequence}
                </T>
              ))}
            </View>
            {m.sides.map((side) => {
              const won = side.index === winner;
              return (
                <View key={side.index} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: colors.raised }}>
                  <T size={15} w={won ? 700 : 400} color={won ? colors.fg : colors.soft} flex numberOfLines={1}>
                    {sideLabel(m, side.index, true)}
                  </T>
                  {segs.map((s) => {
                    const took = s.winnerSideIndex === side.index;
                    return (
                      <D key={s.sequence} size={22} w={took ? 900 : 800} color={took ? (won ? sportText(colors, m.sport.slug) : colors.fg) : colors.muted} style={{ width: 44, textAlign: 'center' }}>
                        {s.display[side.index]}
                      </D>
                    );
                  })}
                </View>
              );
            })}
          </View>
        ) : null}

        {myChange && delta !== null ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Label>Your {m.sport.name.toLowerCase()} rating</Label>
              <Row gap={8} style={{ alignItems: 'baseline' }}>
                <D size={40} lh={40}>
                  {Math.round(myChange.after)}
                </D>
                <T size={15} w={800} color={delta >= 0 ? colors.good : colors.bad}>
                  {delta >= 0 ? `+${delta}` : delta}
                </T>
              </Row>
              {partner && partnerChange ? (
                <T size={12} color={colors.muted}>
                  Partner {firstName(partner.displayName)} also {Math.round(partnerChange.after - partnerChange.before) >= 0 ? '+' : ''}
                  {Math.round(partnerChange.after - partnerChange.before)}
                </T>
              ) : null}
            </View>
            <Sparkline points={trend.length >= 2 ? trend : [myChange.before, myChange.after]} color={sportText(colors, m.sport.slug)} />
          </View>
        ) : null}

        {m.confirmation.status === 'pending' ? (
          <Row gap={10}>
            <Icon name="clock" size={18} color={colors.muted} />
            <T size={13} color={colors.muted} flex>
              Waiting for the other side to confirm. Ratings change once they do.
            </T>
          </Row>
        ) : decided && m.status !== 'walkover' ? (
          <Row gap={10}>
            <Icon name="check" size={18} color={colors.good} />
            <T size={13} color={colors.muted} flex>
              Posted to your feed and both {m.sides.some((s) => s.players.length > 1) ? 'teams’' : 'players’'} profiles
            </T>
          </Row>
        ) : null}
        {m.confirmation.decisions
          .filter((d) => d.decision === 'disputed' && d.comment)
          .map((d) => (
            <View key={d.sideIndex} style={{ padding: 14, borderRadius: 14, backgroundColor: 'rgba(255,84,104,0.1)', gap: 4 }}>
              <T size={13} w={700} color={colors.bad}>
                {d.displayName} disputed this result
              </T>
              <T size={14} color={colors.soft}>
                “{d.comment}”
              </T>
            </View>
          ))}
      </Screen>
    </View>
  );
}
