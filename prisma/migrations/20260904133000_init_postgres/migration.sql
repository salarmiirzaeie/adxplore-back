-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('INFLUENCER', 'BRAND', 'ADMIN');

-- CreateEnum
CREATE TYPE "BrandCategory" AS ENUM ('BEAUTY', 'FASHION', 'FOOD', 'HEALTH', 'TECH', 'EDUCATION', 'TRAVEL', 'SPORTS', 'HOME', 'FINANCE', 'ENTERTAINMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "BrandGoal" AS ENUM ('AWARENESS', 'SALES', 'CONTENT', 'LAUNCH');

-- CreateEnum
CREATE TYPE "BusinessSize" AS ENUM ('SOLO', 'SME', 'AGENCY', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "FollowerRange" AS ENUM ('UNDER_1K', 'FROM_1K_5K', 'FROM_5K_10K', 'FROM_10K_50K', 'FROM_50K_100K', 'FROM_100K_500K', 'OVER_500K');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "DeliverableType" AS ENUM ('STORY', 'POST', 'REEL');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('PENDING_PAYMENT', 'IN_PROGRESS', 'DELIVERED', 'REVISION_REQUESTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DealContentKind" AS ENUM ('LINK', 'IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'HELD', 'RELEASED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "WalletTxType" AS ENUM ('TOP_UP', 'ESCROW_HOLD', 'ESCROW_RELEASE', 'ESCROW_REFUND', 'DEAL_EARNING', 'WITHDRAW_REQUEST', 'WITHDRAW_DONE', 'WITHDRAW_CANCEL');

-- CreateEnum
CREATE TYPE "MessageKind" AS ENUM ('TEXT', 'SYSTEM', 'DELIVERABLE', 'IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "InfluencerApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('NEW', 'READ', 'RESOLVED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('INVITATION_RECEIVED', 'OFFER_RECEIVED', 'OFFER_UPDATED', 'OFFER_ACCEPTED', 'OFFER_REJECTED', 'OFFER_CANCELLED', 'OFFER_REOPENED', 'DEAL_STARTED', 'DELIVERABLE_SUBMITTED', 'REVISION_REQUESTED', 'DEAL_COMPLETED', 'DEAL_CANCELLED', 'DEAL_REACTIVATED', 'PAYMENT_REQUIRED', 'PAYMENT_HELD', 'PAYMENT_RELEASED', 'PAYMENT_FAILED', 'WALLET_CREDITED', 'WALLET_WITHDRAW_REQUESTED', 'WALLET_WITHDRAW_COMPLETED', 'WALLET_WITHDRAW_REJECTED', 'CHAT_MESSAGE', 'INFLUENCER_APPROVED', 'INFLUENCER_REJECTED', 'CAMPAIGN_REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'INFLUENCER',
    "photoUrl" TEXT,
    "category" "BrandCategory",
    "categories" JSONB NOT NULL DEFAULT '[]',
    "city" TEXT,
    "province" TEXT,
    "website" TEXT,
    "bio" TEXT,
    "goal" "BrandGoal",
    "businessSize" "BusinessSize",
    "followerRange" "FollowerRange",
    "approvalStatus" "InfluencerApprovalStatus",
    "instagramVerifyCode" TEXT,
    "instagramDmMarkedSentAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "brief" TEXT NOT NULL,
    "category" "BrandCategory" NOT NULL,
    "categories" JSONB NOT NULL DEFAULT '[]',
    "city" TEXT NOT NULL,
    "province" TEXT,
    "deliverable" "DeliverableType" NOT NULL,
    "deliverables" JSONB NOT NULL DEFAULT '[]',
    "budgetMin" INTEGER,
    "budgetMax" INTEGER,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "rejectionReason" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignImage" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "message" TEXT,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "fee" INTEGER NOT NULL,
    "message" TEXT,
    "deadline" TIMESTAMP(3),
    "status" "OfferStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "kind" "MessageKind" NOT NULL DEFAULT 'TEXT',
    "body" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "fee" INTEGER NOT NULL,
    "status" "DealStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "contentKind" "DealContentKind",
    "contentUrl" TEXT,
    "note" TEXT,
    "proofUrl" TEXT,
    "brandFeedback" TEXT,
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "statusBeforeCancel" "DealStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "amountToman" INTEGER NOT NULL,
    "amountRial" INTEGER NOT NULL,
    "description" TEXT,
    "authority" TEXT,
    "refId" TEXT,
    "cardPan" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "paidAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "availableToman" INTEGER NOT NULL DEFAULT 0,
    "heldToman" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankCard" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "holderName" TEXT NOT NULL,
    "cardNumber" TEXT NOT NULL,
    "sheba" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "type" "WalletTxType" NOT NULL,
    "amountToman" INTEGER NOT NULL,
    "availableAfter" INTEGER NOT NULL,
    "heldAfter" INTEGER NOT NULL,
    "dealId" TEXT,
    "paymentId" TEXT,
    "relatedTxId" TEXT,
    "description" TEXT,
    "payoutHolderName" TEXT,
    "payoutCardNumber" TEXT,
    "payoutSheba" TEXT,
    "payoutBankName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "linkPath" TEXT,
    "entityId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'NEW',
    "readAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Otp" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "Otp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_instagramVerifyCode_key" ON "User"("instagramVerifyCode");

-- CreateIndex
CREATE INDEX "User_role_approvalStatus_idx" ON "User"("role", "approvalStatus");

-- CreateIndex
CREATE INDEX "Campaign_brandId_status_idx" ON "Campaign"("brandId", "status");

-- CreateIndex
CREATE INDEX "Campaign_status_category_city_idx" ON "Campaign"("status", "category", "city");

-- CreateIndex
CREATE INDEX "CampaignImage_campaignId_sortOrder_idx" ON "CampaignImage"("campaignId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_campaignId_influencerId_key" ON "Invitation"("campaignId", "influencerId");

-- CreateIndex
CREATE INDEX "Invitation_brandId_status_idx" ON "Invitation"("brandId", "status");

-- CreateIndex
CREATE INDEX "Invitation_influencerId_status_idx" ON "Invitation"("influencerId", "status");

-- CreateIndex
CREATE INDEX "Invitation_campaignId_status_idx" ON "Invitation"("campaignId", "status");

-- CreateIndex
CREATE INDEX "Offer_brandId_status_idx" ON "Offer"("brandId", "status");

-- CreateIndex
CREATE INDEX "Offer_influencerId_status_idx" ON "Offer"("influencerId", "status");

-- CreateIndex
CREATE INDEX "Offer_campaignId_status_idx" ON "Offer"("campaignId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_offerId_key" ON "Conversation"("offerId");

-- CreateIndex
CREATE INDEX "Conversation_brandId_updatedAt_idx" ON "Conversation"("brandId", "updatedAt");

-- CreateIndex
CREATE INDEX "Conversation_influencerId_updatedAt_idx" ON "Conversation"("influencerId", "updatedAt");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");

-- CreateIndex
CREATE UNIQUE INDEX "Deal_offerId_key" ON "Deal"("offerId");

-- CreateIndex
CREATE INDEX "Deal_brandId_status_idx" ON "Deal"("brandId", "status");

-- CreateIndex
CREATE INDEX "Deal_influencerId_status_idx" ON "Deal"("influencerId", "status");

-- CreateIndex
CREATE INDEX "Deal_campaignId_status_idx" ON "Deal"("campaignId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_dealId_key" ON "Payment"("dealId");

-- CreateIndex
CREATE INDEX "Payment_brandId_status_idx" ON "Payment"("brandId", "status");

-- CreateIndex
CREATE INDEX "Payment_influencerId_status_idx" ON "Payment"("influencerId", "status");

-- CreateIndex
CREATE INDEX "Payment_authority_idx" ON "Payment"("authority");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BankCard_walletId_key" ON "BankCard"("walletId");

-- CreateIndex
CREATE INDEX "WalletTransaction_walletId_createdAt_idx" ON "WalletTransaction"("walletId", "createdAt");

-- CreateIndex
CREATE INDEX "WalletTransaction_dealId_idx" ON "WalletTransaction"("dealId");

-- CreateIndex
CREATE INDEX "WalletTransaction_paymentId_idx" ON "WalletTransaction"("paymentId");

-- CreateIndex
CREATE INDEX "WalletTransaction_relatedTxId_idx" ON "WalletTransaction"("relatedTxId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "SupportTicket_status_createdAt_idx" ON "SupportTicket"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SupportTicket_userId_createdAt_idx" ON "SupportTicket"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Otp_phone_code_idx" ON "Otp"("phone", "code");

-- CreateIndex
CREATE INDEX "Otp_phone_expiresAt_idx" ON "Otp"("phone", "expiresAt");

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignImage" ADD CONSTRAINT "CampaignImage_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankCard" ADD CONSTRAINT "BankCard_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Otp" ADD CONSTRAINT "Otp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
