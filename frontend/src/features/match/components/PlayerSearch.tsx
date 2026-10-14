import Feather from '@expo/vector-icons/Feather';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '@/shared/api/client';
import { Avatar, TextField } from '@/shared/components';
import { spacing, typography, useTheme } from '@/shared/theme';
import { matchApi } from '../api/match.api';
import type { PlayerSummary } from '../types';

const MIN_QUERY = 2;
const DEBOUNCE_MS = 300;

interface PlayerSearchProps {
  /** Players already in the match; shown as added instead of pickable. */
  excludeIds: string[];
  onPick: (player: PlayerSummary) => void;
  /** Shown when nothing matches. */
  emptyText?: string;
}

/** Search players by username or name (debounced) and pick one. */
export function PlayerSearch({
  excludeIds,
  onPick,
  emptyText = 'No players found. They need a ProjectX account to join a match.',
}: PlayerSearchProps) {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlayerSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = query.trim();
  const searched = trimmed.length >= MIN_QUERY;

  useEffect(() => {
    if (trimmed.length < MIN_QUERY) return undefined;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { players } = await matchApi.searchPlayers(trimmed);
        if (!cancelled) {
          setResults(players);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof ApiError ? e.message : 'Search failed.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed]);

  const shown = searched ? results : [];

  return (
    <View style={styles.container}>
      <TextField
        icon="search"
        placeholder="Search username or name"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
      />
      {searched && loading ? <ActivityIndicator color={colors.primary} style={styles.status} /> : null}
      {searched && error ? <Text style={[typography.caption, styles.status, { color: colors.error }]}>{error}</Text> : null}
      {searched && !loading && !error && shown.length === 0 ? (
        <Text style={[typography.caption, styles.status, { color: colors.textMuted }]}>{emptyText}</Text>
      ) : null}
      {shown.map((player) => {
        const added = excludeIds.includes(player.id);
        return (
          <Pressable
            key={player.id}
            onPress={() => onPick(player)}
            disabled={added}
            accessibilityRole="button"
            accessibilityLabel={added ? `${player.fullName} already added` : `Add ${player.fullName}`}
            style={({ pressed }) => [styles.row, { borderBottomColor: colors.divider, opacity: added ? 0.5 : pressed ? 0.7 : 1 }]}
          >
            <Avatar name={player.fullName} size={34} />
            <View style={styles.names}>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                {player.fullName}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>@{player.username}</Text>
            </View>
            <Feather name={added ? 'check' : 'plus-circle'} size={20} color={added ? colors.icon : colors.primary} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  status: { marginTop: spacing.sm, alignSelf: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  names: { flex: 1, gap: 1 },
  name: { fontSize: 15, fontWeight: '600' },
});
