-- Racket-first pivot: the generic core (sports, rulesets, players, matches, event log,
-- segments, ratings, tournaments). Creates new tables only, plus one FK re-point on an unused
-- column: social_post.match_id now references matches instead of match_master (0 rows used it).
-- Legacy match_* / mst_* / usr_sport_* tables are left untouched and frozen.

-- CreateEnum
CREATE TYPE "match_context" AS ENUM ('friendly', 'tournament');

-- CreateEnum
CREATE TYPE "match_status" AS ENUM ('scheduled', 'live', 'completed', 'abandoned', 'disputed', 'walkover', 'retired');

-- CreateEnum
CREATE TYPE "scoring_mode" AS ENUM ('live', 'manual');

-- CreateEnum
CREATE TYPE "result_type" AS ENUM ('played', 'walkover', 'no_show', 'retired', 'double_walkover');

-- CreateEnum
CREATE TYPE "verification_status" AS ENUM ('not_required', 'pending', 'confirmed', 'disputed');

-- CreateEnum
CREATE TYPE "confirmation_decision" AS ENUM ('confirmed', 'disputed');

-- CreateEnum
CREATE TYPE "side_outcome" AS ENUM ('won', 'lost', 'drawn');

-- CreateEnum
CREATE TYPE "segment_status" AS ENUM ('in_progress', 'completed');

