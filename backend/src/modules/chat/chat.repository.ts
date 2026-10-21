import type { Queryable } from '../../database/pool.js';
import { UserStatus } from '../auth/auth.types.js';
import { ConversationType } from './chat.codes.js';
import type { ChatMessage, ChatUser, Conversation } from './chat.types.js';

type MessageRow = Omit<ChatMessage, 'createdAt'> & { createdAt: Date };
type ConversationRow = Omit<Conversation, 'updatedAt' | 'lastMessage'> & {
  updatedAt: Date;
  lastMessage: (Omit<ChatMessage, 'createdAt'> & { createdAt: string }) | null;
};

const USER_JSON = (user: string, profile: string) =>
  `json_build_object('id', ${user}.id, 'username', ${user}.username, 'fullName', coalesce(${profile}.display_name, ${user}.username), 'photoUrl', ${profile}.profile_photo)`;

/** The shared match of message `msg` as a result card, or NULL. */
const MATCH_JSON = `
  CASE WHEN msg.match_id IS NULL THEN NULL ELSE (
    SELECT json_build_object(
      'id', m.id,
      'sport', json_build_object('slug', s.slug, 'name', s.name, 'accentColor', s.accent_color),
      'format', f.name,
      'status', m.status,
      'winnerSideIndex', (m.summary->>'winnerSideIndex')::int,
      'sides', (SELECT json_agg(json_build_object('index', ms.side_index, 'name', coalesce(ms.name,
                  (SELECT string_agg(pl.display_name, ' & ' ORDER BY mp.sort_order) FROM match_participants mp JOIN players pl ON pl.id = mp.player_id
                    WHERE mp.side_id = ms.id))) ORDER BY ms.side_index)
                  FROM match_sides ms WHERE ms.match_id = m.id),
      'segments', (SELECT coalesce(json_agg(seg->'scores' ORDER BY ord), '[]'::json)
                     FROM jsonb_array_elements(coalesce(m.summary->'segments', '[]'::jsonb)) WITH ORDINALITY AS x(seg, ord)))
      FROM matches m JOIN sports s ON s.id = m.sport_id JOIN sport_formats f ON f.id = m.sport_format_id
     WHERE m.id = msg.match_id) END`;

const MESSAGE_COLUMNS = `
  msg.id, msg.conversation_id AS "conversationId", ${USER_JSON('su', 'spr')} AS sender,
  CASE WHEN msg.deleted_at IS NULL THEN msg.content END AS content,
  msg.created_at AS "createdAt", msg.deleted_at IS NOT NULL AS deleted, ${MATCH_JSON} AS match`;

const MESSAGE_FROM = `
  FROM chat_message msg
  JOIN usr_user su ON su.id = msg.sender_id
  LEFT JOIN usr_user_profile spr ON spr.user_id = su.id`;

/** `$1` is the viewer; expects `c` (conversation) and `me` (the viewer's membership row). */
const CONVERSATION_COLUMNS = `
  c.id, CASE WHEN c.conversation_type_id = ${ConversationType.GROUP} THEN 'group' ELSE 'direct' END AS type,
  c.title, me.is_admin AS "isAdmin",
  (SELECT json_agg(${USER_JSON('u', 'pr')} ORDER BY mm.joined_at)
     FROM chat_conversation_member mm
     JOIN usr_user u ON u.id = mm.user_id
     LEFT JOIN usr_user_profile pr ON pr.user_id = u.id
    WHERE mm.conversation_id = c.id AND mm.left_at IS NULL) AS members,
  (SELECT json_build_object('id', msg.id, 'conversationId', msg.conversation_id, 'sender', ${USER_JSON('su', 'spr')},
                            'content', CASE WHEN msg.deleted_at IS NULL THEN msg.content END,
                            'createdAt', to_char(msg.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
                            'deleted', msg.deleted_at IS NOT NULL, 'match', ${MATCH_JSON})
     ${MESSAGE_FROM}
    WHERE msg.conversation_id = c.id
    ORDER BY msg.created_at DESC, msg.id DESC LIMIT 1) AS "lastMessage",
  (SELECT count(*)::int FROM chat_message um
    WHERE um.conversation_id = c.id AND um.sender_id <> $1 AND um.deleted_at IS NULL
      AND um.created_at > coalesce(me.last_read_at, me.joined_at)) AS "unreadCount",
  (SELECT to_char(max(om.last_read_at), 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') FROM chat_conversation_member om
    WHERE om.conversation_id = c.id AND om.user_id <> $1 AND om.left_at IS NULL) AS "othersReadAt",
  coalesce(c.last_message_at, c.created_at) AS "updatedAt"`;

