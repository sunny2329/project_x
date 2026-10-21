import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { ApiError } from '@/shared/api/client';
import { Avatar, EmptyState, IconButton, Screen, TeamBadge, TopBar } from '@/shared/components';
import { radius, spacing, typography, useTheme } from '@/shared/theme';
import { formatRelativeTime } from '@/shared/utils/time';
import { chatApi } from '../api/chat.api';
import { conversationTitle } from '../format';
import type { Conversation } from '../types';

/** Refreshes the list (last messages, unread counts) while it is open. */
const REFRESH_MS = 10_000;

/** My conversations, most recent first, with unread counts. */
export default function ConversationsScreen() {
  const { colors } = useTheme();
  const me = useAuthStore((s) => s.user);
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { conversations: loaded } = await chatApi.list();
      setConversations(loaded);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load your messages.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
      const timer = setInterval(() => void load(), REFRESH_MS);
      return () => clearInterval(timer);
    }, [load]),
  );

  async function pullToRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const header = (
    <TopBar title="Messages" back="/" actions={<IconButton icon="edit" label="New message" onPress={() => router.push('/messages/new')} />} />
  );

  return (
    <Screen header={header} padded={false} onRefresh={() => void pullToRefresh()} refreshing={refreshing}>
      {conversations === null ? (
        error ? (
          <EmptyState tone="error" icon="alert-triangle" title="Something went wrong" message={error} action={{ label: 'Try again', onPress: () => void load() }} />
        ) : (
          <ActivityIndicator style={styles.loading} color={colors.primary} />
        )
      ) : conversations.length === 0 ? (
        <EmptyState
          icon="message-circle"
          title="No messages yet"
          message="Message a player you’ve met, or start a group for your team."
          action={{ label: 'New message', icon: 'edit', onPress: () => router.push('/messages/new') }}
        />
      ) : (
        conversations.map((conversation) => {
          const title = conversationTitle(conversation, me?.id);
          const last = conversation.lastMessage;
          const unread = conversation.unreadCount > 0;
          const preview = last
            ? `${last.sender.id === me?.id ? 'You: ' : conversation.type === 'group' ? `${last.sender.fullName.split(' ')[0]}: ` : ''}${
                last.deleted ? 'Message deleted' : last.content
              }`
            : conversation.type === 'group'
              ? 'Group created'
              : 'Say hi 👋';
          return (
            <Pressable
              key={conversation.id}
              onPress={() => router.push({ pathname: '/messages/[id]', params: { id: conversation.id } })}
              accessibilityRole="button"
              accessibilityLabel={`${title}${unread ? `, ${conversation.unreadCount} unread` : ''}`}
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: pressed ? colors.secondaryButtonPressed : colors.surface, borderBottomColor: colors.divider },
              ]}
            >
              {conversation.type === 'group' ? <TeamBadge name={title} size={52} /> : <Avatar name={title} size={52} />}
              <View style={styles.body}>
                <View style={styles.topLine}>
                  <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                    {title}
                  </Text>
                  <Text style={[typography.caption, { color: unread ? colors.primary : colors.textMuted }]}>
                    {formatRelativeTime(conversation.updatedAt)}
                  </Text>
                </View>
                <View style={styles.topLine}>
                  <Text
                    style={[typography.body, styles.preview, { color: unread ? colors.text : colors.textMuted }, unread && styles.bold]}
                    numberOfLines={1}
                  >
                    {preview}
                  </Text>
                  {unread ? (
                    <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                      <Text style={[styles.badgeText, { color: colors.onPrimary }]}>
                        {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </Pressable>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: spacing.xxl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  body: { flex: 1, gap: 3 },
  topLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1, fontSize: 16, fontWeight: '700' },
  preview: { flex: 1 },
  bold: { fontWeight: '700' },
  badge: { minWidth: 22, height: 22, borderRadius: radius.pill, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 12, fontWeight: '800' },
});