-- CreateEnum
CREATE TYPE "tournament_status" AS ENUM ('draft', 'registration_open', 'registration_closed', 'in_progress', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "tournament_visibility" AS ENUM ('public', 'unlisted', 'private');

-- CreateEnum
CREATE TYPE "tournament_role" AS ENUM ('organizer', 'co_organizer', 'scorer', 'referee');

-- CreateEnum
CREATE TYPE "tournament_event_status" AS ENUM ('draft', 'registration_open', 'registration_closed', 'drawn', 'in_progress', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "stage_status" AS ENUM ('pending', 'in_progress', 'completed');

-- CreateEnum
CREATE TYPE "entry_status" AS ENUM ('pending', 'approved', 'withdrawn', 'disqualified');

-- CreateEnum
CREATE TYPE "fixture_status" AS ENUM ('pending', 'ready', 'live', 'completed', 'bye', 'cancelled');

-- DropForeignKey
ALTER TABLE "social_post" DROP CONSTRAINT "fk_social_post_match";

-- CreateTable
CREATE TABLE "sports" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(40) NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "category" VARCHAR(30) NOT NULL,
    "scoring_model" VARCHAR(40) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "icon_key" VARCHAR(40) NOT NULL,
    "accent_color" VARCHAR(9) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sport_formats" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "sport_id" INTEGER NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "players_per_side" SMALLINT NOT NULL,
    "min_per_side" SMALLINT NOT NULL,
    "max_per_side" SMALLINT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sport_formats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoring_rulesets" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "sport_id" INTEGER NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "scoring_model" VARCHAR(40) NOT NULL,
    "config" JSONB NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "scoring_rulesets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "players" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID,
    "display_name" VARCHAR(80) NOT NULL,
    "phone" VARCHAR(16),
    "created_by_user_id" UUID,
    "claimed_at" TIMESTAMPTZ,
    "merged_into_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_sports" (
    "player_id" UUID NOT NULL,
    "sport_id" INTEGER NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_sports_pkey" PRIMARY KEY ("player_id","sport_id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "sport_id" INTEGER NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "team_id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "role" VARCHAR(30),
    "joined_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMPTZ,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("team_id","player_id")
);

-- CreateTable
CREATE TABLE "team_stats" (
    "team_id" UUID NOT NULL,
    "matches_played" INTEGER NOT NULL DEFAULT 0,
    "won" INTEGER NOT NULL DEFAULT 0,
    "lost" INTEGER NOT NULL DEFAULT 0,
    "drawn" INTEGER NOT NULL DEFAULT 0,
    "major_won" INTEGER NOT NULL DEFAULT 0,
    "major_lost" INTEGER NOT NULL DEFAULT 0,
    "minor_won" INTEGER NOT NULL DEFAULT 0,
    "minor_lost" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "team_stats_pkey" PRIMARY KEY ("team_id")
);

-- CreateTable
CREATE TABLE "venues" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "name" VARCHAR(120) NOT NULL,
    "address" VARCHAR(255),
    "city" VARCHAR(80),
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "created_by_user_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "venues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courts" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "venue_id" UUID,
    "tournament_id" UUID,
    "sport_id" INTEGER,
    "name" VARCHAR(60) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "courts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "sport_id" INTEGER NOT NULL,
    "sport_format_id" UUID NOT NULL,
    "ruleset_id" UUID,
    "scoring_model" VARCHAR(40) NOT NULL,
    "ruleset_config" JSONB NOT NULL,
    "context" "match_context" NOT NULL,
    "status" "match_status" NOT NULL DEFAULT 'scheduled',
    "scoring_mode" "scoring_mode" NOT NULL DEFAULT 'live',
    "result_type" "result_type",
    "verification" "verification_status" NOT NULL DEFAULT 'not_required',
    "venue_id" UUID,
    "court_id" UUID,
    "share_token" VARCHAR(32) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "summary" JSONB,
    "created_by_user_id" UUID NOT NULL,
    "scheduled_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_sides" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "match_id" UUID NOT NULL,
    "side_index" SMALLINT NOT NULL,
    "name" VARCHAR(80),
    "team_id" UUID,
    "entry_id" UUID,
    "outcome" "side_outcome",

    CONSTRAINT "match_sides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_participants" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "match_id" UUID NOT NULL,
    "side_id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "position" VARCHAR(30),
    "sort_order" SMALLINT NOT NULL DEFAULT 0,

    CONSTRAINT "match_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_segments" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "match_id" UUID NOT NULL,
    "parent_id" UUID,
    "type" VARCHAR(30) NOT NULL,
    "sequence" SMALLINT NOT NULL,
    "status" "segment_status" NOT NULL DEFAULT 'in_progress',
    "winner_side_id" UUID,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ,

    CONSTRAINT "match_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_segment_scores" (
    "segment_id" UUID NOT NULL,
    "side_id" UUID NOT NULL,
    "score" INTEGER NOT NULL,

    CONSTRAINT "match_segment_scores_pkey" PRIMARY KEY ("segment_id","side_id")
);

-- CreateTable
CREATE TABLE "match_events" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "match_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "side_id" UUID,
    "participant_id" UUID,
    "segment_id" UUID,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "actor_user_id" UUID,
    "client_event_id" UUID,
    "occurred_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voided_at" TIMESTAMPTZ,
    "voided_by_user_id" UUID,

    CONSTRAINT "match_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_scorers" (
    "match_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "assigned_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_scorers_pkey" PRIMARY KEY ("match_id","user_id")
);

-- CreateTable
CREATE TABLE "match_confirmations" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "match_id" UUID NOT NULL,
    "side_id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "decision" "confirmation_decision" NOT NULL,
    "comment" VARCHAR(500),
    "decided_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_confirmations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_ratings" (
    "player_id" UUID NOT NULL,
    "sport_id" INTEGER NOT NULL,
    "system" VARCHAR(20) NOT NULL DEFAULT 'elo',
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 1000,
    "deviation" DOUBLE PRECISION,
    "volatility" DOUBLE PRECISION,
    "rated_matches" INTEGER NOT NULL DEFAULT 0,
    "last_rated_at" TIMESTAMPTZ,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "player_ratings_pkey" PRIMARY KEY ("player_id","sport_id")
);

-- CreateTable
CREATE TABLE "player_rating_history" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "player_id" UUID NOT NULL,
    "sport_id" INTEGER NOT NULL,
    "match_id" UUID NOT NULL,
    "system" VARCHAR(20) NOT NULL,
    "rating_before" DOUBLE PRECISION NOT NULL,
    "rating_after" DOUBLE PRECISION NOT NULL,
    "deviation_before" DOUBLE PRECISION,
    "deviation_after" DOUBLE PRECISION,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_rating_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_sport_stats" (
    "player_id" UUID NOT NULL,
    "sport_id" INTEGER NOT NULL,
    "matches_played" INTEGER NOT NULL DEFAULT 0,
    "won" INTEGER NOT NULL DEFAULT 0,
    "lost" INTEGER NOT NULL DEFAULT 0,
    "drawn" INTEGER NOT NULL DEFAULT 0,
    "major_won" INTEGER NOT NULL DEFAULT 0,
    "major_lost" INTEGER NOT NULL DEFAULT 0,
    "minor_won" INTEGER NOT NULL DEFAULT 0,
    "minor_lost" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "player_sport_stats_pkey" PRIMARY KEY ("player_id","sport_id")
);

-- CreateTable
CREATE TABLE "tournaments" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "slug" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "organizer_user_id" UUID NOT NULL,
    "venue_id" UUID,
    "status" "tournament_status" NOT NULL DEFAULT 'draft',
    "visibility" "tournament_visibility" NOT NULL DEFAULT 'public',
    "starts_on" DATE,
    "ends_on" DATE,
    "registration_opens_at" TIMESTAMPTZ,
    "registration_closes_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_staff" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "tournament_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "tournament_role" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournament_staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "court_scorers" (
    "court_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "court_scorers_pkey" PRIMARY KEY ("court_id","user_id")
);

