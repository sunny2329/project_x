-- App redesign (ProjectX-UI handoff, 2026-10-21): what the new screens need that the schema lacked.
--   1. Messaging tables (designed in docs/sql/2026-09-29_messaging_and_indexes.sql, never applied)
--      plus a match attached to a message ("Sent a match result").
--   2. auth_identity: Google / Apple accounts linked in Settings.
--   3. media_files: photos (posts, profile pictures) stored in Postgres, served at /media/:id.
--   4. Small columns: post attachments, city, scoreboard device names, tournament entry fee.
-- Written idempotently where Postgres allows, so a partial run can be retried.

-- ---------------------------------------------------------------------------------------------
-- 1. Messaging
-- ---------------------------------------------------------------------------------------------

INSERT INTO type_master (id, type_id, description) VALUES (1301, 13, 'Direct'), (1302, 13, 'Group') ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS chat_conversation (
    id                    uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_type_id  bigint       NOT NULL,
    title                 varchar(100),
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
    left_at          timestamp,
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
    match_id         uuid,
    created_at       timestamp  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at       timestamp,
    CONSTRAINT fk_chat_message_conversation FOREIGN KEY (conversation_id) REFERENCES chat_conversation (id) ON DELETE CASCADE,
    CONSTRAINT fk_chat_message_sender FOREIGN KEY (sender_id) REFERENCES usr_user (id),
    CONSTRAINT fk_chat_message_match FOREIGN KEY (match_id) REFERENCES matches (id) ON DELETE SET NULL,
    CONSTRAINT chk_chat_message_content CHECK (char_length(content) BETWEEN 1 AND 4000)
);
ALTER TABLE chat_message ADD COLUMN IF NOT EXISTS match_id uuid;

CREATE INDEX IF NOT EXISTS idx_chat_member_user ON chat_conversation_member (user_id) WHERE left_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_chat_message_conversation ON chat_message (conversation_id, created_at DESC, id DESC);

-- ---------------------------------------------------------------------------------------------
-- 2. Linked sign-in providers
-- ---------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS auth_identity (
    id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid          NOT NULL,
    provider    varchar(20)   NOT NULL,
    subject     varchar(255)  NOT NULL,
    email       varchar(255),
    created_at  timestamptz   NOT NULL DEFAULT now(),
    CONSTRAINT fk_auth_identity_user FOREIGN KEY (user_id) REFERENCES usr_user (id) ON DELETE CASCADE,
    CONSTRAINT uq_auth_identity_subject UNIQUE (provider, subject),
    CONSTRAINT uq_auth_identity_user_provider UNIQUE (user_id, provider),
    CONSTRAINT chk_auth_identity_provider CHECK (provider IN ('google', 'apple'))
);

-- ---------------------------------------------------------------------------------------------
-- 3. Photos
-- ---------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS media_files (
    id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id  uuid         NOT NULL,
    mime_type      varchar(50)  NOT NULL,
    bytes          bytea        NOT NULL,
    byte_size      int          NOT NULL,
    width          int,
    height         int,
    created_at     timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT fk_media_files_owner FOREIGN KEY (owner_user_id) REFERENCES usr_user (id) ON DELETE CASCADE,
    CONSTRAINT chk_media_files_mime CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
    CONSTRAINT chk_media_files_size CHECK (byte_size BETWEEN 1 AND 3145728)
);
CREATE INDEX IF NOT EXISTS idx_media_files_owner ON media_files (owner_user_id, created_at DESC);

-- ---------------------------------------------------------------------------------------------
-- 4. Columns
-- ---------------------------------------------------------------------------------------------

-- A match attached to a written post (social_post.match_id stays the one automatic result post).
ALTER TABLE social_post ADD COLUMN IF NOT EXISTS attached_match_id uuid;
DO $$ BEGIN
  ALTER TABLE social_post ADD CONSTRAINT fk_social_post_attached_match FOREIGN KEY (attached_match_id) REFERENCES matches (id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE usr_user_profile ADD COLUMN IF NOT EXISTS city varchar(80);

-- "Pixel 8", "iPad": sent by the app at sign-in, shown under Settings > Devices.
ALTER TABLE auth_session ADD COLUMN IF NOT EXISTS device_name varchar(100);

-- Free text ("₹500", "Free"), shown on the tournament page and the register summary.
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS entry_fee varchar(40);
