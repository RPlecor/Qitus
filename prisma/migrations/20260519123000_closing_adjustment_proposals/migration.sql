-- CreateEnum
CREATE TYPE "ClosingAdjustmentKind" AS ENUM ('CCA', 'DEPRECIATION', 'CORPORATE_TAX');

-- CreateEnum
CREATE TYPE "ClosingAdjustmentStatus" AS ENUM ('DRAFT', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "EntrySource" ADD VALUE 'CLOSING_ADJUSTMENT';

-- CreateTable
CREATE TABLE "ClosingAdjustmentProposal" (
    "id" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    "issueKey" TEXT NOT NULL,
    "proposalKey" TEXT NOT NULL,
    "kind" "ClosingAdjustmentKind" NOT NULL,
    "status" "ClosingAdjustmentStatus" NOT NULL DEFAULT 'DRAFT',
    "label" TEXT NOT NULL,
    "calculationJson" JSONB NOT NULL,
    "linesJson" JSONB NOT NULL,
    "journalEntryId" TEXT,
    "note" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClosingAdjustmentProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClosingAdjustmentProposal_journalEntryId_key" ON "ClosingAdjustmentProposal"("journalEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "ClosingAdjustmentProposal_fiscalYearId_proposalKey_key" ON "ClosingAdjustmentProposal"("fiscalYearId", "proposalKey");

-- CreateIndex
CREATE INDEX "ClosingAdjustmentProposal_fiscalYearId_kind_idx" ON "ClosingAdjustmentProposal"("fiscalYearId", "kind");

-- CreateIndex
CREATE INDEX "ClosingAdjustmentProposal_status_idx" ON "ClosingAdjustmentProposal"("status");

-- AddForeignKey
ALTER TABLE "ClosingAdjustmentProposal" ADD CONSTRAINT "ClosingAdjustmentProposal_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClosingAdjustmentProposal" ADD CONSTRAINT "ClosingAdjustmentProposal_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
