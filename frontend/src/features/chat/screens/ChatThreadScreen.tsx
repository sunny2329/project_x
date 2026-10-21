import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { usersApi } from '@/features/profile/api/profile.api';
import { useResource } from '@/shared/hooks/useResource';
import { bodyFont, useTheme } from '@/shared/theme';
import { Avatar, D, Dot, IconButton, Loading, Notice, Row, T, Tap } from '@/shared/ui';
import { clock, dayLabel, firstName } from '@/shared/utils/format';
import { useChat } from '../hooks/useChat';
import { conversationTitle, otherMembers } from '../format';
import type { ChatMessage } from '../types';
import { ConversationAvatar } from './ChatListScreen';

type Row_ = { kind: 'day'; key: string; label: string } | { kind: 'msg'; key: string; message: ChatMessage; seen: string | null };

function MatchBubble({ message, mine }: { message: ChatMessage; mine: boolean }) {
  const { colors } = useTheme();
  const m = message.match!;
  return (
    <Tap
      label="Match result"
      onPress={() => router.push({ pathname: '/match/[id]/result', params: { id: m.id } })}
      style={{
        alignSelf: mine ? 'flex-end' : 'flex-start',
        width: 250,
        padding: 12,
        borderRadius: 16,
        borderBottomRightRadius: mine ? 4 : 16,
        borderBottomLeftRadius: mine ? 16 : 4,
        backgroundColor: colors.raised,
        borderWidth: 1,
        borderColor: colors.line2,
        gap: 6,
      }}
    >
      <Row gap={6}>
        <Dot color={m.sport.accentColor} />
        <T size={12} color={colors.muted}>
          {m.sport.name} · {m.format}
        </T>
      </Row>
      {m.sides.map((side) => {
        const won = m.winnerSideIndex === side.index;
        return (
          <Row key={side.index} between>
            <T w={won ? 700 : 400} color={won ? colors.fg : colors.muted} flex numberOfLines={1}>
              {side.name}
            </T>
            <D size={18} color={won ? colors.fg : colors.muted}>
              {m.segments.map((s) => s[side.index] ?? 0).join(' ')}
            </D>
          </Row>
        );
      })}
    </Tap>
  );
}

