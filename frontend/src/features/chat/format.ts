import type { ChatUser, Conversation } from './types';

/** Group name, or the other person's name in a direct conversation. */
export function conversationTitle(conversation: Conversation, myId: string | undefined): string {
  if (conversation.title) return conversation.title;
  const others = conversation.members.filter((member) => member.id !== myId);
  return others.map((member) => member.fullName).join(', ') || 'Just you';
}

export function otherMembers(conversation: Conversation, myId: string | undefined): ChatUser[] {
  return conversation.members.filter((member) => member.id !== myId);
}

/** "9:05 PM" for a message bubble. */
export function formatTimeOfDay(iso: string): string {
  const date = new Date(iso);
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours % 12 || 12}:${minutes} ${hours < 12 ? 'AM' : 'PM'}`;
}

/** "Today", "Yesterday", or "12 Sep" for the separators between days. */
export function formatDay(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(date)) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getMonth()];
  return date.getFullYear() === now.getFullYear() ? `${date.getDate()} ${month}` : `${date.getDate()} ${month} ${date.getFullYear()}`;
}
