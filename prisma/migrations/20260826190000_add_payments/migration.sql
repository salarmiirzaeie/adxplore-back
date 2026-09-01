-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dealId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "amountToman" INTEGER NOT NULL,
    "amountRial" INTEGER NOT NULL,
    "description" TEXT,
    "authority" TEXT,
    "refId" TEXT,
    "cardPan" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "paidAt" DATETIME,
    "releasedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Payment_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Payment_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Payment_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Deal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "offerId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "fee" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_PAYMENT',
    "contentUrl" TEXT,
    "note" TEXT,
    "proofUrl" TEXT,
    "brandFeedback" TEXT,
    "submittedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Deal_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Deal_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Deal_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Deal_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Deal" ("id", "offerId", "campaignId", "brandId", "influencerId", "fee", "status", "contentUrl", "note", "proofUrl", "brandFeedback", "submittedAt", "completedAt", "createdAt", "updatedAt")
SELECT "id", "offerId", "campaignId", "brandId", "influencerId", "fee", "status", "contentUrl", "note", "proofUrl", "brandFeedback", "submittedAt", "completedAt", "createdAt", "updatedAt" FROM "Deal";
DROP TABLE "Deal";
ALTER TABLE "new_Deal" RENAME TO "Deal";
CREATE UNIQUE INDEX "Deal_offerId_key" ON "Deal"("offerId");
CREATE INDEX "Deal_brandId_status_idx" ON "Deal"("brandId", "status");
CREATE INDEX "Deal_influencerId_status_idx" ON "Deal"("influencerId", "status");
CREATE INDEX "Deal_campaignId_status_idx" ON "Deal"("campaignId", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Payment_dealId_key" ON "Payment"("dealId");
CREATE INDEX "Payment_brandId_status_idx" ON "Payment"("brandId", "status");
CREATE INDEX "Payment_influencerId_status_idx" ON "Payment"("influencerId", "status");
CREATE INDEX "Payment_authority_idx" ON "Payment"("authority");