/** One conversation: day separators, match cards, "Seen 8:16", and the composer. */
export default function ChatThreadScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useAuthStore((s) => s.user);
  const chat = useChat(id);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const conversation = chat.conversation;
  const others = conversation ? otherMembers(conversation, me?.id) : [];
  const direct = conversation?.type === 'direct' ? others[0] : undefined;
  const person = useResource(() => usersApi.get(direct!.id), [direct?.id], { enabled: !!direct });

  const rows = useMemo<Row_[]>(() => {
    const out: Row_[] = [];
    let lastDay = '';
    const lastMine = [...chat.messages].reverse().find((m) => m.sender.id === me?.id);
    const readAt = conversation?.othersReadAt ? Date.parse(conversation.othersReadAt) : 0;
    for (const message of chat.messages) {
      const day = dayLabel(message.createdAt);
      if (day !== lastDay) {
        out.push({ kind: 'day', key: `day-${message.id}`, label: day });
        lastDay = day;
      }
      const seen = message.id === lastMine?.id && readAt >= Date.parse(message.createdAt) ? `Seen ${clock(conversation!.othersReadAt!)}` : null;
      out.push({ kind: 'msg', key: message.id, message, seen });
    }
    return out.reverse();
  }, [chat.messages, conversation, me?.id]);

  if (!conversation && !chat.error) return <Loading />;

  const send = async () => {
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      await chat.send(content);
      setDraft('');
      setSendError(null);
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Could not send.');
    } finally {
      setSending(false);
    }
  };

  const ratings = person.data?.user.sports
    .slice(0, 2)
    .map((s) => `${s.name} ${Math.round(s.rating)}`)
    .join(' · ');
  const subtitle = direct ? ratings || `@${direct.username}` : others.map((o) => firstName(o.fullName)).join(', ');

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Row gap={10} style={{ paddingTop: insets.top + 10, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.raised }}>
        <IconButton icon="back" label="Back" tone="plain" onPress={() => router.back()} />
        <Tap
          label={conversation ? conversationTitle(conversation, me?.id) : 'Chat'}
          onPress={direct ? () => router.push({ pathname: '/user/[id]', params: { id: direct.id } }) : undefined}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}
        >
          {direct ? <Avatar name={direct.fullName} id={direct.id} photoUrl={direct.photoUrl} size={40} /> : conversation ? <ConversationAvatar conversation={conversation} myId={me?.id} /> : null}
          <View style={{ flex: 1 }}>
            <T size={15} w={700} numberOfLines={1}>
              {conversation ? conversationTitle(conversation, me?.id) : ''}
            </T>
            <T size={12} color={colors.muted} numberOfLines={1}>
              {subtitle}
            </T>
          </View>
        </Tap>
        <IconButton
          icon="plus"
          label={direct ? `Start a match with ${firstName(direct.fullName)}` : 'Start a match'}
          onPress={() => router.push({ pathname: '/match/new', params: direct ? { with: direct.id, withName: direct.fullName } : {} })}
        />
      </Row>

      {chat.error ? (
        <View style={{ padding: 16 }}>
          <Notice tone="error" icon="alert" text={chat.error} />
        </View>
      ) : null}

      <FlatList
        inverted
        data={rows}
        keyExtractor={(r) => r.key}
        onEndReached={() => void chat.loadOlder()}
        onEndReachedThreshold={0.3}
        contentContainerStyle={{ padding: 16, gap: 8, flexGrow: 1, justifyContent: 'flex-end' }}
        renderItem={({ item }) => {
          if (item.kind === 'day') {
            return (
              <T size={12} color={colors.muted} center style={{ paddingVertical: 4 }}>
                {item.label}
              </T>
            );
          }
          const m = item.message;
          const mine = m.sender.id === me?.id;
          const showName = conversation?.type === 'group' && !mine;
          return (
            <View style={{ gap: 4 }}>
              {m.match && !m.deleted ? <MatchBubble message={m} mine={mine} /> : null}
              {m.content || m.deleted ? (
                <Tap
                  label={m.deleted ? 'Message deleted' : m.content ?? ''}
                  onLongPress={
                    mine && !m.deleted
                      ? () =>
                          Alert.alert('Delete message?', 'It’s removed for everyone.', [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Delete', style: 'destructive', onPress: () => void chat.remove(m.id).catch(() => undefined) },
                          ])
                      : undefined
                  }
                  style={{
                    alignSelf: mine ? 'flex-end' : 'flex-start',
                    maxWidth: 260,
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    borderRadius: 16,
                    borderBottomRightRadius: mine ? 4 : 16,
                    borderBottomLeftRadius: mine ? 16 : 4,
                    backgroundColor: m.deleted ? 'transparent' : mine ? colors.primary : colors.surface,
                    borderWidth: m.deleted ? 1 : 0,
                    borderColor: colors.line,
                  }}
                >
                  {showName ? (
                    <T size={12} w={700} color={colors.accentText}>
                      {firstName(m.sender.fullName)}
                    </T>
                  ) : null}
                  <T size={15} lh={21} italic={m.deleted} color={m.deleted ? colors.muted : mine ? colors.onPrimary : colors.fg}>
                    {m.deleted ? 'Message deleted' : m.content}
                  </T>
                </Tap>
              ) : null}
              {item.seen ? (
                <T size={11} color={colors.muted} right>
                  {item.seen}
                </T>
              ) : null}
            </View>
          );
        }}
      />

      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 12) + 14, borderTopWidth: 1, borderTopColor: colors.raised, backgroundColor: colors.bar, gap: 8 }}>
        {sendError ? <Notice tone="error" icon="alert" text={sendError} /> : null}
        <Row gap={10}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Message"
            placeholderTextColor={colors.faint}
            accessibilityLabel="Message"
            multiline
            maxLength={2000}
            style={{ flex: 1, minHeight: 46, maxHeight: 120, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 23, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, color: colors.fg, fontFamily: bodyFont(400), fontSize: 15 }}
          />
          <IconButton icon="send" label="Send" tone="primary" size={46} radius={23} onPress={() => void send()} disabled={sending || !draft.trim()} />
        </Row>
      </View>
    </KeyboardAvoidingView>
  );
}
