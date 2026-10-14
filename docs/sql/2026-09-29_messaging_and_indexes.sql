-- Proposed schema change for the owner's `project_x` database (review before applying).
-- 1. Messaging: 1:1 and group conversations, members with read position, messages.
-- 2. Indexes the feed, match history, live list and posts need (docs/mvp-data-flow.md gap 6).
-- Follows the existing conventions: uuid ids from gen_random_uuid(), `timestamp` columns filled with
-- CURRENT_TIMESTAMP (UTC session), lookup values in type_master, fk_/uq_/idx_ names.
-- Idempotent (IF NOT EXISTS), so it can be re-run safely.

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 1. Messaging
-- ---------------------------------------------------------------------------------------------

-- conversation_type_id: type_master 1301 Direct, 1302 Group (inserted by `npm run seed`).
CREATE TABLE IF NOT EXISTS chat_conversation (
    id                    uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_type_id  bigint       NOT NULL,
    -- Group name; NULL for direct conversations (the app shows the other person's name).
    title                 varchar(100),
    -- Direct conversations only: '<smaller user id>:<larger user id>', so a pair has one conversation.
    direct_key            varchar(73),
    created_by            uuid         NOT NULL,
    last_message_at       timestamp,
    created_at            timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_chat_conversation_type FOREIGN KEY (conversation_type_id) REFERENCES type_master (id),
    CONSTRAINT fk_chat_conversation_creator FOREIGN KEY (created_by) REFERENCES usr_user (id),
    CONSTRAINT uq_chat_conversation_direct UNIQUE (direct_key),
    CONSTRAINT chk_chat_conversation_title CHECK (title IS NULL OR char_length(btrim(title)) BETWEEN 1 AND 100)
);

CREATE TABLE IF NOT EXISTS chat_conversation_member (
    id               uuid       PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id  uuid       NOT NULL,
    user_id          uuid       NOT NULL,
    is_admin         boolean    NOT NULL DEFAULT false,
    joined_at        timestamp  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Set when the member leaves a group; they keep read access to nothing after that.
    left_at          timestamp,
    -- Everything up to this moment counts as read (drives unread counts).
    last_read_at     timestamp,

    CONSTRAINT fk_chat_member_conversation FOREIGN KEY (conversation_id) REFERENCES chat_conversation (id) ON DELETE CASCADE,
    CONSTRAINT fk_chat_member_user FOREIGN KEY (user_id) REFERENCES usr_user (id) ON DELETE CASCADE,
    CONSTRAINT uq_chat_member UNIQUE (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS chat_message (
    id               uuid       PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id  uuid       NOT NULL,
    sender_id        uuid       NOT NULL,
    content          text       NOT NULL,
    created_at       timestamp  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Soft delete: the row stays so the conversation's order is kept; the app shows "Message deleted".
    deleted_at       timestamp,

    CONSTRAINT fk_chat_message_conversation FOREIGN KEY (conversation_id) REFERENCES chat_conversation (id) ON DELETE CASCADE,
    CONSTRAINT fk_chat_message_sender FOREIGN KEY (sender_id) REFERENCES usr_user (id),
    CONSTRAINT chk_chat_message_content CHECK (char_length(content) BETWEEN 1 AND 4000)
);

-- "My conversations" and membership checks.
CREATE INDEX IF NOT EXISTS idx_chat_member_user ON chat_conversation_member (user_id) WHERE left_at IS NULL;
-- A conversation's messages, newest first (pages and polling for new ones).
CREATE INDEX IF NOT EXISTS idx_chat_message_conversation ON chat_message (conversation_id, created_at DESC, id DESC);

-- ---------------------------------------------------------------------------------------------
-- 2. Indexes for existing tables (gap 6)
-- ---------------------------------------------------------------------------------------------

-- Match history and "live matches I play in".
CREATE INDEX IF NOT EXISTS idx_match_participant_user ON match_participant (user_id);
-- Live list: live matches, most recently updated first.
CREATE INDEX IF NOT EXISTS idx_match_master_status_updated ON match_master (status_id, updated_at DESC);
-- Feed: a user's posts, newest first.
CREATE INDEX IF NOT EXISTS idx_social_post_user_created ON social_post (user_id, created_at DESC, id DESC);
-- A post's comments in order, and comment counts.
CREATE INDEX IF NOT EXISTS idx_social_post_comment_post ON social_post_comment (post_id, created_at, id);
-- Blocks are checked in both directions on every feed and live query.
CREATE INDEX IF NOT EXISTS idx_usr_user_block_blocker ON usr_user_block (blocker_id, blocked_id);
CREATE INDEX IF NOT EXISTS idx_usr_user_block_blocked ON usr_user_block (blocked_id, blocker_id);
-- Notifications list (not used by the app yet, but the table is queried per user).
CREATE INDEX IF NOT EXISTS idx_notification_user_created ON notification (user_id, created_at DESC);

COMMIT;
