-- AlterTable
ALTER TABLE "ClosingAdjustmentProposal"
ADD COLUMN     "assumptionsJson" JSONB,
ADD COLUMN     "calculationVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "lastCalculatedAt" TIMESTAMP(3),
ADD COLUMN     "staleReason" TEXT,
ADD COLUMN     "approvedByUserId" TEXT,
ADD COLUMN     "rejectedByUserId" TEXT;

-- CreateTable
CREATE TABLE "ClosingAdjustmentEvent" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadJson" JSONB,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClosingAdjustmentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClosingAdjustmentEvent_proposalId_createdAt_idx" ON "ClosingAdjustmentEvent"("proposalId", "createdAt");

-- CreateIndex
CREATE INDEX "ClosingAdjustmentEvent_eventType_idx" ON "ClosingAdjustmentEvent"("eventType");

-- AddForeignKey
ALTER TABLE "ClosingAdjustmentEvent" ADD CONSTRAINT "ClosingAdjustmentEvent_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "ClosingAdjustmentProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
