-- CreateTable
CREATE TABLE "AudienceProof" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AudienceProof_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AudienceProof_userId_sortOrder_idx" ON "AudienceProof"("userId", "sortOrder");

-- AddForeignKey
ALTER TABLE "AudienceProof" ADD CONSTRAINT "AudienceProof_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
