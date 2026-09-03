-- CreateTable
-- AlterTable
ALTER TABLE "User" ADD COLUMN "approvalStatus" TEXT;
ALTER TABLE "User" ADD COLUMN "instagramVerifyCode" TEXT;
ALTER TABLE "User" ADD COLUMN "instagramDmMarkedSentAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "approvedAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "rejectedAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "rejectionReason" TEXT;

-- Existing influencers keep panel access; new signups are created as PENDING in app code.
UPDATE "User" SET "approvalStatus" = 'APPROVED' WHERE "role" = 'INFLUENCER';

CREATE UNIQUE INDEX "User_instagramVerifyCode_key" ON "User"("instagramVerifyCode");
CREATE INDEX "User_role_approvalStatus_idx" ON "User"("role", "approvalStatus");
