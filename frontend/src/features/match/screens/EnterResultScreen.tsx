import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { useTheme } from '@/shared/theme';
import { Button, Dot, EmptyState, Field, Header, Notice, Row, Screen, T, Tap, TextButton } from '@/shared/ui';
import { firstName, toDay, weekdayComma } from '@/shared/utils/format';
import { matchApi } from '../api/match.api';
import { checkResult, ResultGrid } from '../components/ResultGrid';
import { lineupProblem } from '../lineup';
import { useMatchDraft } from '../store/draft.store';

/** "Already played?": type the score per game; the opponent confirms before ratings move. */
export default function EnterResultScreen() {
  const { colors } = useTheme();
  const me = useAuthStore((s) => s.user);
  const { sport, formatCode, rulesetId, lineup } = useMatchDraft();
  const [cells, setCells] = useState<string[][]>([]);
  const [date, setDate] = useState(new Date());
  const [picking, setPicking] = useState(false);
  const [venue, setVenue] = useState('');
  const { submit, submitting, formError } = useSubmit();

  const ruleset = sport?.rulesets.find((r) => r.id === rulesetId) ?? sport?.rulesets[0];
  const format = sport?.formats.find((f) => f.code === formatCode) ?? sport?.formats[0];
  if (!sport || !ruleset || !format) {
    return (
      <Screen>
        <Header title="Enter a result" />
        <EmptyState title="Pick a sport first" action={<Button label="Choose a sport" inline onPress={() => router.replace('/match/new')} />} />
      </Screen>
    );
  }

  const nameOf = (side: number) => {
    const players = lineup[side] ?? [];
    if (!players.length) return side === 0 ? 'You' : 'Opponent';
    return players.map((p) => (p.userId === me?.id ? 'You' : firstName(p.displayName))).join(' & ');
  };
  const confirmers = (lineup[1] ?? []).filter((p) => !p.isGuest && p.userId);
  const confirmerName = confirmers.map((p) => firstName(p.displayName)).join(' & ');
  const problem = lineupProblem(lineup, format);
  const check = checkResult(ruleset, cells, lineup.map((p) => p.length));

  const send = () =>
    void submit(async () => {
      await matchApi.create({
        sport: sport.slug,
        format: format.code,
        rulesetId: ruleset.id,
        sides: lineup.map((players) => ({ players: players.map((p) => p.input) })),
        manualScores: check.filled,
        playedOn: toDay(date),
        ...(venue.trim() ? { venueName: venue.trim() } : {}),
      });
      useMatchDraft.getState().reset();
      router.dismissAll();
      router.push('/profile/matches');
    });

  return (
    <Screen
      gap={18}
      footer={
        <View style={{ gap: 10 }}>
          <T size={13} lh={19} color={colors.muted} center>
            {problem
              ? problem
              : confirmers.length
                ? `${confirmerName} ${confirmers.length > 1 ? 'get' : 'gets'} a request. Ratings change only after they confirm.`
                : 'Guests can’t confirm, so this goes straight into your history without changing ratings.'}
          </T>
          {formError ? <Notice tone="error" icon="alert" text={formError} /> : null}
          <Button label={confirmers.length ? `Send to ${confirmerName} to confirm` : 'Save result'} weight={800} disabled={!check.complete || !!problem} loading={submitting} onPress={send} />
        </View>
      }
    >
      <Header title="Enter a result" />

      <Row gap={10} style={{ paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: colors.surface }}>
        <Dot color={sport.accentColor} />
        <T size={14} w={600} flex numberOfLines={1}>
          {[sport.name, format.name, ruleset.name].join(' · ')}
        </T>
        <TextButton label="Change" size={13} color={colors.soft} onPress={() => router.push({ pathname: '/match/setup', params: { mode: 'result' } })} />
      </Row>

      <ResultGrid ruleset={ruleset} names={[nameOf(0), nameOf(1)]} cells={cells} onChange={setCells} check={check} />

      <View style={{ gap: 8 }}>
        <T size={13} w={600} color={colors.muted}>
          Played on
        </T>
        <Tap label="Played on" onPress={() => setPicking(true)} style={{ height: 52, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 16, justifyContent: 'center' }}>
          <T size={16} w={600}>
            {weekdayComma(date)}
            {venue.trim() ? ` · ${venue.trim()}` : ''}
          </T>
        </Tap>
        {picking ? (
          <DateTimePicker
            value={date}
            mode="date"
            maximumDate={new Date()}
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={(_, d) => {
              setPicking(Platform.OS === 'ios');
              if (d) setDate(d);
            }}
          />
        ) : null}
        <Field placeholder="Where (optional)" value={venue} onChangeText={setVenue} height={52} size={16} maxLength={80} accessibilityLabel="Venue" />
      </View>
    </Screen>
  );
}
