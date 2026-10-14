import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar, Card, TextField, TextLink } from '@/shared/components';
import { spacing, typography, useTheme } from '@/shared/theme';
import type { PlayerSummary } from '../types';
import { PlayerSearch } from './PlayerSearch';

interface SideEditorProps {
  title: string;
  players: PlayerSummary[];
  maxPlayers: number;
  /** Team sports get an editable team name. */
  teamName?: { value: string; placeholder: string; onChange: (name: string) => void } | undefined;
  /** This player can't be removed (the scorer). */
  lockedPlayerId?: string | undefined;
  searching: boolean;
  excludeIds: string[];
  onToggleSearch: () => void;
  onAdd: (player: PlayerSummary) => void;
  onRemove: (playerId: string) => void;
}

/** One side of a new match: optional team name, its players, and an inline player search. */
export function SideEditor(props: SideEditorProps) {
  const { colors } = useTheme();
  const { players, maxPlayers } = props;
  const full = players.length >= maxPlayers;

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>{props.title}</Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          {players.length}/{maxPlayers}
        </Text>
      </View>
      {props.teamName ? (
        <TextField
          icon="flag"
          placeholder={props.teamName.placeholder}
          value={props.teamName.value}
          onChangeText={props.teamName.onChange}
          maxLength={40}
        />
      ) : null}
      {players.map((player) => (
        <View key={player.id} style={styles.player}>
          <Avatar name={player.fullName} size={32} />
          <Text style={[styles.playerName, { color: colors.text }]} numberOfLines={1}>
            {player.fullName}
            {player.id === props.lockedPlayerId ? <Text style={{ color: colors.textMuted }}> (you)</Text> : null}
          </Text>
          {player.id !== props.lockedPlayerId ? (
            <Pressable
              onPress={() => props.onRemove(player.id)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${player.fullName}`}
            >
              <Feather name="x" size={18} color={colors.icon} />
            </Pressable>
          ) : null}
        </View>
      ))}
      {!full ? (
        <View style={styles.add}>
          <TextLink title={props.searching ? 'Done' : '+ Add player'} onPress={props.onToggleSearch} />
        </View>
      ) : null}
      {props.searching && !full ? <PlayerSearch excludeIds={props.excludeIds} onPick={props.onAdd} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 15, fontWeight: '700' },
  player: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  playerName: { flex: 1, fontSize: 15, fontWeight: '600' },
  add: { alignItems: 'flex-start' },
});
