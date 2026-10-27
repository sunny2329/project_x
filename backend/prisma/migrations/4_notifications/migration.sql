-- In-app notifications (2026-10-25): the bell on Home. Reuses the legacy `notification` table.
--   - type_master category 14: what happened (like, comment, new post, follow).
--   - actor_id: who did it (the avatar and name shown), removed with their account.
--   - reference_id: the post for likes, comments and new posts; NULL for follows.
-- Written idempotently where Postgres allows, so a partial run can be retried.

INSERT INTO type_master (id, type_id, description) VALUES
  (1401, 14, 'Like'), (1402, 14, 'Comment'), (1403, 14, 'New post'), (1404, 14, 'Follow')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE notification ADD COLUMN IF NOT EXISTS actor_id uuid;
DO $$ BEGIN
  ALTER TABLE notification ADD CONSTRAINT fk_notification_actor FOREIGN KEY (actor_id) REFERENCES usr_user (id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- The list (newest first, keyset) and the unread badge.
CREATE INDEX IF NOT EXISTS idx_notification_user ON notification (user_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_notification_unread ON notification (user_id) WHERE NOT is_read;
-- Removing a like / follow notification, and cleaning up after a deleted post.
CREATE INDEX IF NOT EXISTS idx_notification_reference ON notification (reference_id) WHERE reference_id IS NOT NULL;