function toMessage(row: MessageRow): ChatMessage {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

function toConversation(row: ConversationRow): Conversation {
  return { ...row, members: row.members ?? [], updatedAt: row.updatedAt.toISOString() };
}

export const chatRepository = {
  /** Active users among `userIds` that nobody in the pair has blocked (either direction) with `viewerId`. */
  async findReachableUsers(db: Queryable, viewerId: string, userIds: string[]): Promise<ChatUser[]> {
    const { rows } = await db.query<ChatUser>(
      `SELECT u.id, u.username, coalesce(pr.display_name, u.username) AS "fullName", pr.profile_photo AS "photoUrl"
         FROM usr_user u
         LEFT JOIN usr_user_profile pr ON pr.user_id = u.id
        WHERE u.id = ANY($2::uuid[]) AND u.status = $3
          AND NOT EXISTS (SELECT 1 FROM usr_user_block b
                           WHERE (b.blocker_id = $1 AND b.blocked_id = u.id) OR (b.blocker_id = u.id AND b.blocked_id = $1))`,
      [viewerId, userIds, UserStatus.ACTIVE],
    );
    return rows;
  },

  /** The direct conversation between two users, created if it does not exist yet. */
  async findOrCreateDirect(db: Queryable, userId: string, otherId: string): Promise<string> {
    const key = [userId, otherId].sort().join(':');
    const { rows } = await db.query<{ id: string }>(
      `WITH created AS (
         INSERT INTO chat_conversation (conversation_type_id, direct_key, created_by) VALUES ($1, $2, $3)
         ON CONFLICT (direct_key) DO NOTHING RETURNING id
       ), members AS (
         INSERT INTO chat_conversation_member (conversation_id, user_id)
         SELECT created.id, x.user_id FROM created, unnest($4::uuid[]) AS x(user_id)
       )
       SELECT id FROM created
       UNION ALL
       SELECT id FROM chat_conversation WHERE direct_key = $2`,
      [ConversationType.DIRECT, key, userId, [userId, otherId]],
    );
    return rows[0]!.id;
  },

  async createGroup(db: Queryable, creatorId: string, title: string, memberIds: string[]): Promise<string> {
    const { rows } = await db.query<{ id: string }>(
      `WITH created AS (
         INSERT INTO chat_conversation (conversation_type_id, title, created_by) VALUES ($1, $2, $3) RETURNING id
       ), members AS (
         INSERT INTO chat_conversation_member (conversation_id, user_id, is_admin)
         SELECT created.id, x.user_id, x.user_id = $3 FROM created, unnest($4::uuid[]) AS x(user_id)
       )
       SELECT id FROM created`,
      [ConversationType.GROUP, title, creatorId, [creatorId, ...memberIds]],
    );
    return rows[0]!.id;
  },

  /** Adds members to a group; people who left before rejoin. */
  async addMembers(db: Queryable, conversationId: string, userIds: string[]): Promise<void> {
    await db.query(
      `INSERT INTO chat_conversation_member (conversation_id, user_id)
       SELECT $1, x.user_id FROM unnest($2::uuid[]) AS x(user_id)
       ON CONFLICT (conversation_id, user_id) DO UPDATE SET left_at = NULL, joined_at = CURRENT_TIMESTAMP, last_read_at = NULL
       WHERE chat_conversation_member.left_at IS NOT NULL`,
      [conversationId, userIds],
    );
  },

  async leave(db: Queryable, conversationId: string, userId: string): Promise<void> {
    await db.query(
      'UPDATE chat_conversation_member SET left_at = CURRENT_TIMESTAMP, is_admin = false WHERE conversation_id = $1 AND user_id = $2 AND left_at IS NULL',
      [conversationId, userId],
    );
    // A group whose last admin left gets its longest-standing member as admin.
    await db.query(
      `UPDATE chat_conversation_member SET is_admin = true
        WHERE id = (SELECT id FROM chat_conversation_member
                     WHERE conversation_id = $1 AND left_at IS NULL ORDER BY joined_at LIMIT 1)
          AND NOT EXISTS (SELECT 1 FROM chat_conversation_member WHERE conversation_id = $1 AND left_at IS NULL AND is_admin)`,
      [conversationId],
    );
  },

  /** Ids of current members (for access checks). */
  async findMemberIds(db: Queryable, conversationId: string): Promise<string[]> {
    const { rows } = await db.query<{ userId: string }>(
      'SELECT user_id AS "userId" FROM chat_conversation_member WHERE conversation_id = $1 AND left_at IS NULL',
      [conversationId],
    );
    return rows.map((row) => row.userId);
  },

  async findConversation(db: Queryable, viewerId: string, conversationId: string): Promise<Conversation | null> {
    const { rows } = await db.query<ConversationRow>(
      `SELECT ${CONVERSATION_COLUMNS}
         FROM chat_conversation c
         JOIN chat_conversation_member me ON me.conversation_id = c.id AND me.user_id = $1 AND me.left_at IS NULL
        WHERE c.id = $2`,
      [viewerId, conversationId],
    );
    return rows[0] ? toConversation(rows[0]) : null;
  },

  /** The viewer's conversations, most recently active first. */
  async listConversations(db: Queryable, viewerId: string, limit: number): Promise<Conversation[]> {
    const { rows } = await db.query<ConversationRow>(
      `SELECT ${CONVERSATION_COLUMNS}
         FROM chat_conversation_member me
         JOIN chat_conversation c ON c.id = me.conversation_id
        WHERE me.user_id = $1 AND me.left_at IS NULL
        ORDER BY coalesce(c.last_message_at, c.created_at) DESC
        LIMIT $2`,
      [viewerId, limit],
    );
    return rows.map(toConversation);
  },

  async unreadTotal(db: Queryable, viewerId: string): Promise<number> {
    const { rows } = await db.query<{ count: number }>(
      `SELECT count(*)::int AS count
         FROM chat_conversation_member me
         JOIN chat_message um ON um.conversation_id = me.conversation_id
        WHERE me.user_id = $1 AND me.left_at IS NULL AND um.sender_id <> $1 AND um.deleted_at IS NULL
          AND um.created_at > coalesce(me.last_read_at, me.joined_at)`,
      [viewerId],
    );
    return rows[0]!.count;
  },

  /**
   * A page of messages in time order. `before`: the page just older than that message; `after`:
   * everything newer than it (up to `limit`); neither: the newest page.
   */
  async listMessages(
    db: Queryable,
    conversationId: string,
    options: { limit: number; before?: string | undefined; after?: string | undefined },
  ): Promise<ChatMessage[]> {
    const cursor = options.before ?? options.after ?? null;
    const newer = Boolean(options.after);
    const { rows } = await db.query<MessageRow>(
      `SELECT ${MESSAGE_COLUMNS}
       ${MESSAGE_FROM}
        WHERE msg.conversation_id = $1
          AND ($2::uuid IS NULL OR (msg.created_at, msg.id) ${newer ? '>' : '<'}
                                   (SELECT x.created_at, x.id FROM chat_message x WHERE x.id = $2::uuid))
        ORDER BY msg.created_at ${newer ? 'ASC' : 'DESC'}, msg.id ${newer ? 'ASC' : 'DESC'}
        LIMIT $3`,
      [conversationId, cursor, options.limit],
    );
    const messages = rows.map(toMessage);
    return newer ? messages : messages.reverse();
  },

  async insertMessage(
    db: Queryable,
    message: { conversationId: string; senderId: string; content: string; matchId?: string | null },
  ): Promise<ChatMessage> {
    const { rows } = await db.query<MessageRow>(
      `WITH msg AS (
         INSERT INTO chat_message (conversation_id, sender_id, content, match_id) VALUES ($1, $2, $3, $4)
         RETURNING id, conversation_id, sender_id, content, match_id, created_at, deleted_at
       ), touched AS (
         UPDATE chat_conversation SET last_message_at = (SELECT created_at FROM msg), updated_at = CURRENT_TIMESTAMP WHERE id = $1
       ), read AS (
         -- Sending counts as having read everything before it.
         UPDATE chat_conversation_member SET last_read_at = (SELECT created_at FROM msg) WHERE conversation_id = $1 AND user_id = $2
       )
       SELECT ${MESSAGE_COLUMNS} ${MESSAGE_FROM.replace('FROM chat_message msg', 'FROM msg')}`,
      [message.conversationId, message.senderId, message.content, message.matchId ?? null],
    );
    return toMessage(rows[0]!);
  },

  /** True when the user played in or created the match. */
  async isMatchOfUser(db: Queryable, userId: string, matchId: string): Promise<boolean> {
    const { rows } = await db.query(
      `SELECT 1 FROM matches m
        WHERE m.id = $2 AND (m.created_by_user_id = $1
              OR EXISTS (SELECT 1 FROM match_participants mp JOIN players p ON p.id = mp.player_id WHERE mp.match_id = m.id AND p.user_id = $1))`,
      [userId, matchId],
    );
    return rows.length > 0;
  },

  /** Soft-deletes the sender's own message. */
  async deleteOwnMessage(db: Queryable, conversationId: string, messageId: string, userId: string): Promise<boolean> {
    const { rowCount } = await db.query(
      'UPDATE chat_message SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND conversation_id = $2 AND sender_id = $3 AND deleted_at IS NULL',
      [messageId, conversationId, userId],
    );
    return (rowCount ?? 0) > 0;
  },

  async markRead(db: Queryable, conversationId: string, userId: string): Promise<void> {
    await db.query(
      'UPDATE chat_conversation_member SET last_read_at = CURRENT_TIMESTAMP WHERE conversation_id = $1 AND user_id = $2 AND left_at IS NULL',
      [conversationId, userId],
    );
  },
};

export type ChatRepository = typeof chatRepository;
