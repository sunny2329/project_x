/*
 * Design v2 friendly-match setup pieces: step header with progress and rule row.
 */
import { Pressable, View } from 'react-native';
import { useTheme } from '@/shared/theme';
import { goBack, IconButton, T } from '@/shared/ui';

/** "‹  Friendly match · Step 1 of 2" and two progress bars. */
export function StepHeader({ step, of = 2, kicker = 'Friendly match', fallback = '/' }: { step: number; of?: number; kicker?: string; fallback?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <IconButton icon="back" label="Back" tone="plain" onPress={() => goBack(fallback)} />
        <T size={13} color={colors.muted}>
          {kicker} · Step {step} of {of}
        </T>
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }} accessibilityRole="progressbar" accessibilityLabel={`Step ${step} of ${of}`}>
        {Array.from({ length: of }, (_, i) => (
          <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < step ? colors.primary : colors.line }} />
        ))}
      </View>
    </View>
  );
}

/** A radio row: title, detail, ring on the right (thick border when picked). */
export function OptionRow({ title, detail, selected, onPress }: { title: string; detail?: string; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={detail ? `${title}, ${detail}` : title}
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: pressed ? 0.85 : 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        minHeight: 52,
        paddingVertical: 8,
        paddingHorizontal: selected ? 13 : 14,
        borderRadius: 14,
        backgroundColor: colors.card,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? colors.primary : colors.line,
      })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <T size={15} w={700}>
          {title}
        </T>
        {detail ? (
          <T size={12} color={colors.muted}>
            {detail}
          </T>
        ) : null}
      </View>
      <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: selected ? 6 : 2, borderColor: selected ? colors.primary : colors.muted }} />
    </Pressable>
  );
}
