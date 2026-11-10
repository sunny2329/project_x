import { View } from 'react-native';
import { useTheme } from '@/shared/theme';
import { Button, GroupRow, Row, Sheet, Stepper, T } from '@/shared/ui';
import { editableRules, ruleMax, ruleValue } from '../rules';
import type { RulesetOption } from '../types';

/**
 * "Change a rule": a stepper per number the scoring model lets you change, starting from the
 * ruleset. Used by a friendly's setup and by an organizer adding an event.
 */
export function RulesSheet({
  visible,
  onClose,
  ruleset,
  override,
  onChange,
  onReset,
  note,
}: {
  visible: boolean;
  onClose: () => void;
  ruleset: Pick<RulesetOption, 'name' | 'scoringModel' | 'config'> | null;
  override: Record<string, number>;
  onChange: (key: string, value: number) => void;
  onReset: () => void;
  note: string;
}) {
  const { colors } = useTheme();
  const config = { ...(ruleset?.config ?? {}), ...override } as Record<string, unknown>;
  const editable = ruleset ? editableRules(ruleset.scoringModel, config) : [];
  return (
    <Sheet visible={visible} onClose={onClose} scroll={editable.length > 5}>
      <T size={18} w={700}>
        Change a rule
      </T>
      <T size={13} color={colors.muted}>
        Starts from {ruleset?.name}. {note}
      </T>
      <View style={{ borderRadius: 16, backgroundColor: colors.bg, overflow: 'hidden' }}>
        {editable.map((e, i) => {
          const value = ruleValue(e, config);
          const max = ruleMax(ruleset!.scoringModel, e, config);
          return (
            <GroupRow key={e.key} minHeight={56} last={i === editable.length - 1} style={{ backgroundColor: colors.bg }}>
              <T size={15} flex>
                {e.label}
              </T>
              <Stepper
                value={value}
                min={e.min}
                max={max}
                label={e.label.toLowerCase()}
                onChange={(v) => {
                  // Best of stays odd: step by two.
                  const next = e.odd ? (v > value ? Math.min(max, value + 2) : Math.max(e.min, value - 2)) : v;
                  onChange(e.key, next);
                }}
              />
            </GroupRow>
          );
        })}
      </View>
      <Row gap={10}>
        <Button label="Reset" variant="raised" height={50} style={{ flex: 1 }} onPress={onReset} />
        <Button label="Done" height={50} style={{ flex: 1 }} onPress={onClose} />
      </Row>
    </Sheet>
  );
}
