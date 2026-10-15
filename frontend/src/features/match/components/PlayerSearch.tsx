import Feather from '@expo/vector-icons/Feather';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '@/shared/api/client';
import { Avatar, TextField } from '@/shared/components';
import { spacing, typography, useTheme } from '@/shared/theme';
import { matchApi } from '../api/match.api';
import { fromOption, newGuest, type LineupPlayer } from '../lineup';
import type { PlayerOption } from '../types';

const MIN_QUERY = 2;
const DEBOUNCE_MS = 300;

interface PlayerSearchProps {
  /** Lineup keys already in the match; shown as added instead of pickable. */
  excludeKeys: string[];
  onPick: (player: LineupPlayer) => void;
  /** Only registered players (e.g. starting a chat): no guests. */
  registeredOnly?: boolean;
  emptyText?: string;
}

/**
 * Search registered players (and my earlier guests) by username or name, or add someone as a
 * guest by name, with an optional phone so they can claim the match when they sign up.
 */
export function PlayerSearch({ excludeKeys, onPick, registeredOnly = false, emptyText = 'No players found. Add them as a guest instead.' }: PlayerSearchProps) {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [phone, setPhone] = useState('');
  const [results, setResults] = useState<PlayerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guestMode, setGuestMode] = useState(false);

  const trimmed = query.trim();
  const searched = trimmed.length >= MIN_QUERY;

  useEffect(() => {
    if (trimmed.length < MIN_QUERY || guestMode) return undefined;
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
  }, [trimmed, guestMode]);

  const shown = searched ? results.filter((o) => !registeredOnly || !o.isGuest) : [];
  const phoneValid = !phone.trim() || /^\+[1-9][0-9]{7,14}$/.test(phone.trim());

  if (guestMode) {
    return (
      <View style={styles.container}>
        <TextField icon="user" placeholder="Guest's name" value={query} onChangeText={setQuery} autoFocus maxLength={80} />
        <TextField icon="phone" placeholder="Phone, e.g. +919876543210 (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoCorrect={false} />
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          {phoneValid ? 'With a phone number, this match moves to their profile when they join ProjectX.' : 'Use international format: +91…'}
        </Text>
        <View style={styles.actions}>
          <Pressable onPress={() => setGuestMode(false)} accessibilityRole="button" hitSlop={8}>
            <Text style={[typography.link, { color: colors.textMuted }]}>Back to search</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              onPick(newGuest(trimmed, phone.trim() || null));
              setQuery('');
              setPhone('');
              setGuestMode(false);
            }}
            disabled={!trimmed || !phoneValid}
            accessibilityRole="button"
            hitSlop={8}
          >
            <Text style={[typography.link, { color: trimmed && phoneValid ? colors.link : colors.textMuted }]}>Add guest</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TextField icon="search" placeholder="Search username or name" value={query} onChangeText={setQuery} autoCapitalize="none" autoCorrect={false} autoFocus />
      {searched && loading ? <ActivityIndicator color={colors.primary} style={styles.status} /> : null}
      {searched && error ? <Text style={[typography.caption, styles.status, { color: colors.error }]}>{error}</Text> : null}
      {searched && !loading && !error && !shown.length ? (
        <Text style={[typography.caption, styles.status, { color: colors.textMuted }]}>{emptyText}</Text>
      ) : null}
      {shown.map((option) => {
        const player = fromOption(option);
        const added = excludeKeys.includes(player.key);
        return (
          <Pressable
            key={player.key}
            onPress={() => onPick(player)}
            disabled={added}
            accessibilityRole="button"
            accessibilityLabel={added ? `${option.displayName} already added` : `Add ${option.displayName}`}
            style={({ pressed }) => [styles.row, { borderBottomColor: colors.divider, opacity: added ? 0.5 : pressed ? 0.7 : 1 }]}
          >
            <Avatar name={option.displayName} size={34} />
            <View style={styles.names}>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                {option.displayName}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>{option.isGuest ? 'Guest' : `@${option.username}`}</Text>
            </View>
            <Feather name={added ? 'check' : 'plus-circle'} size={20} color={added ? colors.icon : colors.primary} />
          </Pressable>
        );
      })}
      {registeredOnly ? null : (
        <Pressable onPress={() => setGuestMode(true)} accessibilityRole="button" style={styles.guestLink} hitSlop={8}>
          <Feather name="user-plus" size={16} color={colors.link} />
          <Text style={[typography.link, { color: colors.link }]}>{trimmed ? `Add “${trimmed}” as a guest` : 'Add a guest (no account needed)'}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  status: { marginTop: spacing.sm, alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm + 2, borderBottomWidth: StyleSheet.hairlineWidth },
  names: { flex: 1, gap: 1 },
  name: { fontSize: 15, fontWeight: '600' },
  guestLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  actions: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
});
