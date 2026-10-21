import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useResource } from '@/shared/hooks/useResource';
import { bodyFont, LIVE, useTheme } from '@/shared/theme';
import { Avatar, D, EmptyState, Icon, IconButton, Loading, Notice, Row, Screen, T, Tap } from '@/shared/ui';
import { chatTime, firstName } from '@/shared/utils/format';
import { chatApi } from '../api/chat.api';
import { conversationTitle, otherMembers } from '../format';
import type { Conversation } from '../types';

/** Two overlapping avatars for a group, one for a direct chat. */
export function ConversationAvatar({ conversation, myId }: { conversation: Conversation; myId?: string }) {
  const { colors } = useTheme();
  const others = otherMembers(conversation, myId);
  if (conversation.type === 'direct' || others.length < 2) {
    const u = others[0];
    return <Avatar name={u?.fullName ?? conversationTitle(conversation, myId)} id={u?.id} photoUrl={u?.photoUrl} size={52} />;
  }
  return (
    <View style={{ width: 52, height: 52 }}>
      <View style={{ position: 'absolute', left: 0, top: 0 }}>
        <Avatar name={others[0]!.fullName} id={others[0]!.id} photoUrl={others[0]!.photoUrl} size={36} />
      </View>
      <View style={{ position: 'absolute', right: -2, bottom: -2 }}>
        <Avatar name={others[1]!.fullName} id={others[1]!.id} photoUrl={others[1]!.photoUrl} size={40} border={colors.bg} />
      </View>
    </View>
  );
}

function preview(c: Conversation, myId?: string): string {
  const m = c.lastMessage;
  if (!m) return 'No messages yet';
  const who = m.sender.id === myId ? 'You: ' : c.type === 'group' ? `${firstName(m.sender.fullName)}: ` : '';
  if (m.deleted) return `${who}Message deleted`;
  if (m.match && !m.content) return `${who}Sent a match result`;
  return `${who}${m.content ?? ''}`;
}

/** Chats tab: every conversation, newest first, unread counts in red. */
export default function ChatListScreen() {
  const { colors } = useTheme();
  const me = useAuthStore((s) => s.user);
  const { data, error, loading, refreshing, refresh } = useResource(() => chatApi.list(), [], { poll: 10_000 });
  const [q, setQ] = useState('');

  const list = useMemo(() => {
    const all = data?.conversations ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((c) => conversationTitle(c, me?.id).toLowerCase().includes(needle) || c.members.some((m) => m.username.toLowerCase().includes(needle)));
  }, [data, q, me?.id]);

  if (loading) return <Loading />;

  return (
    <Screen gap={16} refreshing={refreshing} onRefresh={refresh}>
      <Row between>
        <D size={40} upper accessibilityRole="header">
          Chats
        </D>
        <IconButton icon="pen" label="New chat" tone="primary" onPress={() => router.push('/search')} />
      </Row>

      <Row gap={10} style={{ height: 46, borderRadius: 14, backgroundColor: colors.surface, paddingHorizontal: 14 }}>
        <Icon name="search" size={19} color={colors.muted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search chats"
          placeholderTextColor={colors.faint}
          accessibilityLabel="Search chats"
          style={{ flex: 1, color: colors.fg, fontFamily: bodyFont(400), fontSize: 15 }}
        />
      </Row>

      {error ? <Notice tone="error" icon="alert" text={error} /> : null}

      <View>
        {list.map((c) => {
          const unread = c.unreadCount > 0;
          const title = conversationTitle(c, me?.id);
          return (
            <Tap key={c.id} label={title} onPress={() => router.push({ pathname: '/chat/[id]', params: { id: c.id } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
              <ConversationAvatar conversation={c} myId={me?.id} />
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <Row between gap={8}>
                  <T size={15} w={700} flex numberOfLines={1}>
                    {c.type === 'group' ? `${title} · ${c.members.length}` : title}
                  </T>
                  <T size={12} w={unread ? 700 : 400} color={unread ? colors.fg : colors.muted}>
                    {chatTime(c.lastMessage?.createdAt ?? c.updatedAt)}
                  </T>
                </Row>
                <Row between gap={8}>
                  <T size={14} color={unread ? colors.soft : colors.muted} flex numberOfLines={1}>
                    {preview(c, me?.id)}
                  </T>
                  {unread ? (
                    <View style={{ minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, backgroundColor: LIVE, alignItems: 'center', justifyContent: 'center' }}>
                      <T size={12} w={800} color={colors.ink}>
                        {c.unreadCount > 99 ? '99+' : c.unreadCount}
                      </T>
                    </View>
                  ) : null}
                </Row>
              </View>
            </Tap>
          );
        })}
        {!list.length ? <EmptyState title={q ? 'No chats match' : 'No chats yet'} body={q ? undefined : 'Find a player and tap Message to start one.'} /> : null}
      </View>
    </Screen>
  );
}
