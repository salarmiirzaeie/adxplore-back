-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN "deliverables" JSON NOT NULL DEFAULT '[]';

-- Backfill from single deliverable
UPDATE "Campaign" SET "deliverables" = json_array("deliverable");
