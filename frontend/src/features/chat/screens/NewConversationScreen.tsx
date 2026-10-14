import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PlayerSearch } from '@/features/match/components/PlayerSearch';
import type { PlayerSummary } from '@/features/match/types';
import { FormMessage, PrimaryButton, Screen, TextField, TopBar } from '@/shared/components';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { radius, spacing, typography, useTheme } from '@/shared/theme';
import { chatApi } from '../api/chat.api';

/** Pick one player for a direct conversation, or several (plus a name) for a group. */
export default function NewConversationScreen() {
  const { colors } = useTheme();
  const [picked, setPicked] = useState<PlayerSummary[]>([]);
  const [groupName, setGroupName] = useState('');
  const { submitting, formError, serverFieldErrors, submit } = useSubmit();
  const group = picked.length > 1;

  async function start() {
    let conversationId: string | null = null;
    const ok = await submit(async () => {
      const { conversation } = await chatApi.create(
        picked.map((p) => p.id),
        group ? groupName.trim() : undefined,
      );
      conversationId = conversation.id;
    });
    if (ok && conversationId) router.replace({ pathname: '/messages/[id]', params: { id: conversationId } });
  }

  const problem = !picked.length ? 'Pick at least one player' : group && !groupName.trim() ? 'Name the group' : null;

  return (
    <Screen header={<TopBar title="New message" back="/messages" />}>
      <View style={styles.content}>
        {picked.length ? (
          <View style={styles.chips}>
            {picked.map((player) => (
              <Pressable
                key={player.id}
                onPress={() => setPicked((prev) => prev.filter((p) => p.id !== player.id))}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${player.fullName}`}
                style={[styles.chip, { backgroundColor: colors.primarySoft }]}
              >
                <Text style={[styles.chipText, { color: colors.primary }]}>{player.fullName}</Text>
                <Feather name="x" size={14} color={colors.primary} />
              </Pressable>
            ))}
          </View>
        ) : null}

        {group ? (
          <TextField
            icon="users"
            placeholder="Group name"
            value={groupName}
            onChangeText={setGroupName}
            maxLength={100}
            error={serverFieldErrors.title}
          />
        ) : null}

        <PlayerSearch
          excludeIds={picked.map((p) => p.id)}
          onPick={(player) => setPicked((prev) => [...prev, player])}
          emptyText="No players found."
        />

        <FormMessage message={formError ?? serverFieldErrors.userIds ?? null} />
        {problem && picked.length ? <Text style={[typography.caption, styles.problem, { color: colors.textMuted }]}>{problem}</Text> : null}
        <PrimaryButton
          title={group ? 'Create group' : 'Start chat'}
          onPress={() => void start()}
          loading={submitting}
          disabled={Boolean(problem)}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  chipText: { fontSize: 13, fontWeight: '700' },
  problem: { textAlign: 'center' },
});
