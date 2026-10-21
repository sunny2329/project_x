import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { useTheme, withAlpha } from '@/shared/theme';
import { Button, D, EmptyState, Header, IconButton, Label, Notice, Row, Screen, T } from '@/shared/ui';
import { firstName } from '@/shared/utils/format';
import { matchApi } from '../api/match.api';
import { CoinToss } from '../components/CoinToss';
import { useMatchDraft } from '../store/draft.store';

const LINE = '#E8F0EC';
const LINE_SOFT = 'rgba(232,240,236,0.6)';

/** "Who serves first?": pick the side on a court (or toss a coin), then the first server in doubles. Starts the match. */
export default function ServeFirstScreen() {
  const { colors } = useTheme();
  const me = useAuthStore((s) => s.user);
  const { sport, formatCode, rulesetId, lineup, firstServer, serveFirst } = useMatchDraft();
  const [tossing, setTossing] = useState(false);
  const { submit, submitting, formError } = useSubmit();

  if (!sport) {
    return (
      <Screen>
        <Header />
        <EmptyState title="Set up the match first" action={<Button label="New match" inline onPress={() => router.replace('/match/new')} />} />
      </Screen>
    );
  }

  const color = sport.accentColor;
  const ruleset = sport.rulesets.find((r) => r.id === rulesetId);
  const nameOf = (p: (typeof lineup)[number][number]) => (p.userId && p.userId === me?.id ? 'You' : p.displayName);
  const sideName = (i: 0 | 1) => lineup[i]!.map((p) => firstName(nameOf(p))).join(' & ') || `Side ${i === 0 ? 'A' : 'B'}`;
  const serving = lineup[firstServer]!;
  const serverKey = serving[0]?.key;
  const pickSide = (side: 0 | 1) => {
    const first = lineup[side]![0];
    if (first) serveFirst(side, first.key);
  };
  const courtNote =
    ruleset?.scoringModel === 'tennis'
      ? 'Serve changes every game. The app tracks it from here.'
      : ruleset?.config.serve && (ruleset.config.serve as { rotation?: string }).rotation === 'alternate'
        ? 'Serve changes every 2 points. The app tracks it from here.'
        : 'At 0-0 the server starts in the right court. The app tracks it from here.';

  const start = () =>
    void submit(async () => {
      const { match } = await matchApi.create({
        sport: sport.slug,
        format: formatCode ?? sport.formats[0]!.code,
        ...(rulesetId ? { rulesetId } : {}),
        sides: lineup.map((players) => ({ players: players.map((p) => p.input) })),
        rulesOverride: { firstServerSideIndex: firstServer },
      });
      useMatchDraft.getState().reset();
      router.dismissAll();
      router.push({ pathname: '/match/[id]', params: { id: match.id } });
    });

  const sideBox = (side: 0 | 1) => {
    const on = firstServer === side;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        accessibilityLabel={`${sideName(side)} serve first`}
        onPress={() => pickSide(side)}
        style={{
          position: 'absolute',
          left: 12,
          right: 12,
          ...(side === 0 ? { top: 12 } : { bottom: 12 }),
          height: 80,
          borderRadius: 14,
          backgroundColor: on ? withAlpha(color, 0.28) : 'rgba(10,10,10,0.55)',
          borderWidth: on ? 2 : 1,
          borderColor: on ? color : 'rgba(232,240,236,0.3)',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-around',
        }}
      >
        {lineup[side]!.map((p) => (
          <Row key={p.key} gap={6}>
            {on && p.key === serverKey ? (
              <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(245,247,251,0.25)', alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }} />
              </View>
            ) : null}
            <T size={15} w={700} color="#F6F2EE" numberOfLines={1}>
              {nameOf(p)}
            </T>
          </Row>
        ))}
      </Pressable>
    );
  };

  return (
    <Screen
      gap={18}
      footer={
        <View style={{ gap: 10 }}>
          {formError ? <Notice tone="error" icon="alert" text={formError} /> : null}
          <Button label="Start match" color={color} height={60} radius={18} size={17} weight={800} loading={submitting} onPress={start} />
        </View>
      }
    >
      <Row between>
        <IconButton icon="back" label="Back" onPress={() => router.back()} />
        <Button label="Toss a coin" icon="coin" variant="outline" height={44} radius={14} size={14} weight={700} inline onPress={() => setTossing(true)} />
      </Row>

      <D size={44} lh={42} upper accessibilityRole="header">
        Who serves first?
      </D>

      <View style={{ height: 300, borderRadius: 18, backgroundColor: '#0F2A24', borderWidth: 2, borderColor: LINE, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', left: 0, right: 0, top: 147, height: 2, backgroundColor: LINE }} />
        <View style={{ position: 'absolute', left: 0, right: 0, top: 102, height: 1, backgroundColor: LINE_SOFT }} />
        <View style={{ position: 'absolute', left: 0, right: 0, top: 194, height: 1, backgroundColor: LINE_SOFT }} />
        <View style={{ position: 'absolute', left: '50%', top: 0, height: 102, width: 1, backgroundColor: LINE_SOFT }} />
        <View style={{ position: 'absolute', left: '50%', top: 194, bottom: 0, width: 1, backgroundColor: LINE_SOFT }} />
        <View style={{ position: 'absolute', top: 137, left: 0, right: 0, alignItems: 'center' }}>
          <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: colors.bg }}>
            <T size={11} w={700} ls={0.1} color={colors.muted}>
              NET
            </T>
          </View>
        </View>
        {sideBox(0)}
        {sideBox(1)}
      </View>

      <View style={{ gap: 8 }}>
        <Label>Serving first for {sideName(firstServer)}</Label>
        <Row gap={8}>
          {serving.map((p) => {
            const on = p.key === serverKey;
            return (
              <Button
                key={p.key}
                label={nameOf(p)}
                variant={on ? 'primary' : 'outline'}
                height={50}
                radius={14}
                size={15}
                weight={on ? 700 : 600}
                style={{ flex: 1 }}
                onPress={() => serveFirst(firstServer, p.key)}
              />
            );
          })}
        </Row>
        <T size={13} color={colors.muted}>
          {courtNote}
        </T>
      </View>

      <CoinToss visible={tossing} sides={[sideName(0), sideName(1)]} onResult={pickSide} onClose={() => setTossing(false)} />
    </Screen>
  );
}
