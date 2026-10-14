import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, spacing, useTheme } from '@/shared/theme';
import { sportIcon } from '../format';
import type { SportSetup } from '../types';

interface SportGridProps {
  sports: SportSetup[];
  selectedId: string | null;
  onSelect: (sportId: string) => void;
}

/** The six sports as a 3-column grid of icon tiles. */
export function SportGrid({ sports, selectedId, onSelect }: SportGridProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.grid}>
      {sports.map(({ sport }) => {
        const selected = sport.id === selectedId;
        return (
          <Pressable
            key={sport.id}
            onPress={() => onSelect(sport.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={sport.name}
            style={[
              styles.tile,
              {
                backgroundColor: selected ? colors.secondaryButton : colors.surface,
                borderColor: selected ? colors.primary : colors.surfaceBorder,
              },
            ]}
          >
            <MaterialCommunityIcons name={sportIcon(sport.code)} size={28} color={selected ? colors.primary : colors.icon} />
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {sport.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    flexBasis: '31%',
    flexGrow: 1,
    aspectRatio: 1.15,
    borderRadius: radius.field,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  name: { fontSize: 13, fontWeight: '700' },
});