-- CreateTable
CREATE TABLE "tournament_events" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "tournament_id" UUID NOT NULL,
    "sport_id" INTEGER NOT NULL,
    "sport_format_id" UUID NOT NULL,
    "ruleset_id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "format" VARCHAR(40) NOT NULL,
    "format_config" JSONB NOT NULL,
    "tiebreakers" JSONB NOT NULL,
    "rules_override" JSONB,
    "eligibility" JSONB,
    "status" "tournament_event_status" NOT NULL DEFAULT 'draft',
    "max_entries" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tournament_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_entries" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "event_id" UUID NOT NULL,
    "name" VARCHAR(120),
    "team_id" UUID,
    "seed" SMALLINT,
    "status" "entry_status" NOT NULL DEFAULT 'pending',
    "registered_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tournament_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_entry_members" (
    "entry_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "sort_order" SMALLINT NOT NULL DEFAULT 0,

    CONSTRAINT "tournament_entry_members_pkey" PRIMARY KEY ("entry_id","player_id")
);

-- CreateTable
CREATE TABLE "tournament_stages" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "event_id" UUID NOT NULL,
    "sequence" SMALLINT NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "status" "stage_status" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournament_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stage_groups" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "stage_id" UUID NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "name" VARCHAR(40) NOT NULL,
    "sequence" SMALLINT NOT NULL,

    CONSTRAINT "stage_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stage_group_entries" (
    "group_id" UUID NOT NULL,
    "entry_id" UUID NOT NULL,
    "position" SMALLINT NOT NULL,

    CONSTRAINT "stage_group_entries_pkey" PRIMARY KEY ("group_id","entry_id")
);

-- CreateTable
CREATE TABLE "fixtures" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "stage_id" UUID NOT NULL,
    "group_id" UUID,
    "round" SMALLINT NOT NULL,
    "position" SMALLINT NOT NULL,
    "round_name" VARCHAR(40),
    "entry1_id" UUID,
    "entry2_id" UUID,
    "entry1_source" JSONB,
    "entry2_source" JSONB,
    "next_fixture_id" UUID,
    "next_fixture_slot" SMALLINT,
    "loser_next_fixture_id" UUID,
    "loser_next_fixture_slot" SMALLINT,
    "court_id" UUID,
    "scheduled_at" TIMESTAMPTZ,
    "match_id" UUID,
    "status" "fixture_status" NOT NULL DEFAULT 'pending',
    "winner_entry_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "fixtures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sports_slug_key" ON "sports"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "sports_name_key" ON "sports"("name");

