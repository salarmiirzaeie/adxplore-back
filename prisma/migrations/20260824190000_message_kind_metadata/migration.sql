-- Add structured message kinds for chat timeline (deliverables, system events)

ALTER TABLE "Message" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'TEXT';
ALTER TABLE "Message" ADD COLUMN "metadata" TEXT;
