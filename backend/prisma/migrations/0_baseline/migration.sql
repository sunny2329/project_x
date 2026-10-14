-- Baseline: the project_x schema as it existed on 2026-10-14 (46 tables), generated with
-- `prisma migrate diff --from-empty --to-config-datasource`. On project_x this migration is only
-- marked as applied (`prisma migrate resolve --applied 0_baseline`); it runs for real only in
-- fresh databases and throwaway test schemas. Schema-qualified names were removed on purpose.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- CreateTable
CREATE TABLE "admin_analytics_daily" (
    "id" BIGSERIAL NOT NULL,
    "analytics_date" DATE NOT NULL,
    "sport_id" BIGINT,
    "metric_type_id" BIGINT NOT NULL,
    "metric_value" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_analytics_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_log" (
    "id" BIGSERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "action_type_id" BIGINT NOT NULL,
    "entity_type_id" BIGINT,
    "entity_id" UUID,
    "old_value" JSONB,
    "new_value" JSONB,
    "ip_address" INET,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_account_verification" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "verification_type" INTEGER NOT NULL DEFAULT 1,
    "target_value" VARCHAR(255),
    "verification_hash" VARCHAR(255),
    "expires_at" TIMESTAMPTZ(6),
    "verified_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_account_verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_device" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "device_identifier" VARCHAR(255) NOT NULL,
    "device_type" VARCHAR(30),
    "device_name" VARCHAR(255),
    "os_name" VARCHAR(100),
    "os_version" VARCHAR(50),
    "app_version" VARCHAR(50),
    "push_token" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_seen_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_login_log" (
    "id" BIGSERIAL NOT NULL,
    "user_id" UUID,
    "username" VARCHAR(50),
    "phone_country_code" VARCHAR(5),
    "phone_number" VARCHAR(20),
    "login_method" INTEGER NOT NULL DEFAULT 1,
    "action" INTEGER NOT NULL DEFAULT 1,
    "status" INTEGER NOT NULL DEFAULT 1,
    "failure_reason" VARCHAR(255),
    "ip_address" INET,
    "user_agent" TEXT,
    "device_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_login_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_otp" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "phone_country_code" VARCHAR(5) NOT NULL,
    "phone_number" VARCHAR(20) NOT NULL,
    "otp_hash" VARCHAR(255) NOT NULL,
    "purpose" INTEGER NOT NULL DEFAULT 1,
    "attempt_count" SMALLINT NOT NULL DEFAULT 0,
    "max_attempts" SMALLINT NOT NULL DEFAULT 5,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "verified_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_otp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_password_history" (
    "id" BIGSERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_password_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_password_reset" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_password_reset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_session" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "refresh_token_hash" VARCHAR(255) NOT NULL,
    "device_id" UUID,
    "ip_address" INET,
    "user_agent" TEXT,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "last_used_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_correction" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "match_id" UUID NOT NULL,
    "score_event_id" UUID NOT NULL,
    "correction_type_id" BIGINT NOT NULL,
    "reason" TEXT,
    "corrected_by" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_correction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_master" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sport_id" BIGINT NOT NULL,
    "format_id" BIGINT,
    "scoring_id" BIGINT,
    "created_by" UUID NOT NULL,
    "match_type_id" BIGINT NOT NULL,
    "status_id" BIGINT NOT NULL,
    "scheduled_at" TIMESTAMP(6),
    "started_at" TIMESTAMP(6),
    "completed_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_participant" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "match_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "participant_type_id" BIGINT,
    "participant_no" INTEGER NOT NULL,
    "status_id" BIGINT,
    "joined_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_period" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "match_id" UUID NOT NULL,
    "period_no" INTEGER NOT NULL,
    "period_type_id" BIGINT,
    "status_id" BIGINT,
    "started_at" TIMESTAMP(6),
    "completed_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_period_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_report" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reporter_id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "report_type_id" BIGINT NOT NULL,
    "description" TEXT,
    "status_id" BIGINT NOT NULL,
    "resolved_by" UUID,
    "resolved_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_result" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "match_id" UUID NOT NULL,
    "winner_participant_id" UUID,
    "winner_team_id" UUID,
    "result_type_id" BIGINT,
    "result_data" JSONB,
    "completed_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_score_event" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "match_id" UUID NOT NULL,
    "period_id" UUID,
    "participant_id" UUID,
    "team_id" UUID,
    "event_type_id" BIGINT NOT NULL,
    "sequence_no" INTEGER NOT NULL,
    "score_value" DECIMAL(10,2) DEFAULT 0,
    "event_data" JSONB,
    "is_undone" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_score_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_score_state" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "match_id" UUID NOT NULL,
    "period_id" UUID,
    "participant_id" UUID,
    "team_id" UUID,
    "score_value" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "state_data" JSONB,
    "last_event_id" UUID,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_score_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_stat_snapshot" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "match_id" UUID NOT NULL,
    "participant_id" UUID NOT NULL,
    "sport_id" BIGINT NOT NULL,
    "stat_data" JSONB NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_stat_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_stat_snapshot_detail" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "snapshot_id" UUID NOT NULL,
    "stat_type_id" BIGINT NOT NULL,
    "stat_value" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_stat_snapshot_detail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_team" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "match_id" UUID NOT NULL,
    "team_no" INTEGER NOT NULL,
    "team_name" VARCHAR(150),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_team_member" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "team_id" UUID NOT NULL,
    "participant_id" UUID NOT NULL,
    "member_no" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_team_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_asset" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "uploaded_by" UUID NOT NULL,
    "media_type_id" BIGINT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "media_url" TEXT,
    "file_name" VARCHAR(255),
    "mime_type" VARCHAR(100),
    "file_size" BIGINT,
    "width" INTEGER,
    "height" INTEGER,
    "duration" DECIMAL(10,2),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mst_sport" (
    "id" BIGSERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),

    CONSTRAINT "mst_sport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mst_sport_event" (
    "id" BIGSERIAL NOT NULL,
    "sport_id" BIGINT NOT NULL,
    "event_type_id" BIGINT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "event_config" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "mst_sport_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mst_sport_format" (
    "id" BIGSERIAL NOT NULL,
    "sport_id" BIGINT NOT NULL,
    "format_type_id" BIGINT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "min_players" SMALLINT,
    "max_players" SMALLINT,

    CONSTRAINT "mst_sport_format_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mst_sport_period" (
    "id" BIGSERIAL NOT NULL,
    "sport_id" BIGINT NOT NULL,
    "period_type_id" BIGINT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "sequence_no" SMALLINT,
    "config" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "mst_sport_period_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mst_sport_rule" (
    "id" BIGSERIAL NOT NULL,
    "sport_id" BIGINT NOT NULL,
    "rule_code" VARCHAR(100) NOT NULL,
    "rule_name" VARCHAR(255) NOT NULL,
    "rule_value" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mst_sport_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mst_sport_scoring" (
    "id" BIGSERIAL NOT NULL,
    "sport_id" BIGINT NOT NULL,
    "format_id" BIGINT,
    "scoring_type_id" BIGINT NOT NULL,
    "scoring_config" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "mst_sport_scoring_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mst_sport_stat" (
    "id" BIGSERIAL NOT NULL,
    "sport_id" BIGINT NOT NULL,
    "stat_code" VARCHAR(50) NOT NULL,
    "stat_name" VARCHAR(100) NOT NULL,
    "data_type_id" BIGINT NOT NULL,
    "description" VARCHAR(500),

    CONSTRAINT "mst_sport_stat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "notification_type_id" BIGINT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT,
    "reference_type_id" BIGINT,
    "reference_id" UUID,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(6),

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_post" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "post_type_id" BIGINT NOT NULL,
    "match_id" UUID,
    "content" TEXT,
    "visibility_id" BIGINT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_post_comment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "post_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "parent_comment_id" UUID,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_post_comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_post_like" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "post_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_post_like_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_post_media" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "post_id" UUID NOT NULL,
    "media_type_id" BIGINT NOT NULL,
    "media_url" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "media_order" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_post_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "type_master" (
    "id" BIGSERIAL NOT NULL,
    "type_id" INTEGER NOT NULL,
    "description" VARCHAR(255),

    CONSTRAINT "type_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_report" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reporter_id" UUID NOT NULL,
    "reported_user_id" UUID NOT NULL,
    "report_type_id" BIGINT NOT NULL,
    "description" TEXT,
    "status_id" BIGINT NOT NULL,
    "resolved_by" UUID,
    "resolved_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usr_role" (
    "id" BIGSERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usr_role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usr_sport_rating" (
    "id" BIGSERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "sport_id" BIGINT NOT NULL,
    "rating" DECIMAL(10,2) NOT NULL DEFAULT 1000,
    "matches_played" INTEGER NOT NULL DEFAULT 0,
    "matches_won" INTEGER NOT NULL DEFAULT 0,
    "matches_lost" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usr_sport_rating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usr_sport_stat_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "sport_id" BIGINT NOT NULL,
    "match_id" UUID NOT NULL,
    "stat_data" JSONB NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usr_sport_stat_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usr_sport_stats" (
    "id" BIGSERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "sport_id" BIGINT NOT NULL,
    "matches_played" INTEGER NOT NULL DEFAULT 0,
    "matches_won" INTEGER NOT NULL DEFAULT 0,
    "matches_lost" INTEGER NOT NULL DEFAULT 0,
    "points_scored" BIGINT NOT NULL DEFAULT 0,
    "points_conceded" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usr_sport_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usr_user" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "username" VARCHAR(50) NOT NULL,
    "phone_country_code" VARCHAR(5) NOT NULL,
    "phone_number" VARCHAR(20) NOT NULL,
    "email" VARCHAR(255),
    "password_hash" VARCHAR(255) NOT NULL,
    "status" INTEGER NOT NULL DEFAULT 1,
    "is_phone_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_email_verified" BOOLEAN NOT NULL DEFAULT false,
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usr_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usr_user_block" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "blocker_id" UUID NOT NULL,
    "blocked_id" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usr_user_block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usr_user_follow" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "follower_id" UUID NOT NULL,
    "following_id" UUID NOT NULL,
    "status_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usr_user_follow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usr_user_profile" (
    "id" BIGSERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "display_name" VARCHAR(150) NOT NULL,
    "profile_photo" TEXT,
    "city_id" BIGINT,
    "bio" VARCHAR(500),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usr_user_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usr_user_role" (
    "id" BIGSERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usr_user_role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usr_user_sport" (
    "id" BIGSERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "sport_id" BIGINT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usr_user_sport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_admin_analytics_daily" ON "admin_analytics_daily"("analytics_date" ASC, "sport_id" ASC, "metric_type_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_auth_device" ON "auth_device"("user_id" ASC, "device_identifier" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_match_correction_event" ON "match_correction"("score_event_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_match_participant_no" ON "match_participant"("match_id" ASC, "participant_no" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_match_participant_user" ON "match_participant"("match_id" ASC, "user_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_match_period_no" ON "match_period"("match_id" ASC, "period_no" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_match_result_match" ON "match_result"("match_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_match_score_event_sequence" ON "match_score_event"("match_id" ASC, "sequence_no" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_match_stat_snapshot" ON "match_stat_snapshot"("match_id" ASC, "participant_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_match_stat_snapshot_detail" ON "match_stat_snapshot_detail"("snapshot_id" ASC, "stat_type_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_match_team_no" ON "match_team"("match_id" ASC, "team_no" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_match_team_member" ON "match_team_member"("team_id" ASC, "participant_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_match_team_member_no" ON "match_team_member"("team_id" ASC, "member_no" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_mst_sport_code" ON "mst_sport"("code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_mst_sport_name" ON "mst_sport"("name" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_sport_event" ON "mst_sport_event"("sport_id" ASC, "event_type_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_sport_format" ON "mst_sport_format"("sport_id" ASC, "format_type_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_sport_period" ON "mst_sport_period"("sport_id" ASC, "period_type_id" ASC, "sequence_no" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_mst_sport_rule_code" ON "mst_sport_rule"("sport_id" ASC, "rule_code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_sport_scoring" ON "mst_sport_scoring"("sport_id" ASC, "format_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_sport_stat" ON "mst_sport_stat"("sport_id" ASC, "stat_code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_social_post_match" ON "social_post"("match_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_social_post_like" ON "social_post_like"("post_id" ASC, "user_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_social_post_media_order" ON "social_post_media"("post_id" ASC, "media_order" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_type_master_id_id" ON "type_master"("type_id" ASC, "id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_usr_role_code" ON "usr_role"("code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_usr_sport_rating" ON "usr_sport_rating"("user_id" ASC, "sport_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_usr_sport_stat_history" ON "usr_sport_stat_history"("user_id" ASC, "sport_id" ASC, "match_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_usr_sport_stats" ON "usr_sport_stats"("user_id" ASC, "sport_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_usr_user_email" ON "usr_user"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_usr_user_phone" ON "usr_user"("phone_country_code" ASC, "phone_number" ASC);

-- CreateIndex
CREATE INDEX "idx_usr_user_block_blocked" ON "usr_user_block"("blocked_id" ASC);

-- CreateIndex
CREATE INDEX "idx_usr_user_block_blocker" ON "usr_user_block"("blocker_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_usr_user_block" ON "usr_user_block"("blocker_id" ASC, "blocked_id" ASC);

-- CreateIndex
CREATE INDEX "idx_usr_user_follow_follower" ON "usr_user_follow"("follower_id" ASC);

-- CreateIndex
CREATE INDEX "idx_usr_user_follow_following" ON "usr_user_follow"("following_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_usr_user_follow" ON "usr_user_follow"("follower_id" ASC, "following_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_usr_user_profile_user" ON "usr_user_profile"("user_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_usr_user_role" ON "usr_user_role"("user_id" ASC, "role_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_usr_user_sport" ON "usr_user_sport"("user_id" ASC, "sport_id" ASC);

-- AddForeignKey
ALTER TABLE "admin_analytics_daily" ADD CONSTRAINT "fk_admin_analytics_daily_sport" FOREIGN KEY ("sport_id") REFERENCES "mst_sport"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "fk_admin_audit_log_user" FOREIGN KEY ("user_id") REFERENCES "usr_user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "auth_account_verification" ADD CONSTRAINT "fk_account_verification_user" FOREIGN KEY ("user_id") REFERENCES "usr_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "auth_device" ADD CONSTRAINT "fk_auth_device_user" FOREIGN KEY ("user_id") REFERENCES "usr_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "auth_login_log" ADD CONSTRAINT "fk_login_log_user" FOREIGN KEY ("user_id") REFERENCES "usr_user"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "auth_otp" ADD CONSTRAINT "fk_auth_otp_user" FOREIGN KEY ("user_id") REFERENCES "usr_user"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "auth_password_history" ADD CONSTRAINT "fk_password_history_user" FOREIGN KEY ("user_id") REFERENCES "usr_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "auth_password_reset" ADD CONSTRAINT "fk_password_reset_user" FOREIGN KEY ("user_id") REFERENCES "usr_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "auth_session" ADD CONSTRAINT "fk_auth_session_user" FOREIGN KEY ("user_id") REFERENCES "usr_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "match_correction" ADD CONSTRAINT "fk_match_correction_event" FOREIGN KEY ("score_event_id") REFERENCES "match_score_event"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "match_correction" ADD CONSTRAINT "fk_match_correction_match" FOREIGN KEY ("match_id") REFERENCES "match_master"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "match_correction" ADD CONSTRAINT "fk_match_correction_user" FOREIGN KEY ("corrected_by") REFERENCES "usr_user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "match_master" ADD CONSTRAINT "fk_match_master_created_by" FOREIGN KEY ("created_by") REFERENCES "usr_user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "match_master" ADD CONSTRAINT "fk_match_master_format" FOREIGN KEY ("format_id") REFERENCES "mst_sport_format"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "match_master" ADD CONSTRAINT "fk_match_master_scoring" FOREIGN KEY ("scoring_id") REFERENCES "mst_sport_scoring"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "match_master" ADD CONSTRAINT "fk_match_master_sport" FOREIGN KEY ("sport_id") REFERENCES "mst_sport"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "match_participant" ADD CONSTRAINT "fk_match_participant_match" FOREIGN KEY ("match_id") REFERENCES "match_master"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "match_participant" ADD CONSTRAINT "fk_match_participant_user" FOREIGN KEY ("user_id") REFERENCES "usr_user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "match_period" ADD CONSTRAINT "fk_match_period_match" FOREIGN KEY ("match_id") REFERENCES "match_master"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "match_report" ADD CONSTRAINT "fk_match_report_match" FOREIGN KEY ("match_id") REFERENCES "match_master"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "match_report" ADD CONSTRAINT "fk_match_report_reporter" FOREIGN KEY ("reporter_id") REFERENCES "usr_user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "match_report" ADD CONSTRAINT "fk_match_report_resolved_by" FOREIGN KEY ("resolved_by") REFERENCES "usr_user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "match_result" ADD CONSTRAINT "fk_match_result_match" FOREIGN KEY ("match_id") REFERENCES "match_master"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "match_result" ADD CONSTRAINT "fk_match_result_winner_participant" FOREIGN KEY ("winner_participant_id") REFERENCES "match_participant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "match_result" ADD CONSTRAINT "fk_match_result_winner_team" FOREIGN KEY ("winner_team_id") REFERENCES "match_team"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "match_score_event" ADD CONSTRAINT "fk_match_score_event_created_by" FOREIGN KEY ("created_by") REFERENCES "usr_user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "match_score_event" ADD CONSTRAINT "fk_match_score_event_match" FOREIGN KEY ("match_id") REFERENCES "match_master"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "match_score_event" ADD CONSTRAINT "fk_match_score_event_participant" FOREIGN KEY ("participant_id") REFERENCES "match_participant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "match_score_event" ADD CONSTRAINT "fk_match_score_event_period" FOREIGN KEY ("period_id") REFERENCES "match_period"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "match_score_event" ADD CONSTRAINT "fk_match_score_event_team" FOREIGN KEY ("team_id") REFERENCES "match_team"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "match_score_state" ADD CONSTRAINT "fk_match_score_state_event" FOREIGN KEY ("last_event_id") REFERENCES "match_score_event"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "match_score_state" ADD CONSTRAINT "fk_match_score_state_match" FOREIGN KEY ("match_id") REFERENCES "match_master"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "match_score_state" ADD CONSTRAINT "fk_match_score_state_participant" FOREIGN KEY ("participant_id") REFERENCES "match_participant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "match_score_state" ADD CONSTRAINT "fk_match_score_state_period" FOREIGN KEY ("period_id") REFERENCES "match_period"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "match_score_state" ADD CONSTRAINT "fk_match_score_state_team" FOREIGN KEY ("team_id") REFERENCES "match_team"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "match_stat_snapshot" ADD CONSTRAINT "fk_match_stat_snapshot_match" FOREIGN KEY ("match_id") REFERENCES "match_master"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "match_stat_snapshot" ADD CONSTRAINT "fk_match_stat_snapshot_participant" FOREIGN KEY ("participant_id") REFERENCES "match_participant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "match_stat_snapshot" ADD CONSTRAINT "fk_match_stat_snapshot_sport" FOREIGN KEY ("sport_id") REFERENCES "mst_sport"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "match_stat_snapshot_detail" ADD CONSTRAINT "fk_match_stat_snapshot_detail_snapshot" FOREIGN KEY ("snapshot_id") REFERENCES "match_stat_snapshot"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "match_team" ADD CONSTRAINT "fk_match_team_match" FOREIGN KEY ("match_id") REFERENCES "match_master"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "match_team_member" ADD CONSTRAINT "fk_match_team_member_participant" FOREIGN KEY ("participant_id") REFERENCES "match_participant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "match_team_member" ADD CONSTRAINT "fk_match_team_member_team" FOREIGN KEY ("team_id") REFERENCES "match_team"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "media_asset" ADD CONSTRAINT "fk_media_asset_uploaded_by" FOREIGN KEY ("uploaded_by") REFERENCES "usr_user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_sport_event" ADD CONSTRAINT "fk_sport_event_sport" FOREIGN KEY ("sport_id") REFERENCES "mst_sport"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_sport_event" ADD CONSTRAINT "fk_sport_event_type" FOREIGN KEY ("event_type_id") REFERENCES "type_master"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_sport_format" ADD CONSTRAINT "fk_sport_format_sport" FOREIGN KEY ("sport_id") REFERENCES "mst_sport"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_sport_format" ADD CONSTRAINT "fk_sport_format_type" FOREIGN KEY ("format_type_id") REFERENCES "type_master"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_sport_period" ADD CONSTRAINT "fk_sport_period_sport" FOREIGN KEY ("sport_id") REFERENCES "mst_sport"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_sport_period" ADD CONSTRAINT "fk_sport_period_type" FOREIGN KEY ("period_type_id") REFERENCES "type_master"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_sport_rule" ADD CONSTRAINT "fk_mst_sport_rule_sport" FOREIGN KEY ("sport_id") REFERENCES "mst_sport"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_sport_scoring" ADD CONSTRAINT "fk_sport_scoring_format" FOREIGN KEY ("format_id") REFERENCES "mst_sport_format"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_sport_scoring" ADD CONSTRAINT "fk_sport_scoring_sport" FOREIGN KEY ("sport_id") REFERENCES "mst_sport"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_sport_scoring" ADD CONSTRAINT "fk_sport_scoring_type" FOREIGN KEY ("scoring_type_id") REFERENCES "type_master"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_sport_stat" ADD CONSTRAINT "fk_sport_stat_data_type" FOREIGN KEY ("data_type_id") REFERENCES "type_master"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mst_sport_stat" ADD CONSTRAINT "fk_sport_stat_sport" FOREIGN KEY ("sport_id") REFERENCES "mst_sport"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "fk_notification_user" FOREIGN KEY ("user_id") REFERENCES "usr_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "social_post" ADD CONSTRAINT "fk_social_post_match" FOREIGN KEY ("match_id") REFERENCES "match_master"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "social_post" ADD CONSTRAINT "fk_social_post_user" FOREIGN KEY ("user_id") REFERENCES "usr_user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "social_post_comment" ADD CONSTRAINT "fk_social_post_comment_parent" FOREIGN KEY ("parent_comment_id") REFERENCES "social_post_comment"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "social_post_comment" ADD CONSTRAINT "fk_social_post_comment_post" FOREIGN KEY ("post_id") REFERENCES "social_post"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "social_post_comment" ADD CONSTRAINT "fk_social_post_comment_user" FOREIGN KEY ("user_id") REFERENCES "usr_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "social_post_like" ADD CONSTRAINT "fk_social_post_like_post" FOREIGN KEY ("post_id") REFERENCES "social_post"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "social_post_like" ADD CONSTRAINT "fk_social_post_like_user" FOREIGN KEY ("user_id") REFERENCES "usr_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "social_post_media" ADD CONSTRAINT "fk_social_post_media_post" FOREIGN KEY ("post_id") REFERENCES "social_post"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_report" ADD CONSTRAINT "fk_user_report_reported_user" FOREIGN KEY ("reported_user_id") REFERENCES "usr_user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_report" ADD CONSTRAINT "fk_user_report_reporter" FOREIGN KEY ("reporter_id") REFERENCES "usr_user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_report" ADD CONSTRAINT "fk_user_report_resolved_by" FOREIGN KEY ("resolved_by") REFERENCES "usr_user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usr_sport_rating" ADD CONSTRAINT "fk_usr_sport_rating_sport" FOREIGN KEY ("sport_id") REFERENCES "mst_sport"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usr_sport_rating" ADD CONSTRAINT "fk_usr_sport_rating_user" FOREIGN KEY ("user_id") REFERENCES "usr_user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usr_sport_stat_history" ADD CONSTRAINT "fk_usr_sport_stat_history_match" FOREIGN KEY ("match_id") REFERENCES "match_master"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usr_sport_stat_history" ADD CONSTRAINT "fk_usr_sport_stat_history_sport" FOREIGN KEY ("sport_id") REFERENCES "mst_sport"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usr_sport_stat_history" ADD CONSTRAINT "fk_usr_sport_stat_history_user" FOREIGN KEY ("user_id") REFERENCES "usr_user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usr_sport_stats" ADD CONSTRAINT "fk_usr_sport_stats_sport" FOREIGN KEY ("sport_id") REFERENCES "mst_sport"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usr_sport_stats" ADD CONSTRAINT "fk_usr_sport_stats_user" FOREIGN KEY ("user_id") REFERENCES "usr_user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usr_user_block" ADD CONSTRAINT "fk_usr_user_block_blocked" FOREIGN KEY ("blocked_id") REFERENCES "usr_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usr_user_block" ADD CONSTRAINT "fk_usr_user_block_blocker" FOREIGN KEY ("blocker_id") REFERENCES "usr_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usr_user_follow" ADD CONSTRAINT "fk_usr_user_follow_follower" FOREIGN KEY ("follower_id") REFERENCES "usr_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usr_user_follow" ADD CONSTRAINT "fk_usr_user_follow_following" FOREIGN KEY ("following_id") REFERENCES "usr_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usr_user_profile" ADD CONSTRAINT "fk_usr_user_profile_user" FOREIGN KEY ("user_id") REFERENCES "usr_user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usr_user_role" ADD CONSTRAINT "fk_usr_user_role_role" FOREIGN KEY ("role_id") REFERENCES "usr_role"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usr_user_role" ADD CONSTRAINT "fk_usr_user_role_user" FOREIGN KEY ("user_id") REFERENCES "usr_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usr_user_sport" ADD CONSTRAINT "fk_usr_user_sport_sport" FOREIGN KEY ("sport_id") REFERENCES "mst_sport"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usr_user_sport" ADD CONSTRAINT "fk_usr_user_sport_user" FOREIGN KEY ("user_id") REFERENCES "usr_user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Not representable in schema.prisma, copied from project_x by hand.
ALTER TABLE "usr_user_follow" ADD CONSTRAINT "chk_usr_user_follow_self" CHECK (follower_id <> following_id);
ALTER TABLE "usr_user_block" ADD CONSTRAINT "chk_usr_user_block_self" CHECK (blocker_id <> blocked_id);
ALTER TABLE "user_report" ADD CONSTRAINT "chk_user_report_self" CHECK (reporter_id <> reported_user_id);
CREATE UNIQUE INDEX "uq_usr_user_username_lower" ON "usr_user" (lower((username)::text));
