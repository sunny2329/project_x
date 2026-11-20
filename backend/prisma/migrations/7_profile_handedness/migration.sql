-- Design v2 profile header: "@aarav.m · Jaipur · Right-handed". Optional; null = not said.

-- AlterTable
ALTER TABLE "usr_user_profile" ADD COLUMN "handedness" VARCHAR(5);

-- Hand-written (not expressible in schema.prisma)
ALTER TABLE "usr_user_profile" ADD CONSTRAINT "ck_usr_user_profile_handedness" CHECK ("handedness" IN ('left', 'right'));
