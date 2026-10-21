/** Mirrors backend/src/modules/chat/chat.types.ts. */
export interface ChatUser {
  id: string;
  username: string;
  fullName: string;
  photoUrl: string | null;
}

/** A shared match, drawn as a small result card. */
export interface ChatMatch {
  id: string;
  sport: { slug: string; name: string; accentColor: string };
  format: string;
  status: string;
  winnerSideIndex: number | null;
  sides: { index: number; name: string }[];
  segments: number[][];
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  sender: ChatUser;
  /** Null once deleted. */
  content: string | null;
  createdAt: string;
  deleted: boolean;
  match: ChatMatch | null;
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
  /** When the others last read it ("Seen 8:16"). */
  othersReadAt: string | null;
  updatedAt: string;
}
