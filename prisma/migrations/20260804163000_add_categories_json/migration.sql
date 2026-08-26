-- AlterTable
ALTER TABLE "User" ADD COLUMN "categories" JSON NOT NULL DEFAULT '[]';
ALTER TABLE "Campaign" ADD COLUMN "categories" JSON NOT NULL DEFAULT '[]';

-- Backfill from single category
UPDATE "User" SET "categories" = json_array("category") WHERE "category" IS NOT NULL;
UPDATE "Campaign" SET "categories" = json_array("category");
