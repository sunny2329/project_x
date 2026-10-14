/** Mirrors backend/src/modules/chat/chat.types.ts. */
export interface ChatUser {
  id: string;
  username: string;
  fullName: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  sender: ChatUser;
  /** Null once deleted. */
  content: string | null;
  createdAt: string;
  deleted: boolean;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  /** Group name; null for direct conversations. */
  title: string | null;
  /** Current members, me included. */
  members: ChatUser[];
  isAdmin: boolean;
  lastMessage: ChatMessage | null;
  unreadCount: number;
  updatedAt: string;
}
