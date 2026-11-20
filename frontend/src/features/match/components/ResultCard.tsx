/*
 * Design v2 match result (racket sports & cricket): the orange share card, rating changes for
 * everyone, an invite for each guest, Rematch / Share result card.
 */
import { router } from 'expo-router';
import { Share, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, withAlpha } from '@/shared/theme';
import { Badge, Button, D, Icon, IconButton, Screen, T, Tap } from '@/shared/ui';
import { firstName } from '@/shared/utils/format';
import { shareUrl } from '../api/match.api';
import { ratingRows, resultHeadline, resultKicker, resultStats, unratedReason } from '../result';
import { sideLabel } from '../screens/ScoreScreen';
import type { MatchView } from '../types';

export function ResultCardScreen({
  match: m,
  myUserId,
  durationMin,
  badge,
  onRematch,
}: {
  match: MatchView;
  myUserId: string | undefined;
  durationMin: number | null;
  badge: { label: string; tone: 'pending' | 'bad' | 'neutral' } | null;
  onRematch: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const head = resultHeadline(m, myUserId);
  const winner = m.score.winnerSideIndex;
  const me = m.sides.flatMap((s) => s.players).find((p) => p.userId && p.userId === myUserId);
  const myChange = me ? m.ratingChanges.find((r) => r.playerId === me.playerId) : undefined;
  const myDelta = myChange ? Math.round(myChange.after - myChange.before) : null;
  const stats = resultStats(m, head.refSide, myDelta, durationMin);
  const rows = ratingRows(m);
  const reason = unratedReason(m);
  const guests = m.sides.flatMap((s) => s.players).filter((p) => p.isGuest);
  const segs = m.score.segments.filter((s) => s.complete || s.scores.some((n) => n > 0));
  const close = () => (router.canGoBack() ? router.dismissAll() : router.replace('/'));
  const url = shareUrl(m);

  const shareCard = () =>
    void Share.share({ message: `${head.title}${head.score ? ` ${head.score}` : ''}: ${m.sides.map((_, i) => sideLabel(m, i, true)).join(' vs ')} (${m.score.headline}) · ${m.sport.name} on ProjectX\n${url}`, url }).catch(() => undefined);
  const invite = (name: string) =>
    void Share.share({
      message: `${firstName(name)}, our ${m.sport.name.toLowerCase()} match is on ProjectX (${m.score.headline}). Join with your phone number and it becomes yours: stats and rating start counting from today.\n${url}`,
      url,
    }).catch(() => undefined);

  return (
    <Screen
      gap={14}
      contentStyle={{ paddingTop: insets.top ? 0 : 6 }}
      footer={
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button label="Rematch" variant="outline" height={56} size={15} style={{ flex: 1 }} onPress={onRematch} />
          <Button label="Share result card" icon="upload" color={colors.fg} textColor={colors.bg} height={56} size={15} weight={700} style={{ flex: 1.6 }} onPress={shareCard} />
        </View>
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <IconButton icon="close" label="Close" tone="plain" onPress={close} />
        <T size={13} color={colors.muted} center flex>
          {m.status === 'abandoned' ? 'Match abandoned' : 'Match complete'}
          {durationMin ? ` · ${durationMin} min` : ''}
        </T>
        <View style={{ width: 44 }} />
      </View>

      <View style={{ backgroundColor: colors.hero, borderRadius: 24, padding: 20, gap: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <T size={11} w={700} ls={0.08} color={colors.onHero} flex numberOfLines={1}>
            {resultKicker(m)}
          </T>
          <D size={16} color={colors.onHero}>
            PROJECT X
          </D>
        </View>
        <View>
          <D size={56} lh={56} color={colors.onHero} numberOfLines={2}>
            {head.title}
          </D>
          {head.score ? (
            <D size={56} lh={56} color={colors.onHero}>
              {head.score}
            </D>
          ) : null}
          {badge ? <Badge label={badge.label} tone={badge.tone} style={{ marginTop: 8, alignSelf: 'flex-start' }} /> : null}
        </View>

        {segs.length ? (
          <View style={{ gap: 8 }}>
            {m.sides.map((side) => {
              const won = side.index === winner;
              return (
                <View key={side.index} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <T size={15} w={won ? 700 : 400} color={colors.onHero} flex numberOfLines={1}>
                    {sideLabel(m, side.index, true)}
                  </T>
                  {segs.map((s) => {
                    const took = s.winnerSideIndex === side.index;
                    return (
                      <D key={s.sequence} size={22} w={took ? 700 : 500} color={took ? colors.onHero : colors.heroMuted} right style={{ minWidth: 38, opacity: took ? 1 : 0.85 }}>
                        {s.display[side.index] ?? s.scores[side.index]}
                      </D>
                    );
                  })}
                </View>
              );
            })}
          </View>
        ) : null}

        {stats.length ? (
          <View style={{ flexDirection: 'row', gap: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: withAlpha(colors.onHero, 0.35) }}>
            {stats.map((s) => (
              <View key={s.label} style={{ flex: 1, gap: 2 }}>
                <D size={22} lh={24} color={colors.onHero}>
                  {s.value}
                </D>
                <T size={11} color={colors.heroMuted}>
                  {s.label}
                </T>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {rows.length ? (
        <View style={{ backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.line, padding: 16, gap: 10 }}>
          <T size={13} w={700}>
            Rating changes · {m.sport.name}
          </T>
          {rows.map((r) => (
            <View key={r.playerId} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <T size={14} color={r.kind === 'change' ? colors.fg : colors.muted} flex numberOfLines={1}>
                {r.name}
                {r.kind === 'guest' ? ' (guest)' : ''}
              </T>
              {r.kind === 'change' ? (
                <T size={14} w={700} color={r.after >= r.before ? colors.good : colors.bad} accessibilityLabel={`${r.before} to ${r.after}`}>
                  {r.before} → {r.after}
                </T>
              ) : (
                <T size={13} color={colors.muted}>
                  {r.kind === 'guest' ? 'Unrated until claimed' : 'Not rated'}
                </T>
              )}
            </View>
          ))}
          {reason ? (
            <T size={12} color={colors.muted}>
              {reason}
            </T>
          ) : null}
        </View>
      ) : null}

      {guests.map((g) => (
        <Tap
          key={g.playerId}
          label={`Invite ${firstName(g.displayName)} to claim this match`}
          onPress={() => invite(g.displayName)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.primary, backgroundColor: colors.accentSoft }}
        >
          <Icon name="personAdd" size={20} color={colors.accentText} />
          <View style={{ flex: 1, gap: 2 }}>
            <T size={14} w={700} color={colors.accentText}>
              Invite {firstName(g.displayName)} to claim this match
            </T>
            <T size={12} color={colors.accentText}>
              Their stats and rating start counting from today
            </T>
          </View>
        </Tap>
      ))}

      {m.confirmation.decisions
        .filter((d) => d.decision === 'disputed' && d.comment)
        .map((d) => (
          <View key={d.sideIndex} style={{ padding: 14, borderRadius: 14, backgroundColor: colors.badBg, gap: 4 }}>
            <T size={13} w={700} color={colors.bad}>
              {d.displayName} disputed this result
            </T>
            <T size={14} color={colors.fg}>
              “{d.comment}”
            </T>
          </View>
        ))}
    </Screen>
  );
}
