-- CampaignStatus now includes PENDING_REVIEW (SQLite stores enums as TEXT).
-- Brands submit for review; only admin can set OPEN (explore + deliver invites).

ALTER TABLE "Campaign" ADD COLUMN "rejectionReason" TEXT;
ALTER TABLE "Campaign" ADD COLUMN "rejectedAt" DATETIME;
