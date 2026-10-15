import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar, Card, TextLink } from '@/shared/components';
import { spacing, typography, useTheme } from '@/shared/theme';
import type { LineupPlayer } from '../lineup';
import { PlayerSearch } from './PlayerSearch';

interface SideEditorProps {
  title: string;
  players: LineupPlayer[];
  maxPlayers: number;
  /** This player can't be removed (the scorer). */
  lockedKey?: string | undefined;
  searching: boolean;
  excludeKeys: string[];
  onToggleSearch: () => void;
  onAdd: (player: LineupPlayer) => void;
  onRemove: (key: string) => void;
}

/** One side of a new match (or a tournament entry): its players, with search and guests. */
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
      {players.map((player) => (
        <View key={player.key} style={styles.player}>
          <Avatar name={player.displayName} size={32} />
          <Text style={[styles.playerName, { color: colors.text }]} numberOfLines={1}>
            {player.displayName}
            {player.key === props.lockedKey ? <Text style={{ color: colors.textMuted }}> (you)</Text> : null}
            {player.isGuest ? <Text style={{ color: colors.textMuted }}> · guest</Text> : null}
          </Text>
          {player.key !== props.lockedKey ? (
            <Pressable onPress={() => props.onRemove(player.key)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Remove ${player.displayName}`}>
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
      {props.searching && !full ? <PlayerSearch excludeKeys={props.excludeKeys} onPick={props.onAdd} /> : null}
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
