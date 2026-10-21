import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps, ReactNode } from 'react';
import { Children, Fragment } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, spacing, typography, useTheme } from '@/shared/theme';

interface ListGroupProps {
  title?: string;
  children: ReactNode;
}

/** Settings-style group: small caps title above a bordered card of rows with hairline separators. */
export function ListGroup({ title, children }: ListGroupProps) {
  const { colors } = useTheme();
  const rows = Children.toArray(children);
  return (
    <View style={styles.group}>
      {title ? <Text style={[typography.overline, styles.title, { color: colors.textMuted }]}>{title}</Text> : null}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
        {rows.map((row, index) => (
          <Fragment key={index}>
            {index > 0 ? <View style={[styles.separator, { backgroundColor: colors.divider }]} /> : null}
            {row}
          </Fragment>
        ))}
      </View>
    </View>
  );
}

interface ListRowProps {
  icon: ComponentProps<typeof Feather>['name'];
  label: string;
  /** Secondary text on the right (or under the label when long). */
  value?: string;
  onPress?: () => void;
}

export function ListRow({ icon, label, value, onPress }: ListRowProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.secondaryButtonPressed }]}
    >
      <Feather name={icon} size={18} color={colors.icon} />
      <Text style={[styles.label, !value && styles.grow, { color: colors.text }]} numberOfLines={1}>
        {label}
      </Text>
      {value ? (
        <Text style={[typography.body, styles.value, { color: colors.textMuted }]} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {onPress ? <Feather name="chevron-right" size={18} color={colors.icon} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  title: { marginLeft: spacing.xs },
  card: { borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth * 2, overflow: 'hidden' },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: spacing.lg + 18 + spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, minHeight: 50 },
  label: { fontSize: 15, fontWeight: '700' },
  grow: { flex: 1 },
  value: { flex: 1, textAlign: 'right' },
});
