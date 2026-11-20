-- Design v2 rating scale: everyone starts at 1500 instead of 1000 (tiers Rookie <1200 ... Elite 1850+).
-- Every existing rating and history row moves up by 500, so the gaps between players and every
-- past change stay exactly the same. Runs once (Prisma records it).

UPDATE "player_ratings" SET "rating" = "rating" + 500;
UPDATE "player_rating_history" SET "rating_before" = "rating_before" + 500, "rating_after" = "rating_after" + 500;

-- AlterTable
ALTER TABLE "player_ratings" ALTER COLUMN "rating" SET DEFAULT 1500;
