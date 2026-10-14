import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ApiError } from '@/shared/api/client';
import { chatApi } from '../api/chat.api';
import type { ChatMessage, Conversation } from '../types';

/** How often an open conversation asks for new messages. Cheap: the server answers "nothing new" from Redis. */
const POLL_MS = 3_000;
const PAGE = 30;

/** An open conversation: newest page first, new messages by polling while focused, older pages on demand. */
export function useChat(conversationId: string) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasOlder, setHasOlder] = useState(false);
  const newest = useRef<string | null>(null);
  const loadingOlder = useRef(false);

  const merge = useCallback((incoming: ChatMessage[], position: 'append' | 'prepend') => {
    if (!incoming.length) return;
    setMessages((prev) => {
      const known = new Set(prev.map((m) => m.id));
      const fresh = incoming.filter((m) => !known.has(m.id));
      const next = position === 'append' ? [...prev, ...fresh] : [...fresh, ...prev];
      newest.current = next.at(-1)?.id ?? null;
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    try {
      const [{ conversation: loaded }, page] = await Promise.all([chatApi.get(conversationId), chatApi.messages(conversationId)]);
      setConversation(loaded);
      setMessages(page.messages);
      newest.current = page.messages.at(-1)?.id ?? null;
      setHasOlder(page.messages.length === PAGE);
      setError(null);
      void chatApi.markRead(conversationId).catch(() => undefined);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load this conversation.');
    }
  }, [conversationId]);

  const poll = useCallback(async () => {
    const after = newest.current;
    if (!after) return;
    try {
      const page = await chatApi.messages(conversationId, { after });
      if (page.messages.length) {
        merge(page.messages, 'append');
        void chatApi.markRead(conversationId).catch(() => undefined);
      }
    } catch {
      // Transient; the next poll tries again.
    }
  }, [conversationId, merge]);

  useFocusEffect(
    useCallback(() => {
      void load();
      const timer = setInterval(() => void poll(), POLL_MS);
      return () => clearInterval(timer);
    }, [load, poll]),
  );

  const loadOlder = useCallback(async () => {
    const oldest = messages[0]?.id;
    if (!oldest || !hasOlder || loadingOlder.current) return;
    loadingOlder.current = true;
    try {
      const page = await chatApi.messages(conversationId, { before: oldest });
      merge(page.messages, 'prepend');
      setHasOlder(page.messages.length === PAGE);
    } catch {
      // Try again on the next scroll.
    } finally {
      loadingOlder.current = false;
    }
  }, [conversationId, hasOlder, merge, messages]);

  const send = useCallback(
    async (content: string) => {
      const { message } = await chatApi.send(conversationId, content);
      merge([message], 'append');
    },
    [conversationId, merge],
  );

  const remove = useCallback(
    async (messageId: string) => {
      await chatApi.deleteMessage(conversationId, messageId);
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, content: null, deleted: true } : m)));
    },
    [conversationId],
  );

  return { conversation, messages, error, hasOlder, reload: load, loadOlder, send, remove };
}
