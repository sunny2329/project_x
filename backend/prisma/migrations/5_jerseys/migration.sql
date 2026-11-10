-- Basketball: shirt numbers per player and a jersey colour per side, for one match.
-- Both nullable: every existing match and every other sport is unaffected.

-- AlterTable
ALTER TABLE "match_sides" ADD COLUMN "color" VARCHAR(9);

-- AlterTable
ALTER TABLE "match_participants" ADD COLUMN "jersey_number" SMALLINT;

-- Hand-written (not expressible in schema.prisma)
ALTER TABLE "match_participants" ADD CONSTRAINT "ck_match_participants_jersey_number" CHECK ("jersey_number" BETWEEN 0 AND 99);
ALTER TABLE "match_sides" ADD CONSTRAINT "ck_match_sides_color" CHECK ("color" ~ '^#[0-9A-Fa-f]{6}$');
CREATE UNIQUE INDEX "uq_match_participants_jersey" ON "match_participants" ("side_id", "jersey_number") WHERE "jersey_number" IS NOT NULL;
