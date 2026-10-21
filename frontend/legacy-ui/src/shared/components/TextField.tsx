import Feather from '@expo/vector-icons/Feather';
import { forwardRef, useState, type ComponentProps } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { radius, sizes, spacing, typography, useTheme } from '@/shared/theme';

interface TextFieldProps extends TextInputProps {
  /** Leading icon; auth screens leave it out for Strava's plain outlined fields. */
  icon?: ComponentProps<typeof Feather>['name'];
  error?: string | undefined;
}

/** Outlined input with an optional leading icon; the placeholder doubles as the label. */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField({ icon, error, style, onFocus, onBlur, ...props }, ref) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.error : focused ? colors.primary : colors.surfaceBorder;

  return (
    <View style={styles.wrapper}>
      <View style={[styles.field, props.multiline && styles.multilineField, { backgroundColor: colors.surface, borderColor }]}>
        {icon ? <Feather name={icon} size={16} color={colors.icon} style={[styles.icon, props.multiline && styles.multilineIcon]} /> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.placeholder}
          selectionColor={colors.primary}
          cursorColor={colors.primary}
          style={[styles.input, props.multiline && styles.multilineInput, { color: colors.text }, style]}
          textAlignVertical={props.multiline ? 'top' : 'center'}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          accessibilityLabel={props.placeholder}
          {...props}
        />
      </View>
      {error ? (
        <Text style={[styles.error, { color: colors.error }]} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs + 2 },
  field: {
    height: sizes.field,
    borderRadius: radius.field,
    borderWidth: StyleSheet.hairlineWidth * 2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  multilineField: { height: undefined, minHeight: 104, alignItems: 'flex-start', paddingVertical: spacing.md + 2 },
  icon: { marginRight: spacing.md + 2 },
  multilineIcon: { marginTop: 2 },
  input: { flex: 1, height: '100%', padding: 0, ...typography.field },
  multilineInput: { height: undefined, minHeight: 76 },
  error: { ...typography.caption, marginLeft: spacing.xs },
});
