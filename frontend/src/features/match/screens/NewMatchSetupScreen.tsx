import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { sportText, useTheme } from '@/shared/theme';
import { Avatar, Button, D, Dot, EmptyState, goBack, Header, Icon, IconButton, Label, RadioCard, Row, Screen, Segmented, T } from '@/shared/ui';
import { AddPlayerSheet } from '../components/AddPlayerSheet';
import { lineupKeys, lineupProblem } from '../lineup';
import { rulesetDetail } from '../rules';
import { useMatchDraft } from '../store/draft.store';

/**
 * Rules, singles or doubles, and players on each side. `mode=result` is the same screen opened
 * from "Enter a result" (Change): it returns there instead of going on to the serve.
 */
export default function NewMatchSetupScreen() {
  const { colors } = useTheme();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const me = useAuthStore((s) => s.user);
  const { sport, formatCode, rulesetId, lineup, setFormat, setRuleset, add, remove } = useMatchDraft();
  const [adding, setAdding] = useState<number | null>(null);

  if (!sport) {
    return (
      <Screen>
        <Header />
        <EmptyState title="Pick a sport first" action={<Button label="Choose a sport" inline onPress={() => router.replace('/match/new')} />} />
      </Screen>
    );
  }

  const format = sport.formats.find((f) => f.code === formatCode) ?? sport.formats[0]!;
  const color = sport.accentColor;
  const problem = lineupProblem(lineup, format);
  const forResult = mode === 'result';

  return (
    <Screen
      gap={18}
      footer={
        <View style={{ gap: 10 }}>
          {problem ? (
            <T size={13} color={colors.muted} center>
              {problem}
            </T>
          ) : null}
          <Button
            label={forResult ? 'Done' : 'Next: who serves first'}
            weight={700}
            disabled={!!problem}
            onPress={() => (forResult ? router.back() : router.push('/match/serve'))}
          />
        </View>
      }
    >
      <Row gap={12}>
        <IconButton icon="back" label="Back" onPress={() => goBack('/match/new')} />
        <Dot color={color} size={10} />
        <D size={28} upper flex numberOfLines={1}>
          {sport.name}
        </D>
      </Row>

      {sport.formats.length > 1 ? (
        <Segmented
          options={sport.formats.map((f) => ({ value: f.code, label: f.name }))}
          value={format.code}
          onChange={setFormat}
          activeColor={color}
          height={42}
        />
      ) : null}

      <View style={{ gap: 8 }}>
        <Label>Rules</Label>
        {sport.rulesets.map((r) => (
          <RadioCard key={r.id} title={r.name} subtitle={rulesetDetail(r)} selected={r.id === rulesetId} color={color} onPress={() => setRuleset(r.id)} />
        ))}
      </View>

      <View style={{ gap: 8 }}>
        <Label>Players</Label>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {[0, 1].map((side) => (
            <View key={side} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {side === 1 ? (
                <D size={18} color={colors.muted} style={{ width: 28, textAlign: 'center' }}>
                  VS
                </D>
              ) : null}
              <View style={{ flex: 1, gap: 6, padding: 10, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, minHeight: 104 }}>
                <T size={11} w={700} ls={0.06} color={side === 0 ? sportText(colors, sport.slug) : colors.muted}>
                  SIDE {side === 0 ? 'A' : 'B'}
                </T>
                {lineup[side]!.map((p) => (
                  <Pressable
                    key={p.key}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${p.displayName}`}
                    onPress={() => remove(p.key)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28 }}
                  >
                    <Avatar name={p.displayName} id={p.userId ?? p.key} size={28} />
                    <T size={14} w={600} flex numberOfLines={1}>
                      {p.userId && p.userId === me?.id ? 'You' : p.displayName}
                    </T>
                    <Icon name="close" size={14} color={colors.faint} />
                  </Pressable>
                ))}
                {lineup[side]!.length < format.maxPerSide ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Add player to side ${side === 0 ? 'A' : 'B'}`}
                    onPress={() => setAdding(side)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 28 }}
                  >
                    <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.faint, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="plus" size={14} color={colors.fg} />
                    </View>
                    <T size={14} w={700}>
                      Add player
                    </T>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      </View>

      <AddPlayerSheet
        visible={adding !== null}
        side={adding ?? 1}
        sport={sport.slug}
        sportName={sport.name}
        taken={lineupKeys(lineup)}
        onAdd={(p) => add(adding ?? 1, p)}
        onClose={() => setAdding(null)}
      />
    </Screen>
  );
}
