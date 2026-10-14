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
  /** Group name; null for direct conversations (show the other member's name). */
  title: string | null;
  /** Current members, the viewer included. */
  members: ChatUser[];
  isAdmin: boolean;
  lastMessage: ChatMessage | null;
  unreadCount: number;
  /** Last message time, or creation time when empty. */
  updatedAt: string;
}
