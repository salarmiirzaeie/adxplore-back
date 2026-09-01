-- AlterTable
ALTER TABLE "WalletTransaction" ADD COLUMN "relatedTxId" TEXT;

-- CreateIndex
CREATE INDEX "WalletTransaction_relatedTxId_idx" ON "WalletTransaction"("relatedTxId");
