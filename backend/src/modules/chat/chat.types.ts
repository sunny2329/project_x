export interface ChatUser {
  id: string;
  username: string;
  fullName: string;
  photoUrl: string | null;
}

/** A match shared in a message, drawn as a small result card. */
export interface ChatMatch {
  id: string;
  sport: { slug: string; name: string; accentColor: string };
  format: string;
  status: string;
  winnerSideIndex: number | null;
  sides: Array<{ index: number; name: string }>;
  /** Top-level game/set scores, [side0, side1] per segment. */
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
  /** Group name; null for direct conversations (show the other member's name). */
  title: string | null;
  /** Current members, the viewer included. */
  members: ChatUser[];
  isAdmin: boolean;
  lastMessage: ChatMessage | null;
  unreadCount: number;
  /** When the other member(s) last read the conversation ("Seen 8:16"); the latest of them. */
  othersReadAt: string | null;
  /** Last message time, or creation time when empty. */
  updatedAt: string;
}
