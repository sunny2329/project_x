import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, TextInput, View } from 'react-native';
import { createScorer, manualResultEvents, ScoringError, scoringRegistry } from '@/engine/scoring';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { useTheme } from '@/shared/theme';
import { Button, Dot, Field, Header, Icon, Notice, Row, Screen, T, Tap, TextButton } from '@/shared/ui';
import { firstName, toDay, weekdayComma } from '@/shared/utils/format';
import { matchApi } from '../api/match.api';
import { checkHoopsResult, configFromSetup, formatCode, hoopsRules, setupLine, shortTeam } from '../basketball';
import { useMatchDraft } from '../store/draft.store';
import type { SportSummary } from '../types';

const BLUE = '#3B82F6';
const MAX = 300;

/** The typed-in score checked by the friendly rules first, then by the engine (as the server will). */
export function hoopsResultCheck(a: number, b: number, config: Record<string, unknown>, names: string[], players: number[]): { ok: boolean; text: string } {
  if (a === 0 && b === 0) return { ok: false, text: 'Enter the final score.' };
  const friendly = checkHoopsResult(a, b, hoopsRules(config), names);
  if (!friendly.ok) return friendly;
  try {
    const scorer = createScorer(scoringRegistry, 'baskets', config, players.map((n, index) => ({ index, playerCount: Math.max(1, n) })));
    manualResultEvents(scorer, [[a, b]]);
    return friendly;
  } catch (e) {
    return { ok: false, text: e instanceof ScoringError ? e.message : 'That score doesn’t fit these rules.' };
  }
}

function ScoreBox({ label, value, on, onChange }: { label: string; value: number; on: boolean; onChange: (v: number) => void }) {
  const { colors } = useTheme();
  const step = (d: number) => onChange(Math.max(0, Math.min(MAX, value + d)));
  const short = shortTeam(label);
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <T size={13} w={700} center numberOfLines={1}>
        {label}
      </T>
      <TextInput
        accessibilityLabel={`${label} points`}
        keyboardType="number-pad"
        maxLength={3}
        value={String(value)}
        onChangeText={(t) => onChange(Math.min(MAX, Number(t.replace(/\D/g, '')) || 0))}
        selectTextOnFocus
        style={{ height: 96, borderRadius: 18, backgroundColor: on ? colors.bbTint : colors.surface, borderWidth: on ? 2 : 1, borderColor: on ? BLUE : colors.line2, textAlign: 'center', fontFamily: 'BigShouldersDisplay_900Black', fontSize: 56, color: colors.fg }}
      />
      <Row gap={6}>
        {(
          [
            ['−', -1, `Lower ${short} score`],
            ['+', 1, `Raise ${short} score`],
          ] as const
        ).map(([text, d, a11y]) => (
          <Pressable key={text} accessibilityRole="button" accessibilityLabel={a11y} onPress={() => step(d)} style={{ flex: 1, height: 40, borderRadius: 10, backgroundColor: colors.raised, alignItems: 'center', justifyContent: 'center' }}>
            <T size={20} w={700}>
              {text}
            </T>
          </Pressable>
        ))}
      </Row>
    </View>
  );
}

/** "Enter a basketball result": the rules as set up, the final score with −/+, a live check, date and court. */
export function BasketballResult({ sport }: { sport: SportSummary }) {
  const { colors } = useTheme();
  const { rulesetId, lineup, hoops } = useMatchDraft();
  const [a, setA] = useState(0);
  const [b, setB] = useState(0);
  const [date, setDate] = useState(new Date());
  const [picking, setPicking] = useState(false);
  const [venue, setVenue] = useState('');
  const { submit, submitting, formError } = useSubmit();

  const config = configFromSetup(hoops.setup, hoops.tagPlayers, 0);
  const names = hoops.names.map((n, i) => n.trim() || `Team ${i === 0 ? 'A' : 'B'}`);
  const check = hoopsResultCheck(a, b, config, names, lineup.map((p) => p.length));
  const empty = lineup.some((p) => p.length === 0);
  const confirmers = (lineup[1] ?? []).filter((p) => !p.isGuest && p.userId);
  const confirmer = confirmers[0] ? firstName(confirmers[0].displayName) : null;

  const send = () =>
    void submit(async () => {
      await matchApi.create({
        sport: sport.slug,
        format: formatCode(hoops.setup),
        ...(rulesetId ? { rulesetId } : {}),
        rulesOverride: config,
        sides: lineup.map((players, side) => ({
          name: names[side],
          color: hoops.colors[side],
          players: players.map((p) => {
            const n = hoops.jerseys[p.key];
            return typeof n === 'number' ? { ...p.input, jerseyNumber: n } : p.input;
          }),
        })),
        manualScores: [[a, b]],
        playedOn: toDay(date),
        ...(venue.trim() ? { venueName: venue.trim() } : {}),
      });
      useMatchDraft.getState().reset();
      router.dismissAll();
      router.push('/profile/matches');
    });

  return (
    <Screen
      gap={16}
      footer={
        <View style={{ gap: 10 }}>
          <T size={13} lh={19} color={colors.muted} center>
            {empty
              ? 'Add at least one player to each team.'
              : confirmer
                ? `${confirmer} (${shortTeam(names[1]!)}) gets a request. Ratings change only after they confirm.`
                : 'Guests can’t confirm, so this goes straight into your history without changing ratings.'}
          </T>
          {formError ? <Notice tone="error" icon="alert" text={formError} /> : null}
          <Button label={confirmer ? `Send to ${confirmer} to confirm` : 'Save result'} weight={800} disabled={!check.ok || empty} loading={submitting} onPress={send} />
        </View>
      }
    >
      <Header title="Enter a basketball result" />

      <Row gap={10} style={{ paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: colors.surface }}>
        <Dot color={BLUE} />
        <T size={14} w={600} flex numberOfLines={1}>
          {setupLine(hoops.setup)}
        </T>
        <TextButton label="Change" size={13} color={colors.soft} onPress={() => router.push({ pathname: '/match/setup', params: { mode: 'result' } })} />
      </Row>

      <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/match/teams', params: { mode: 'result' } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: colors.surface }}>
        <Icon name="people" size={18} color={colors.muted} />
        <T size={14} w={600} flex numberOfLines={1}>
          {lineup.map((p, i) => `${shortTeam(names[i]!)} ${p.length}`).join(' · ')} players
        </T>
        <T size={13} w={700} color={colors.soft}>
          Teams
        </T>
      </Pressable>

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
        <ScoreBox label={names[0]!} value={a} on={a >= b} onChange={setA} />
        <T size={24} color={colors.faint} style={{ paddingBottom: 64 }}>
          –
        </T>
        <ScoreBox label={names[1]!} value={b} on={b > a} onChange={setB} />
      </View>

      <View accessibilityRole="alert" style={{ flexDirection: 'row', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: check.ok ? colors.bbTint : 'rgba(255,84,104,0.12)' }}>
        <Icon name={check.ok ? 'check' : 'alert'} size={18} color={check.ok ? colors.tBb : '#FF8A98'} />
        <T size={14} lh={20} w={600} color={check.ok ? colors.tBb : '#FF8A98'} flex>
          {check.text}
        </T>
      </View>

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
        <Field placeholder="Which court (optional)" value={venue} onChangeText={setVenue} height={52} size={16} maxLength={80} accessibilityLabel="Venue" />
      </View>
    </Screen>
  );
}