-- CreateIndex
CREATE INDEX "sports_is_active_sort_order_idx" ON "sports"("is_active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "sport_formats_sport_id_code_key" ON "sport_formats"("sport_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "scoring_rulesets_sport_id_slug_key" ON "scoring_rulesets"("sport_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "players_user_id_key" ON "players"("user_id");

-- CreateIndex
CREATE INDEX "players_phone_idx" ON "players"("phone");

-- CreateIndex
CREATE INDEX "players_created_by_user_id_idx" ON "players"("created_by_user_id");

-- CreateIndex
CREATE INDEX "teams_sport_id_idx" ON "teams"("sport_id");

-- CreateIndex
CREATE INDEX "team_members_player_id_idx" ON "team_members"("player_id");

-- CreateIndex
CREATE INDEX "venues_city_idx" ON "venues"("city");

-- CreateIndex
CREATE INDEX "courts_venue_id_idx" ON "courts"("venue_id");

-- CreateIndex
CREATE UNIQUE INDEX "courts_tournament_id_name_key" ON "courts"("tournament_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "matches_share_token_key" ON "matches"("share_token");

-- CreateIndex
CREATE INDEX "matches_status_updated_at_idx" ON "matches"("status", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "matches_sport_id_completed_at_idx" ON "matches"("sport_id", "completed_at" DESC);

-- CreateIndex
CREATE INDEX "matches_created_by_user_id_created_at_idx" ON "matches"("created_by_user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "matches_verification_idx" ON "matches"("verification");

-- CreateIndex
CREATE INDEX "match_sides_team_id_idx" ON "match_sides"("team_id");

-- CreateIndex
CREATE INDEX "match_sides_entry_id_idx" ON "match_sides"("entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "match_sides_match_id_side_index_key" ON "match_sides"("match_id", "side_index");

-- CreateIndex
CREATE UNIQUE INDEX "match_sides_id_match_id_key" ON "match_sides"("id", "match_id");

-- CreateIndex
CREATE INDEX "match_participants_player_id_idx" ON "match_participants"("player_id");

-- CreateIndex
CREATE UNIQUE INDEX "match_participants_match_id_player_id_key" ON "match_participants"("match_id", "player_id");

-- CreateIndex
CREATE UNIQUE INDEX "match_participants_id_match_id_key" ON "match_participants"("id", "match_id");

-- CreateIndex
CREATE INDEX "match_segments_match_id_parent_id_sequence_idx" ON "match_segments"("match_id", "parent_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "match_events_match_id_sequence_key" ON "match_events"("match_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "match_events_match_id_client_event_id_key" ON "match_events"("match_id", "client_event_id");

-- CreateIndex
CREATE INDEX "match_scorers_user_id_idx" ON "match_scorers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "match_confirmations_match_id_side_id_key" ON "match_confirmations"("match_id", "side_id");

-- CreateIndex
CREATE INDEX "player_ratings_sport_id_rating_idx" ON "player_ratings"("sport_id", "rating" DESC);

-- CreateIndex
CREATE INDEX "player_rating_history_player_id_sport_id_created_at_idx" ON "player_rating_history"("player_id", "sport_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "player_rating_history_player_id_match_id_key" ON "player_rating_history"("player_id", "match_id");

-- CreateIndex
CREATE UNIQUE INDEX "tournaments_slug_key" ON "tournaments"("slug");

-- CreateIndex
CREATE INDEX "tournaments_status_starts_on_idx" ON "tournaments"("status", "starts_on");

-- CreateIndex
CREATE INDEX "tournaments_organizer_user_id_idx" ON "tournaments"("organizer_user_id");

-- CreateIndex
CREATE INDEX "tournament_staff_user_id_idx" ON "tournament_staff"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_staff_tournament_id_user_id_role_key" ON "tournament_staff"("tournament_id", "user_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_events_tournament_id_name_key" ON "tournament_events"("tournament_id", "name");

-- CreateIndex
CREATE INDEX "tournament_entries_event_id_status_idx" ON "tournament_entries"("event_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_entries_event_id_seed_key" ON "tournament_entries"("event_id", "seed");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_entries_id_event_id_key" ON "tournament_entries"("id", "event_id");

-- CreateIndex
CREATE INDEX "tournament_entry_members_player_id_idx" ON "tournament_entry_members"("player_id");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_entry_members_event_id_player_id_key" ON "tournament_entry_members"("event_id", "player_id");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_stages_event_id_sequence_key" ON "tournament_stages"("event_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "stage_groups_stage_id_name_key" ON "stage_groups"("stage_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "stage_group_entries_group_id_position_key" ON "stage_group_entries"("group_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "fixtures_match_id_key" ON "fixtures"("match_id");

-- CreateIndex
CREATE INDEX "fixtures_stage_id_round_idx" ON "fixtures"("stage_id", "round");

-- CreateIndex
CREATE INDEX "fixtures_court_id_scheduled_at_idx" ON "fixtures"("court_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "fixtures_status_idx" ON "fixtures"("status");

-- AddForeignKey
ALTER TABLE "social_post" ADD CONSTRAINT "fk_social_post_match" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sport_formats" ADD CONSTRAINT "sport_formats_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "sports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring_rulesets" ADD CONSTRAINT "scoring_rulesets_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "sports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring_rulesets" ADD CONSTRAINT "scoring_rulesets_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "usr_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "players" ADD CONSTRAINT "players_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "usr_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "players" ADD CONSTRAINT "players_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "usr_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "players" ADD CONSTRAINT "players_merged_into_id_fkey" FOREIGN KEY ("merged_into_id") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_sports" ADD CONSTRAINT "player_sports_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_sports" ADD CONSTRAINT "player_sports_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "sports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "sports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "usr_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_stats" ADD CONSTRAINT "team_stats_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venues" ADD CONSTRAINT "venues_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "usr_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courts" ADD CONSTRAINT "courts_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courts" ADD CONSTRAINT "courts_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courts" ADD CONSTRAINT "courts_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "sports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "sports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_sport_format_id_fkey" FOREIGN KEY ("sport_format_id") REFERENCES "sport_formats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_ruleset_id_fkey" FOREIGN KEY ("ruleset_id") REFERENCES "scoring_rulesets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "courts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "usr_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_sides" ADD CONSTRAINT "match_sides_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_sides" ADD CONSTRAINT "match_sides_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_sides" ADD CONSTRAINT "match_sides_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "tournament_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_side_id_match_id_fkey" FOREIGN KEY ("side_id", "match_id") REFERENCES "match_sides"("id", "match_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_segments" ADD CONSTRAINT "match_segments_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_segments" ADD CONSTRAINT "match_segments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "match_segments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_segments" ADD CONSTRAINT "match_segments_winner_side_id_fkey" FOREIGN KEY ("winner_side_id") REFERENCES "match_sides"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_segment_scores" ADD CONSTRAINT "match_segment_scores_segment_id_fkey" FOREIGN KEY ("segment_id") REFERENCES "match_segments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_segment_scores" ADD CONSTRAINT "match_segment_scores_side_id_fkey" FOREIGN KEY ("side_id") REFERENCES "match_sides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_side_id_fkey" FOREIGN KEY ("side_id") REFERENCES "match_sides"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "match_participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_segment_id_fkey" FOREIGN KEY ("segment_id") REFERENCES "match_segments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "usr_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_voided_by_user_id_fkey" FOREIGN KEY ("voided_by_user_id") REFERENCES "usr_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_scorers" ADD CONSTRAINT "match_scorers_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_scorers" ADD CONSTRAINT "match_scorers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "usr_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_scorers" ADD CONSTRAINT "match_scorers_assigned_by_user_id_fkey" FOREIGN KEY ("assigned_by_user_id") REFERENCES "usr_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_confirmations" ADD CONSTRAINT "match_confirmations_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_confirmations" ADD CONSTRAINT "match_confirmations_side_id_fkey" FOREIGN KEY ("side_id") REFERENCES "match_sides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_confirmations" ADD CONSTRAINT "match_confirmations_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_confirmations" ADD CONSTRAINT "match_confirmations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "usr_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_ratings" ADD CONSTRAINT "player_ratings_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_ratings" ADD CONSTRAINT "player_ratings_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "sports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_rating_history" ADD CONSTRAINT "player_rating_history_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_rating_history" ADD CONSTRAINT "player_rating_history_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "sports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_rating_history" ADD CONSTRAINT "player_rating_history_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_sport_stats" ADD CONSTRAINT "player_sport_stats_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_sport_stats" ADD CONSTRAINT "player_sport_stats_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "sports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_organizer_user_id_fkey" FOREIGN KEY ("organizer_user_id") REFERENCES "usr_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_staff" ADD CONSTRAINT "tournament_staff_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_staff" ADD CONSTRAINT "tournament_staff_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "usr_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "court_scorers" ADD CONSTRAINT "court_scorers_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "courts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "court_scorers" ADD CONSTRAINT "court_scorers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "usr_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_events" ADD CONSTRAINT "tournament_events_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_events" ADD CONSTRAINT "tournament_events_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "sports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_events" ADD CONSTRAINT "tournament_events_sport_format_id_fkey" FOREIGN KEY ("sport_format_id") REFERENCES "sport_formats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_events" ADD CONSTRAINT "tournament_events_ruleset_id_fkey" FOREIGN KEY ("ruleset_id") REFERENCES "scoring_rulesets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_entries" ADD CONSTRAINT "tournament_entries_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "tournament_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_entries" ADD CONSTRAINT "tournament_entries_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_entries" ADD CONSTRAINT "tournament_entries_registered_by_user_id_fkey" FOREIGN KEY ("registered_by_user_id") REFERENCES "usr_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_entry_members" ADD CONSTRAINT "tournament_entry_members_entry_id_event_id_fkey" FOREIGN KEY ("entry_id", "event_id") REFERENCES "tournament_entries"("id", "event_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_entry_members" ADD CONSTRAINT "tournament_entry_members_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_stages" ADD CONSTRAINT "tournament_stages_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "tournament_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_groups" ADD CONSTRAINT "stage_groups_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "tournament_stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_group_entries" ADD CONSTRAINT "stage_group_entries_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "stage_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_group_entries" ADD CONSTRAINT "stage_group_entries_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "tournament_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "tournament_stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "stage_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_entry1_id_fkey" FOREIGN KEY ("entry1_id") REFERENCES "tournament_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_entry2_id_fkey" FOREIGN KEY ("entry2_id") REFERENCES "tournament_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_winner_entry_id_fkey" FOREIGN KEY ("winner_entry_id") REFERENCES "tournament_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_next_fixture_id_fkey" FOREIGN KEY ("next_fixture_id") REFERENCES "fixtures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_loser_next_fixture_id_fkey" FOREIGN KEY ("loser_next_fixture_id") REFERENCES "fixtures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "courts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------------------------
-- Constraints Prisma cannot express (hand-written)
-- ---------------------------------------------------------------------------------------------

ALTER TABLE "sport_formats" ADD CONSTRAINT "chk_sport_formats_sizes"
    CHECK (min_per_side >= 1 AND min_per_side <= players_per_side AND players_per_side <= max_per_side);

-- One default ruleset per sport; one primary sport per player.
CREATE UNIQUE INDEX "uq_scoring_rulesets_default" ON "scoring_rulesets" ("sport_id") WHERE is_default;
CREATE UNIQUE INDEX "uq_player_sports_primary" ON "player_sports" ("player_id") WHERE is_primary;

ALTER TABLE "players" ADD CONSTRAINT "chk_players_phone_e164" CHECK (phone IS NULL OR phone ~ '^\+[1-9][0-9]{7,14}$');
ALTER TABLE "players" ADD CONSTRAINT "chk_players_not_merged_into_self" CHECK (merged_into_id IS NULL OR merged_into_id <> id);

ALTER TABLE "courts" ADD CONSTRAINT "chk_courts_owner" CHECK (venue_id IS NOT NULL OR tournament_id IS NOT NULL);

ALTER TABLE "matches" ADD CONSTRAINT "chk_matches_version" CHECK (version >= 0);
ALTER TABLE "match_sides" ADD CONSTRAINT "chk_match_sides_index" CHECK (side_index >= 0);
ALTER TABLE "match_events" ADD CONSTRAINT "chk_match_events_sequence" CHECK (sequence >= 1);
ALTER TABLE "match_segments" ADD CONSTRAINT "uq_match_segments_position"
    UNIQUE NULLS NOT DISTINCT (match_id, parent_id, type, sequence);

ALTER TABLE "fixtures" ADD CONSTRAINT "uq_fixtures_position" UNIQUE NULLS NOT DISTINCT (stage_id, group_id, round, position);
ALTER TABLE "fixtures" ADD CONSTRAINT "chk_fixtures_next_slot" CHECK (next_fixture_slot IN (1, 2));
ALTER TABLE "fixtures" ADD CONSTRAINT "chk_fixtures_loser_next_slot" CHECK (loser_next_fixture_slot IN (1, 2));
ALTER TABLE "fixtures" ADD CONSTRAINT "chk_fixtures_distinct_entries" CHECK (entry1_id IS NULL OR entry2_id IS NULL OR entry1_id <> entry2_id);
