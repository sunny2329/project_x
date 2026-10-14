import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { Avatar, Composer, EmptyState, FormMessage, IconButton, TeamBadge, TopBar } from '@/shared/components';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { radius, spacing, typography, useTheme } from '@/shared/theme';
import { chatApi } from '../api/chat.api';
import { conversationTitle, formatDay, formatTimeOfDay, otherMembers } from '../format';
import { useChat } from '../hooks/useChat';
import type { ChatMessage } from '../types';

const MESSAGE_MAX = 4000;

/** One conversation: messages newest at the bottom, a message box, new messages every few seconds. */
export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const me = useAuthStore((s) => s.user);
  const chat = useChat(id);
  const [draft, setDraft] = useState('');
  const sending = useSubmit();
  const { conversation } = chat;

  async function send() {
    const content = draft.trim();
    if (!content) return;
    const ok = await sending.submit(() => chat.send(content));
    if (ok) setDraft('');
  }

  function confirmDelete(message: ChatMessage) {
    if (message.sender.id !== me?.id || message.deleted) return;
    Alert.alert('Delete message?', 'It shows as “Message deleted” for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void chat.remove(message.id).catch(() => undefined) },
    ]);
  }

  function confirmLeave() {
    Alert.alert('Leave this group?', 'You won’t get its messages any more.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => void chatApi.leave(id).then(() => router.back()).catch(() => undefined) },
    ]);
  }

  const title = conversation ? conversationTitle(conversation, me?.id) : 'Messages';
  const others = conversation ? otherMembers(conversation, me?.id) : [];
  const subtitle = conversation
    ? conversation.type === 'group'
      ? `${conversation.members.length} members`
      : others[0]
        ? `@${others[0].username}`
        : ''
    : '';
  const header = (
    <TopBar
      back="/messages"
      titleContent={
        <View style={styles.titleRow}>
          {conversation?.type === 'group' ? <TeamBadge name={title} size={38} /> : <Avatar name={title} size={38} />}
          <View style={styles.titleText}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>
      }
      actions={conversation?.type === 'group' ? <IconButton icon="log-out" label="Leave group" onPress={confirmLeave} /> : undefined}
    />
  );

  // Inverted list: index 0 is the newest message, drawn at the bottom.
  const newestFirst = [...chat.messages].reverse();
  const isGroup = conversation?.type === 'group';

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      {header}
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {!conversation ? (
          chat.error ? (
            <EmptyState
              tone="error"
              icon="alert-triangle"
              title="Conversation unavailable"
              message={chat.error}
              action={{ label: 'Try again', onPress: () => void chat.reload() }}
            />
          ) : (
            <ActivityIndicator style={styles.loading} color={colors.primary} />
          )
        ) : (
          <FlatList
            inverted
            data={newestFirst}
            keyExtractor={(message) => message.id}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            onEndReached={() => void chat.loadOlder()}
            onEndReachedThreshold={0.3}
            ListEmptyComponent={
              <Text style={[typography.body, styles.empty, { color: colors.textMuted }]}>No messages yet. Say hi 👋</Text>
            }
            renderItem={({ item, index }) => {
              const older = newestFirst[index + 1];
              const newDay = !older || formatDay(older.createdAt) !== formatDay(item.createdAt);
              const mine = item.sender.id === me?.id;
              const showSender = isGroup && !mine && (newDay || older?.sender.id !== item.sender.id);
              return (
                <View>
                  {newDay ? (
                    <View style={[styles.day, { backgroundColor: colors.secondaryButton }]}>
                      <Text style={[styles.dayText, { color: colors.textMuted }]}>{formatDay(item.createdAt)}</Text>
                    </View>
                  ) : null}
                  <Bubble message={item} mine={mine} showSender={showSender} onLongPress={() => confirmDelete(item)} />
                </View>
              );
            }}
          />
        )}
        <FormMessage message={sending.formError ?? sending.serverFieldErrors.content ?? null} />
        {conversation ? (
          <Composer
            value={draft}
            onChangeText={setDraft}
            onSend={() => void send()}
            placeholder="Message…"
            sending={sending.submitting}
            maxLength={MESSAGE_MAX}
          />
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

function Bubble({ message, mine, showSender, onLongPress }: { message: ChatMessage; mine: boolean; showSender: boolean; onLongPress: () => void }) {
  const { colors } = useTheme();
  const fg = mine ? colors.onPrimary : colors.text;
  return (
    <View style={[styles.messageRow, mine && styles.mineRow]}>
      {!mine ? <View style={styles.avatarSlot}>{showSender ? <Avatar name={message.sender.fullName} size={30} /> : null}</View> : null}
      <View style={[styles.bubbleColumn, mine && styles.mineColumn]}>
        {showSender ? <Text style={[styles.sender, { color: colors.textMuted }]}>{message.sender.fullName.split(' ')[0]}</Text> : null}
        <Pressable
          onLongPress={onLongPress}
          delayLongPress={350}
          style={[
            styles.bubble,
            mine
              ? { backgroundColor: colors.primary, borderBottomRightRadius: 6 }
              : { backgroundColor: colors.surface, borderColor: colors.surfaceBorder, borderWidth: StyleSheet.hairlineWidth * 2, borderBottomLeftRadius: 6 },
          ]}
        >
          <Text style={[styles.messageText, { color: fg }, message.deleted && styles.deleted]}>
            {message.deleted ? 'Message deleted' : message.content}
            <Text style={[styles.time, { color: mine ? 'rgba(255,255,255,0.75)' : colors.textMuted }]}>  {formatTimeOfDay(message.createdAt)}</Text>
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { marginTop: spacing.xxl },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  titleText: { flex: 1 },
  title: { fontSize: 17, fontWeight: '700' },
  list: { paddingHorizontal: spacing.screen, paddingVertical: spacing.md, gap: spacing.sm, flexGrow: 1 },
  empty: { textAlign: 'center', marginTop: spacing.xxl, transform: [{ scaleY: -1 }] },
  day: { alignSelf: 'center', borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 4, marginVertical: spacing.md },
  dayText: { fontSize: 12, fontWeight: '700' },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  mineRow: { justifyContent: 'flex-end' },
  avatarSlot: { width: 30 },
  bubbleColumn: { maxWidth: '78%', gap: 3 },
  mineColumn: { alignItems: 'flex-end' },
  sender: { fontSize: 12, fontWeight: '700', marginLeft: spacing.xs },
  bubble: { borderRadius: 18, paddingHorizontal: spacing.md + 2, paddingVertical: spacing.sm + 2 },
  messageText: { fontSize: 15, lineHeight: 21 },
  deleted: { fontStyle: 'italic', opacity: 0.7 },
  time: { fontSize: 11 },
});
