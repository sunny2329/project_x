import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useResource } from '@/shared/hooks/useResource';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { LIVE, useTheme, withAlpha } from '@/shared/theme';
import { Avatar, Badge, Button, D, Dot, EmptyState, Field, Header, Icon, Loading, Notice, Row, Screen, Segmented, T } from '@/shared/ui';
import { weekdayDayMonth } from '@/shared/utils/format';
import { matchApi } from '../api/match.api';
import { eloChange } from '../rules';
import { sideLabel } from './ScoreScreen';

type Answer = 'accept' | 'dispute';

/** The opponent's side of a typed-in result: accept it, or dispute it with a note. */
export default function ConfirmResultScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useAuthStore((s) => s.user);
  const match = useResource(() => matchApi.get(id), [id]);
  const details = useResource(() => matchApi.details(id), [id]);
  const [answer, setAnswer] = useState<Answer>('accept');
  const [note, setNote] = useState('');
  const { submit, submitting, formError } = useSubmit();

  if (match.loading) return <Loading />;
  const m = match.data?.match;
  if (!m) {
    return (
      <Screen>
        <Header title="Confirm a result" />
        <EmptyState title="Couldn’t load the result" body={match.error ?? undefined} />
      </Screen>
    );
  }

  const creator = m.sides.flatMap((s) => s.players).find((p) => p.userId === m.createdByUserId);
  const mySide = m.sides.find((s) => s.players.some((p) => p.userId === me?.id)) ?? m.sides[1]!;
  const other = m.sides.find((s) => s.index !== mySide.index)!;
  const order = [other, mySide];
  const winner = m.score.winnerSideIndex;
  const segs = m.score.segments.filter((s) => s.complete);
  const playedAt = m.completedAt ?? m.startedAt;

  // Elo preview with the ratings the server has now (registered players only).
  const ratingOf = (playerId: string) => details.data?.details.players.find((p) => p.playerId === playerId)?.rating ?? null;
  const avg = (side: typeof mySide) => {
    const rs = side.players.map((p) => ratingOf(p.playerId)).filter((r): r is number => r !== null);
    return rs.length === side.players.length && rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null;
  };
  const myPlayer = mySide.players.find((p) => p.userId === me?.id);
  const myRating = myPlayer ? ratingOf(myPlayer.playerId) : null;
  const [mine, theirs] = [avg(mySide), avg(other)];
  const preview =
    myRating !== null && mine !== null && theirs !== null && winner !== null
      ? Math.round(myRating + eloChange(mine, theirs, winner === mySide.index ? 0 : 1))
      : null;

  const pending = m.confirmation.status === 'pending' && m.confirmation.canConfirm;
  const send = () =>
    void submit(async () => {
      await matchApi.confirm(id, answer === 'accept' ? 'confirmed' : 'disputed', answer === 'dispute' ? note.trim() : undefined);
      router.replace('/profile/matches');
    });

  return (
    <Screen
      gap={18}
      footer={
        pending ? (
          <View style={{ gap: 10 }}>
            {formError ? <Notice tone="error" icon="alert" text={formError} /> : null}
            <Button
              label={answer === 'accept' ? 'Confirm result' : 'Send dispute'}
              weight={800}
              color={answer === 'accept' ? undefined : LIVE}
              textColor={answer === 'accept' ? undefined : colors.onPrimary}
              disabled={answer === 'dispute' && !note.trim()}
              loading={submitting}
              onPress={send}
            />
          </View>
        ) : undefined
      }
    >
      <Header title="Confirm a result" />

      <Row gap={12}>
        <Avatar name={creator?.displayName ?? 'Opponent'} id={creator?.userId} photoUrl={details.data?.details.players.find((p) => p.userId === m.createdByUserId)?.photoUrl} size={48} />
        <View style={{ flex: 1, gap: 2 }}>
          <T size={16} w={700}>
            {creator?.displayName ?? 'Your opponent'} entered this result
          </T>
          <T size={13} color={colors.muted}>
            {m.sport.name} · {m.format.name}
            {playedAt ? ` · played ${weekdayDayMonth(playedAt)}` : ''}
          </T>
        </View>
      </Row>

      <View style={{ borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' }}>
        <Row between style={{ paddingVertical: 12, paddingHorizontal: 16, backgroundColor: withAlpha(m.sport.accentColor, 0.12) }}>
          <Row gap={8} style={{ flexShrink: 1 }}>
            <Dot color={m.sport.accentColor} />
            <T size={13} w={700} numberOfLines={1}>
              {m.ruleset.name}
            </T>
          </Row>
          {pending ? <Badge label="AWAITING YOU" tone="pending" /> : <Badge label={m.confirmation.status.toUpperCase()} tone={m.confirmation.status === 'disputed' ? 'bad' : 'neutral'} />}
        </Row>
        {order.map((side, i) => {
          const won = side.index === winner;
          return (
            <Row key={side.index} gap={12} style={{ padding: 16, borderBottomWidth: i === 0 ? 1 : 0, borderBottomColor: colors.raised }}>
              <View style={{ width: 4, height: 28, borderRadius: 2, backgroundColor: won ? m.sport.accentColor : 'transparent' }} />
              <T size={17} w={won ? 700 : 400} color={won ? colors.fg : colors.soft} flex numberOfLines={1}>
                {side.index === mySide.index ? 'You' : sideLabel(m, side.index, true)}
              </T>
              <D size={segs.length > 1 ? 30 : 44} lh={44} color={won ? colors.fg : colors.muted}>
                {segs.map((s) => s.display[side.index]).join('  ')}
              </D>
            </Row>
          );
        })}
      </View>

      {preview !== null && myRating !== null ? (
        <Row gap={12} style={{ paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: colors.surface }}>
          <Icon name="trend" size={20} color={colors.fg} />
          <T size={14} color={colors.soft} flex>
            If you accept, your {m.sport.name.toLowerCase()} rating goes{' '}
            <T size={14} w={700}>
              {Math.round(myRating)} → {preview}
            </T>
          </T>
        </Row>
      ) : null}

      {pending ? (
        <>
          <Segmented<Answer>
            options={[
              { value: 'accept', label: 'That’s right' },
              { value: 'dispute', label: 'That’s wrong' },
            ]}
            value={answer}
            onChange={setAnswer}
            activeColor={answer === 'dispute' ? LIVE : undefined}
            activeText={answer === 'dispute' ? colors.ink : undefined}
          />
          {answer === 'dispute' ? (
            <Field
              label={`What happened? ${creator ? creator.displayName.split(' ')[0] : 'They'} ${creator ? 'sees' : 'see'} this.`}
              value={note}
              onChangeText={setNote}
              multiline
              height={96}
              size={15}
              maxLength={500}
              hint="A disputed result doesn’t count in records or ratings."
              autoFocus
            />
          ) : null}
        </>
      ) : (
        <Notice tone="info" icon="info" text={m.confirmation.status === 'confirmed' ? 'This result is confirmed.' : m.confirmation.status === 'disputed' ? 'This result is disputed and doesn’t count.' : 'Nothing to confirm here.'} />
      )}
    </Screen>
  );
}
