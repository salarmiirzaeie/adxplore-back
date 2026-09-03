-- CreateTable
CREATE TABLE "BankCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletId" TEXT NOT NULL,
    "holderName" TEXT NOT NULL,
    "cardNumber" TEXT NOT NULL,
    "sheba" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BankCard_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "BankCard_walletId_key" ON "BankCard"("walletId");

ALTER TABLE "WalletTransaction" ADD COLUMN "payoutHolderName" TEXT;
ALTER TABLE "WalletTransaction" ADD COLUMN "payoutCardNumber" TEXT;
ALTER TABLE "WalletTransaction" ADD COLUMN "payoutSheba" TEXT;
ALTER TABLE "WalletTransaction" ADD COLUMN "payoutBankName" TEXT;
